/**
 * Parse natural language date/time strings like:
 * - "next tuesday 9pm"
 * - "next to next sunday 7pm"
 * - "tomorrow 2pm"
 * - "friday 3:30pm"
 * - "in 2 hours"
 * - "next monday morning"
 * - "next wed 14:00"
 */

const DAY_NAMES: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const TIME_KEYWORDS: Record<string, [number, number]> = {
  morning: [9, 0],
  noon: [12, 0],
  afternoon: [14, 0],
  evening: [18, 0],
  night: [20, 0],
};

interface ParsedDate {
  date: Date;
  preview: string;
}

function parseTime(text: string): [number, number] | null {
  // Check time keywords first
  const lowerText = text.toLowerCase().trim();
  for (const [keyword, time] of Object.entries(TIME_KEYWORDS)) {
    if (lowerText.includes(keyword)) return time;
  }

  // Match "9pm", "9:30pm", "9:30 pm", "14:00", "2pm", "2:30pm"
  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!timeMatch) return null;

  let hours = parseInt(timeMatch[1], 10);
  const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  const period = timeMatch[3]?.toLowerCase();

  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;

  if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
    return [hours, minutes];
  }
  return null;
}

function getNextDayOfWeek(dayOfWeek: number, weeksAhead: number = 0): Date {
  const now = new Date();
  const currentDay = now.getDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) daysUntil += 7;
  daysUntil += weeksAhead * 7;
  
  const result = new Date(now);
  result.setDate(result.getDate() + daysUntil);
  return result;
}

export function parseNaturalDate(input: string): ParsedDate | null {
  if (!input || input.trim().length < 3) return null;

  const text = input.toLowerCase().trim()
    // Normalize common phrases
    .replace(/remind\s+me\s*/i, '')
    .replace(/set\s+(a\s+)?reminder\s*(for)?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return null;

  let targetDate: Date | null = null;
  let time: [number, number] | null = parseTime(text);
  const defaultTime: [number, number] = [9, 0]; // default 9am

  // "in X hours/minutes"
  const inMatch = text.match(/in\s+(\d+)\s+(hour|hr|minute|min)s?/i);
  if (inMatch) {
    const amount = parseInt(inMatch[1], 10);
    const unit = inMatch[2].toLowerCase();
    targetDate = new Date();
    if (unit.startsWith('hour') || unit.startsWith('hr')) {
      targetDate.setHours(targetDate.getHours() + amount);
    } else {
      targetDate.setMinutes(targetDate.getMinutes() + amount);
    }
    return {
      date: targetDate,
      preview: formatPreview(targetDate),
    };
  }

  // "today"
  if (/\btoday\b/.test(text)) {
    targetDate = new Date();
    if (!time) time = [17, 0]; // default 5pm for today
  }

  // "tonight"
  if (/\btonight\b/.test(text)) {
    targetDate = new Date();
    if (!time) time = [20, 0];
  }

  // "tomorrow"
  if (/\btomorrow\b/.test(text)) {
    targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 1);
  }

  // "next to next <day>" or "week after next <day>"
  const nextToNextMatch = text.match(/(?:next\s+to\s+next|week\s+after\s+next)\s+(\w+)/);
  if (nextToNextMatch) {
    const dayName = nextToNextMatch[1];
    const dayNum = DAY_NAMES[dayName];
    if (dayNum !== undefined) {
      targetDate = getNextDayOfWeek(dayNum, 1); // 1 extra week
    }
  }

  // "next <day>"  (but not if already matched "next to next")
  if (!targetDate) {
    const nextDayMatch = text.match(/next\s+(\w+)/);
    if (nextDayMatch) {
      const dayName = nextDayMatch[1];
      const dayNum = DAY_NAMES[dayName];
      if (dayNum !== undefined) {
        targetDate = getNextDayOfWeek(dayNum);
      }
      // "next week"
      if (dayName === 'week') {
        targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 7);
      }
    }
  }

  // Just a day name like "tuesday 3pm"
  if (!targetDate) {
    for (const [name, dayNum] of Object.entries(DAY_NAMES)) {
      if (text.includes(name)) {
        targetDate = getNextDayOfWeek(dayNum);
        break;
      }
    }
  }

  // "in X days"
  if (!targetDate) {
    const inDaysMatch = text.match(/in\s+(\d+)\s+days?/i);
    if (inDaysMatch) {
      const days = parseInt(inDaysMatch[1], 10);
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
    }
  }

  if (!targetDate) return null;

  // Apply time
  const [hours, minutes] = time || defaultTime;
  targetDate.setHours(hours, minutes, 0, 0);

  // Don't allow past dates
  if (targetDate <= new Date()) {
    // If it's today and the time has passed, move to tomorrow
    if (targetDate.toDateString() === new Date().toDateString()) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
  }

  return {
    date: targetDate,
    preview: formatPreview(targetDate),
  };
}

function formatPreview(date: Date): string {
  const now = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const dayName = days[date.getDay()];
  const monthName = months[date.getMonth()];
  const dayNum = date.getDate();
  
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const timeStr = minutes > 0 ? `${hours}:${String(minutes).padStart(2, '0')} ${ampm}` : `${hours} ${ampm}`;

  // Check if it's today or tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === now.toDateString()) {
    return `Today at ${timeStr}`;
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow at ${timeStr}`;
  }
  
  return `${dayName}, ${monthName} ${dayNum} at ${timeStr}`;
}

/**
 * Get suggestions based on partial input
 */
export function getNaturalDateSuggestions(input: string): string[] {
  if (!input || input.length < 2) return [];
  
  const lower = input.toLowerCase();
  const suggestions: string[] = [];
  
  if ('tomorrow'.startsWith(lower)) suggestions.push('tomorrow 9am');
  if ('next'.startsWith(lower) || lower.startsWith('next')) {
    if (!lower.includes(' ')) {
      suggestions.push('next monday 9am', 'next friday 2pm');
    }
  }
  if ('today'.startsWith(lower)) suggestions.push('today 5pm');
  if ('in'.startsWith(lower) || lower.startsWith('in ')) {
    suggestions.push('in 2 hours', 'in 30 minutes');
  }
  
  return suggestions.slice(0, 3);
}
