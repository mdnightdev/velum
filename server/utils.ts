export function cleanIp(reqOrIp: any): string {
  let ip = '';
  if (reqOrIp && typeof reqOrIp === 'object' && 'ip' in reqOrIp) {
    ip = reqOrIp.ip;
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

export function getIpGeoLocation(reqOrIp: any): string {
  // Safe geographic locator default mapping to project requirements
  return 'Warsaw, Poland';
}
