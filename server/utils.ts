export function cleanIp(reqOrIp: any): string {
  let ip = '';
  if (reqOrIp && typeof reqOrIp === 'object') {
    if ('headers' in reqOrIp && reqOrIp.headers) {
      const forwarded = reqOrIp.headers['x-forwarded-for'] || reqOrIp.headers['x-real-ip'];
      if (typeof forwarded === 'string') {
        ip = forwarded.split(',')[0].trim();
      } else if (Array.isArray(forwarded) && forwarded.length > 0) {
        ip = forwarded[0].trim();
      }
    }
    if (!ip && 'ip' in reqOrIp) {
      ip = reqOrIp.ip;
    }
  } else if (typeof reqOrIp === 'string') {
    ip = reqOrIp;
  }
  
  if (!ip) return '127.0.0.1';
  if (ip.startsWith('::ffff:')) {
    return ip.slice(7);
  }
  if (ip === '::1') {
    return '127.0.0.1';
  }
  return ip;
}

const geoCache = new Map<string, string>();

export async function getIpGeoLocation(reqOrIp: any): Promise<string> {
  const ip = cleanIp(reqOrIp);
  
  // Private and local IP ranges filter
  if (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.2') ||
    ip.startsWith('172.3') ||
    ip.startsWith('169.254.')
  ) {
    return 'Local Loopback';
  }

  if (geoCache.has(ip)) {
    return geoCache.get(ip)!;
  }

  try {
    // Dynamic dynamic IP geolocation fetch with 1.8s timeout
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 1800);
    
    const response = await fetch(`http://ip-api.com/json/${ip}`, {
      signal: controller.signal
    });
    clearTimeout(id);

    if (response.ok) {
      const data = await response.json() as any;
      if (data && data.status === 'success' && data.city && data.country) {
        const resolved = `${data.city}, ${data.country}`;
        geoCache.set(ip, resolved);
        return resolved;
      }
    }
  } catch (err) {
    console.warn(`[GEOLOCATOR] Failed resolving public IP geo for ${ip}:`, err);
  }

  return 'Warsaw, Poland';
}
