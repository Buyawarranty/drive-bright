/**
 * Reads what we can safely tell about the machine a member of staff is using,
 * so a "the dashboard is slow" report arrives with its own context attached and
 * nobody has to type out their browser version.
 *
 * Nothing here is personal data — no names, no cookies, no tokens.
 */

export interface SystemEnvironment {
  browser: string | null;
  browser_version: string | null;
  os: string | null;
  device_type: string | null;
  screen_size: string | null;
  connection_type: string | null;
  downlink_mbps: number | null;
  device_memory_gb: number | null;
  cpu_cores: number | null;
  page_load_ms: number | null;
  user_agent: string | null;
  route: string | null;
}

const detectBrowser = (ua: string): { name: string; version: string | null } => {
  const tests: Array<[string, RegExp]> = [
    ['Edge', /Edg\/([\d.]+)/],
    ['Opera', /OPR\/([\d.]+)/],
    ['Samsung Internet', /SamsungBrowser\/([\d.]+)/],
    ['Chrome', /Chrome\/([\d.]+)/],
    ['Firefox', /Firefox\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari/],
  ];
  for (const [name, re] of tests) {
    const m = ua.match(re);
    if (m) return { name, version: m[1] ?? null };
  }
  return { name: 'Other', version: null };
};

const detectOs = (ua: string): string => {
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
  if (/Windows NT 6\.3/.test(ua)) return 'Windows 8.1';
  if (/Windows NT 6\.1/.test(ua)) return 'Windows 7';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Other';
};

const detectDeviceType = (ua: string, width: number): string => {
  if (/iPad|Tablet/.test(ua) || (width >= 768 && width < 1024 && /Android/.test(ua))) return 'Tablet';
  if (/Mobi|iPhone|Android/.test(ua)) return 'Phone';
  return 'Desktop / laptop';
};

export function captureSystemEnvironment(): SystemEnvironment {
  if (typeof window === 'undefined') {
    return {
      browser: null,
      browser_version: null,
      os: null,
      device_type: null,
      screen_size: null,
      connection_type: null,
      downlink_mbps: null,
      device_memory_gb: null,
      cpu_cores: null,
      page_load_ms: null,
      user_agent: null,
      route: null,
    };
  }

  const nav = window.navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number; type?: string };
    deviceMemory?: number;
  };
  const ua = nav.userAgent || '';
  const browser = detectBrowser(ua);
  const width = window.screen?.width ?? window.innerWidth;
  const height = window.screen?.height ?? window.innerHeight;

  let pageLoadMs: number | null = null;
  try {
    const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (entry && entry.duration > 0) pageLoadMs = Math.round(entry.duration);
  } catch {
    /* timing unavailable — not important */
  }

  const conn = nav.connection;

  return {
    browser: browser.name,
    browser_version: browser.version,
    os: detectOs(ua),
    device_type: detectDeviceType(ua, width),
    screen_size: width && height ? `${width}x${height}` : null,
    connection_type: conn?.effectiveType || conn?.type || null,
    downlink_mbps: typeof conn?.downlink === 'number' ? conn.downlink : null,
    device_memory_gb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    cpu_cores: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    page_load_ms: pageLoadMs,
    user_agent: ua ? ua.slice(0, 500) : null,
    route: `${window.location.pathname}${window.location.search}`.slice(0, 300),
  };
}

/** Plain-English one-liner describing a report's machine. */
export function describeEnvironment(e: Partial<SystemEnvironment>): string {
  const bits = [
    e.browser ? `${e.browser}${e.browser_version ? ` ${e.browser_version.split('.')[0]}` : ''}` : null,
    e.os,
    e.device_type,
    e.screen_size,
    e.connection_type,
    typeof e.downlink_mbps === 'number' ? `${e.downlink_mbps} Mbps` : null,
    typeof e.cpu_cores === 'number' ? `${e.cpu_cores} cores` : null,
    typeof e.device_memory_gb === 'number' ? `${e.device_memory_gb} GB memory` : null,
  ].filter(Boolean);
  return bits.length ? bits.join(' · ') : 'Setup not reported';
}
