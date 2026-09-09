/**
 * Device & Hardware Model Parser for Digital Forensic Audits
 */
export function parseDeviceModel(userAgent?: string | null, platform?: string | null, webglRenderer?: string | null): {
  device: string;
  os: string;
  browser: string;
} {
  if (!userAgent && !platform) {
    return { device: 'Unknown Device', os: 'Unknown OS', browser: 'Unknown Client' };
  }

  const ua = userAgent || '';
  let device = 'Generic Device';
  let os = platform || 'Unknown OS';
  let browser = 'Unknown';

  // 1. Detect Specific Device Brands and Models
  // Samsung
  if (/SM-S93\d/i.test(ua)) device = 'Samsung Galaxy S25';
  else if (/SM-S92\d/i.test(ua)) device = 'Samsung Galaxy S24';
  else if (/SM-S91\d/i.test(ua)) device = 'Samsung Galaxy S23';
  else if (/SM-S90\d/i.test(ua)) device = 'Samsung Galaxy S22';
  else if (/SM-G9\d\d/i.test(ua) || /SM-A\d\d/i.test(ua) || /SM-M\d\d/i.test(ua)) device = 'Samsung Galaxy';
  else if (/SAMSUNG/i.test(ua)) device = 'Samsung Phone';
  // Huawei / Honor
  else if (/HUAWEI|HarmonyOS|ALP-|EML-|VOG-|NOH-|TAS-|ANA-/i.test(ua)) device = 'Huawei Device';
  else if (/HONOR/i.test(ua)) device = 'Honor Phone';
  // Xiaomi / Redmi / POCO
  else if (/Redmi/i.test(ua)) device = 'Xiaomi Redmi';
  else if (/POCO/i.test(ua)) device = 'Xiaomi POCO';
  else if (/Mi \d|Xiaomi/i.test(ua)) device = 'Xiaomi Phone';
  // Google Pixel
  else if (/Pixel 9/i.test(ua)) device = 'Google Pixel 9';
  else if (/Pixel 8/i.test(ua)) device = 'Google Pixel 8';
  else if (/Pixel 7/i.test(ua)) device = 'Google Pixel 7';
  else if (/Pixel/i.test(ua)) device = 'Google Pixel';
  // Apple
  else if (/iPhone/i.test(ua)) {
    const match = ua.match(/OS (\d+_\d+)/);
    const osVer = match ? `iOS ${match[1].replace('_', '.')}` : 'iOS';
    device = 'Apple iPhone';
    os = osVer;
  } else if (/iPad/i.test(ua)) {
    device = 'Apple iPad';
    os = 'iPadOS';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    device = 'Apple Mac';
    os = 'macOS';
  }
  // Termux / Android Node
  else if (/Android.*Termux/i.test(ua) || /com\.termux/i.test(ua)) {
    device = 'Termux Android Node';
    os = 'Android / Linux';
  } else if (/Android/i.test(ua)) {
    const androidMatch = ua.match(/Android\s+([\d\.]+)/i);
    device = 'Android Device';
    os = androidMatch ? `Android ${androidMatch[1]}` : 'Android';
  }
  // Desktop OS
  else if (/Windows NT 10.0/i.test(ua)) {
    device = 'Windows PC';
    os = 'Windows 10/11 x64';
  } else if (/Windows NT 6\./i.test(ua)) {
    device = 'Windows PC';
    os = 'Windows 7/8';
  } else if (/Linux/i.test(ua)) {
    device = 'Linux Station';
    os = 'Linux x86_64';
  }

  // 2. Detect Browser / Client
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Google Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Apple Safari';
  else if (/Velum-Cli/i.test(ua)) browser = 'Velum CLI Shell';
  else if (/Postman|curl|wget/i.test(ua)) browser = 'API Client';

  // Augment with WebGL GPU if available
  if (webglRenderer && !device.includes('Apple') && !device.includes('Samsung')) {
    if (/Mali/i.test(webglRenderer)) device += ' (ARM Mali)';
    else if (/Adreno/i.test(webglRenderer)) device += ' (Qualcomm Adreno)';
    else if (/NVIDIA|GeForce/i.test(webglRenderer)) device += ' (NVIDIA GPU)';
    else if (/Radeon|AMD/i.test(webglRenderer)) device += ' (AMD Radeon)';
  }

  return { device, os, browser };
}

import geoip from 'geoip-lite';

/**
 * IP Location Resolver with GeoIP Country & City Intelligence
 */
export function parseLocation(ip?: string | null): string {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return 'Localhost (Dev)';
  }
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.16.') || ip.startsWith('172.31.')) {
    return 'LAN (Private Subnet)';
  }
  if (ip.startsWith('100.64.') || ip.startsWith('100.')) {
    return 'Carrier CGNAT';
  }

  try {
    const geo = geoip.lookup(ip);
    if (geo) {
      const parts = [];
      if (geo.city) parts.push(geo.city);
      if (geo.country) parts.push(geo.country);
      return parts.length > 0 ? parts.join(', ') : 'Public WAN';
    }
  } catch {
    // Fallback if lookup fails
  }

  return 'Public WAN';
}
