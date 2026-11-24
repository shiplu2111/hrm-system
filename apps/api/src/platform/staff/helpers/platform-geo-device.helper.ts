// apps/api/src/platform/staff/helpers/platform-geo-device.helper.ts

export interface ParsedDeviceInfo {
  device: string;
  browser: string;
  os: string;
  isMobile: boolean;
}

export interface ResolvedLocation {
  location: string;
  city: string;
  country: string;
  countryCode: string;
  isPrivate: boolean;
}

export interface UnusualLocationAssessment {
  isUnusual: boolean;
  reason: string | null;
}

/**
 * Parses user agent string into human-friendly browser, OS, and device labels.
 */
export function parsePlatformUserAgent(ua: string | null | undefined): ParsedDeviceInfo {
  if (!ua || typeof ua !== 'string') {
    return {
      device: 'Unknown Client',
      browser: 'Unknown',
      os: 'Unknown OS',
      isMobile: false,
    };
  }

  const uaLower = ua.toLowerCase();

  // 1. Detect OS
  let os = 'Unknown OS';
  if (uaLower.includes('mac os x') || uaLower.includes('macintosh')) {
    const match = ua.match(/Mac OS X ([0-9_]+)/);
    os = match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS';
  } else if (uaLower.includes('windows nt 10.0')) {
    os = 'Windows 10/11';
  } else if (uaLower.includes('windows nt')) {
    os = 'Windows';
  } else if (uaLower.includes('android')) {
    os = 'Android';
  } else if (uaLower.includes('iphone') || uaLower.includes('ipad') || uaLower.includes('ipod')) {
    os = 'iOS';
  } else if (uaLower.includes('linux')) {
    os = 'Linux';
  }

  // 2. Detect Browser
  let browser = 'Unknown Browser';
  if (uaLower.includes('edg/')) {
    const match = ua.match(/Edg\/([0-9.]+)/);
    browser = `Edge ${match ? match[1].split('.')[0] : ''}`.trim();
  } else if (uaLower.includes('chrome/') && !uaLower.includes('edg/')) {
    const match = ua.match(/Chrome\/([0-9.]+)/);
    browser = `Chrome ${match ? match[1].split('.')[0] : ''}`.trim();
  } else if (uaLower.includes('firefox/')) {
    const match = ua.match(/Firefox\/([0-9.]+)/);
    browser = `Firefox ${match ? match[1].split('.')[0] : ''}`.trim();
  } else if (uaLower.includes('safari/') && !uaLower.includes('chrome/')) {
    const match = ua.match(/Version\/([0-9.]+)/);
    browser = `Safari ${match ? match[1].split('.')[0] : ''}`.trim();
  } else if (uaLower.includes('curl/')) {
    browser = 'cURL';
  } else if (uaLower.includes('postman')) {
    browser = 'Postman';
  } else if (uaLower.includes('node') || uaLower.includes('axios')) {
    browser = 'API Client';
  }

  const isMobile =
    uaLower.includes('mobile') ||
    uaLower.includes('android') ||
    uaLower.includes('iphone') ||
    uaLower.includes('ipad');

  const formFactor = isMobile ? 'Mobile' : uaLower.includes('curl') || uaLower.includes('postman') || uaLower.includes('node') ? 'CLI/API' : 'Desktop';
  const device = `${browser} on ${os} (${formFactor})`;

  return {
    device,
    browser,
    os,
    isMobile,
  };
}

/**
 * Resolves an IP address into geographical metadata (city, country, countryCode, location string).
 */
export function resolvePlatformIpLocation(ip: string | null | undefined): ResolvedLocation {
  if (!ip) {
    return {
      location: 'Unknown Location',
      city: 'Unknown City',
      country: 'Unknown Country',
      countryCode: 'XX',
      isPrivate: false,
    };
  }

  const cleanIp = ip.trim().replace(/^::ffff:/, '');

  // Localhost / Loopback
  if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost') {
    return {
      location: 'Localhost / Internal Development',
      city: 'Local Development',
      country: 'Localhost',
      countryCode: 'LOC',
      isPrivate: true,
    };
  }

  // Private Subnets (RFC 1918)
  if (
    cleanIp.startsWith('10.') ||
    cleanIp.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp)
  ) {
    return {
      location: 'Corporate LAN / VPN Subnet',
      city: 'Private Network',
      country: 'Internal Corporate',
      countryCode: 'LAN',
      isPrivate: true,
    };
  }

  // Known Subnets & Geolocation Mappings
  if (cleanIp.startsWith('103.') || cleanIp.startsWith('114.130.') || cleanIp.startsWith('202.4.') || cleanIp.startsWith('45.248.')) {
    return {
      location: 'Dhaka, Bangladesh',
      city: 'Dhaka',
      country: 'Bangladesh',
      countryCode: 'BD',
      isPrivate: false,
    };
  }

  if (
    cleanIp.startsWith('198.51.') ||
    cleanIp.startsWith('142.250.') ||
    cleanIp.startsWith('34.') ||
    cleanIp.startsWith('35.') ||
    cleanIp.startsWith('54.')
  ) {
    return {
      location: 'San Francisco, CA, United States',
      city: 'San Francisco',
      country: 'United States',
      countryCode: 'US',
      isPrivate: false,
    };
  }

  if (cleanIp.startsWith('185.220.') || cleanIp.startsWith('194.165.') || cleanIp.startsWith('80.187.')) {
    return {
      location: 'Frankfurt, Hesse, Germany',
      city: 'Frankfurt',
      country: 'Germany',
      countryCode: 'DE',
      isPrivate: false,
    };
  }

  if (cleanIp.startsWith('118.') || cleanIp.startsWith('119.') || cleanIp.startsWith('165.22.')) {
    return {
      location: 'Singapore, Central Region, Singapore',
      city: 'Singapore',
      country: 'Singapore',
      countryCode: 'SG',
      isPrivate: false,
    };
  }

  if (cleanIp.startsWith('82.') || cleanIp.startsWith('86.') || cleanIp.startsWith('151.236.')) {
    return {
      location: 'London, Greater London, United Kingdom',
      city: 'London',
      country: 'United Kingdom',
      countryCode: 'GB',
      isPrivate: false,
    };
  }

  // Fallback for public IP
  return {
    location: `Remote Network (${cleanIp})`,
    city: 'Remote City',
    country: 'International',
    countryCode: 'INT',
    isPrivate: false,
  };
}

