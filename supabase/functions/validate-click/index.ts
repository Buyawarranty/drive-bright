import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ClickValidationRequest {
  action_type: string
  session_id?: string
  user_agent?: string
  referrer?: string
  timestamp?: number
}

interface BotDetectionResult {
  isBot: boolean
  riskScore: number
  reasons: string[]
}

function detectBot(userAgent: string, referrer?: string): BotDetectionResult {
  const reasons: string[] = []
  let riskScore = 0

  // Common bot user agents
  const botPatterns = [
    /bot/i, /spider/i, /crawler/i, /scraper/i, /curl/i, /wget/i,
    /python-requests/i, /postman/i, /insomnia/i, /phantom/i, /selenium/i
  ]

  for (const pattern of botPatterns) {
    if (pattern.test(userAgent)) {
      reasons.push('Bot-like user agent detected')
      riskScore += 50
      break
    }
  }

  // Empty or suspicious user agents
  if (!userAgent || userAgent.length < 10) {
    reasons.push('Missing or suspicious user agent')
    riskScore += 30
  }

  // Check for headless browsers
  const headlessPatterns = [/headless/i, /phantomjs/i, /htmlunit/i]
  for (const pattern of headlessPatterns) {
    if (pattern.test(userAgent)) {
      reasons.push('Headless browser detected')
      riskScore += 40
      break
    }
  }

  // Suspicious referrers
  if (referrer && (
    referrer.includes('spam') || 
    referrer.includes('click') ||
    referrer.includes('bot')
  )) {
    reasons.push('Suspicious referrer')
    riskScore += 25
  }

  return {
    isBot: riskScore >= 50,
    riskScore: Math.min(riskScore, 100),
    reasons
  }
}

function getClientIP(req: Request): string {
  // Try different headers for real IP
  const headers = req.headers
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0] ||
    headers.get('x-real-ip') ||
    headers.get('x-client-ip') ||
    '0.0.0.0'
  )
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const body: ClickValidationRequest = await req.json()
    const { action_type, session_id, user_agent, referrer, timestamp } = body

    const clientIP = getClientIP(req)
    const requestTime = new Date(timestamp || Date.now())
    const currentTime = new Date()

    console.log('Click validation request:', {
      action_type,
      clientIP,
      user_agent: user_agent?.substring(0, 100)
    })

    // Check if timestamp is reasonable (not more than 5 minutes in future/past)
    const timeDiff = Math.abs(currentTime.getTime() - requestTime.getTime())
    if (timeDiff > 5 * 60 * 1000) {
      console.log('Suspicious timestamp detected:', { timeDiff, clientIP })
      return new Response(
        JSON.stringify({
          valid: false,
          blocked: true,
          reason: 'Invalid timestamp',
          risk_score: 100
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if IP is already blocked
    const { data: blockedIP } = await supabase
      .from('blocked_ips')
      .select('*')
      .eq('ip_address', clientIP)
      .maybeSingle()

    if (blockedIP && (
      !blockedIP.blocked_until || 
      new Date(blockedIP.blocked_until) > currentTime
    )) {
      console.log('Blocked IP attempted access:', clientIP)
      return new Response(
        JSON.stringify({
          valid: false,
          blocked: true,
          reason: blockedIP.reason,
          risk_score: 100
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Perform bot detection
    const botDetection = detectBot(user_agent || '', referrer)
    let riskScore = botDetection.riskScore

    // Check rate limiting - be much more lenient for purchase actions
    const oneHourAgo = new Date(currentTime.getTime() - 60 * 60 * 1000)
    const { data: recentClicks } = await supabase
      .from('click_fraud_protection')
      .select('click_count')
      .eq('ip_address', clientIP)
      .eq('action_type', action_type)
      .gte('created_at', oneHourAgo.toISOString())

    const totalRecentClicks = recentClicks?.reduce((sum, record) => sum + record.click_count, 0) || 0

    // For purchase completion, be very lenient to allow legitimate customers
    if (action_type === 'complete_purchase') {
      // Only increase risk score for extremely high activity (likely automated)
      if (totalRecentClicks > 100) {
        riskScore = Math.min(riskScore + 30, 100)
      } else if (totalRecentClicks > 50) {
        riskScore = Math.min(riskScore + 15, 100)
      }
      // Don't penalize normal purchase attempts (up to 50 clicks is acceptable)
    } else {
      // For other actions, use normal rate limiting
      if (totalRecentClicks > 20) {
        riskScore = Math.min(riskScore + 50, 100)
      } else if (totalRecentClicks > 10) {
        riskScore = Math.min(riskScore + 30, 100)
      } else if (totalRecentClicks > 5) {
        riskScore = Math.min(riskScore + 15, 100)
      }
    }

    // Log the click activity
    const { data: logResult, error: logError } = await supabase
      .rpc('log_click_activity', {
        p_ip_address: clientIP,
        p_user_agent: user_agent || '',
        p_session_id: session_id || '',
        p_action_type: action_type,
        p_risk_score: riskScore
      })

    if (logError) {
      console.error('Error logging click activity:', logError)
    }

    // Determine if the click should be allowed
    const isBlocked = riskScore >= 80 || botDetection.isBot || !logResult

    if (isBlocked) {
      console.log('Click blocked:', {
        clientIP,
        action_type,
        riskScore,
        isBot: botDetection.isBot,
        reasons: botDetection.reasons,
        recentClicks: totalRecentClicks
      })
    }

    return new Response(
      JSON.stringify({
        valid: !isBlocked,
        blocked: isBlocked,
        risk_score: riskScore,
        bot_detected: botDetection.isBot,
        bot_reasons: botDetection.reasons,
        recent_clicks: totalRecentClicks,
        session_id: session_id,
        message: isBlocked ? 'Request blocked due to suspicious activity' : 'Request validated'
      }),
      {
        status: isBlocked ? 403 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Click validation error:', error)
    
    // In case of error, allow the request but log it
    return new Response(
      JSON.stringify({
        valid: true,
        blocked: false,
        risk_score: 0,
        message: 'Validation error - request allowed',
        error: 'Internal validation error'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})