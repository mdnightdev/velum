export async function collectDeviceFingerprint() {
  const fingerprint = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    deviceMemory: (navigator as any).deviceMemory || 0,
    webglVendor: '',
    webglRenderer: ''
  };

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        fingerprint.webglVendor = (gl as any).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        fingerprint.webglRenderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      }
    }
  } catch (e) {
    console.warn('WebGL fingerprint collection failed:', e);
  }

  // Generate device ID from fingerprint
  const fingerprintString = JSON.stringify(fingerprint);
  const encoder = new TextEncoder();
  const data = encoder.encode(fingerprintString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const deviceId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);

  return {
    deviceId,
    fingerprintData: fingerprint
  };
}

export async function recordDeviceAccess() {
  try {
    const { deviceId, fingerprintData } = await collectDeviceFingerprint();
    
    const response = await fetch('/v2/auth/device-fingerprint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        fingerprintData,
        ipAddress: '' // Server will get this from request
      })
    });

    if (response.ok) {
      const data = await response.json();
      return { deviceId, anomalyCheck: data.anomalyCheck };
    }
  } catch (error) {
    console.warn('Device fingerprint recording failed:', error);
  }
  
  return null;
}