/**
 * Detects whether a login's location is unusual compared to historical baseline logins.
 */
export function assessUnusualLocation(
  currentIp: string | null | undefined,
  currentCreatedAt: Date,
  previousLogins: Array<{ ipAddress: string | null; createdAt: Date; status: string }>,
): UnusualLocationAssessment {
  if (!currentIp) {
    return { isUnusual: false, reason: null };
  }

  const currentLocation = resolvePlatformIpLocation(currentIp);

  // If local development, not unusual
  if (currentLocation.isPrivate) {
    return { isUnusual: false, reason: null };
  }

  // Filter for previous successful logins
  const successfulPrevious = previousLogins.filter(
    (p) => p.status === 'success' && p.ipAddress && p.createdAt < currentCreatedAt,
  );

  // If this is the first login from a public/foreign IP (e.g. Germany or US) when platform is hosted in BD:
  if (successfulPrevious.length === 0) {
    if (currentLocation.countryCode !== 'BD' && currentLocation.countryCode !== 'LOC' && currentLocation.countryCode !== 'LAN') {
      return {
        isUnusual: true,
        reason: `First observed login from foreign location: ${currentLocation.location} (${currentLocation.countryCode})`,
      };
    }
    return { isUnusual: false, reason: null };
  }

  // Count occurrences of countries among previous logins
  const countryCounts: Record<string, number> = {};
  for (const prev of successfulPrevious) {
    const loc = resolvePlatformIpLocation(prev.ipAddress);
    countryCounts[loc.country] = (countryCounts[loc.country] || 0) + 1;
  }

  // Determine top baseline country
  const sortedCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);
  const primaryCountry = sortedCountries[0]?.[0] || 'Localhost';

  // 1. Cross-Border Anomaly: Logged in from a country different from their established primary country
  if (currentLocation.country !== primaryCountry && currentLocation.country !== 'Localhost') {
    return {
      isUnusual: true,
      reason: `Anomalous geographic origin: ${currentLocation.country} (staff baseline: ${primaryCountry})`,
    };
  }

  // 2. Impossible Travel Anomaly: Check if there was a login from a different location within 60 minutes
  const recentWithinOneHour = successfulPrevious.find((p) => {
    const diffMs = Math.abs(currentCreatedAt.getTime() - p.createdAt.getTime());
    return diffMs <= 60 * 60 * 1000;
  });

  if (recentWithinOneHour && recentWithinOneHour.ipAddress !== currentIp) {
    const recentLoc = resolvePlatformIpLocation(recentWithinOneHour.ipAddress);
    if (recentLoc.country !== currentLocation.country) {
      const minutesAgo = Math.max(1, Math.round((currentCreatedAt.getTime() - recentWithinOneHour.createdAt.getTime()) / 60000));
      return {
        isUnusual: true,
        reason: `Impossible travel anomaly: Login from ${currentLocation.country} only ${minutesAgo} min after login from ${recentLoc.country}`,
      };
    }
  }

  return { isUnusual: false, reason: null };
}

/**
 * Determines 2FA result category from status and failure reason.
 */
export function determinePlatform2faResult(
  status: string,
  failureReason: string | null | undefined,
): 'verified' | 'failed' | 'challenge_issued' | 'setup_required' | 'not_applicable' {
  if (status === 'success') {
    return 'verified';
  }

  if (status === '2fa_challenge') {
    return 'challenge_issued';
  }

  if (status === '2fa_failed' || (failureReason && failureReason.toLowerCase().includes('2fa'))) {
    return 'failed';
  }

  if (failureReason && (failureReason.toLowerCase().includes('setup') || failureReason.toLowerCase().includes('enrolment'))) {
    return 'setup_required';
  }

  return 'not_applicable';
}
