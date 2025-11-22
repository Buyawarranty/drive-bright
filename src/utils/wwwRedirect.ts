// Client-side www to non-www redirect
// This runs as a fallback if server-side redirect is not configured

export const redirectWwwToNonWww = () => {
  if (typeof window === 'undefined') return;
  
  const hostname = window.location.hostname;
  
  // Check if currently on www subdomain
  if (hostname.startsWith('www.')) {
    const nonWwwUrl = window.location.href.replace('www.', '');
    
    // Perform 301-equivalent redirect (browser will cache this)
    window.location.replace(nonWwwUrl);
  }
};

// Auto-execute on module load
if (typeof window !== 'undefined' && window.location.hostname.startsWith('www.')) {
  redirectWwwToNonWww();
}
