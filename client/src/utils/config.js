/**
 * Utility to resolve backend server URL for web and Capacitor native Android
 */
export function getBackendUrl() {
  if (typeof window === 'undefined') return 'http://localhost:3000';

  // 1. Check if user manually saved a custom server URL in settings
  const savedUrl = localStorage.getItem('vision_server_url');
  if (savedUrl && savedUrl.trim() !== '') {
    return savedUrl.trim().replace(/\/$/, '');
  }

  // 2. Check if running inside Capacitor Android native app
  const isCapacitor = Boolean(window.Capacitor || window.CapacitorNative);
  if (isCapacitor) {
    // Default candidate host IP on local Wi-Fi subnet
    return 'http://192.168.29.240:3000';
  }

  // 3. Standalone web browser mode:
  // If running on frontend dev port (5173, 5174, etc.), route backend API requests to port 3000
  if (window.location.port && window.location.port !== '3000') {
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }

  return window.location.origin;
}

export function setBackendUrl(url) {
  if (url) {
    const formatted = url.trim().replace(/\/$/, '');
    localStorage.setItem('vision_server_url', formatted);
  } else {
    localStorage.removeItem('vision_server_url');
  }
}

/**
 * Auto-discovers Vision server on local Wi-Fi subnet
 */
export async function discoverLanServer() {
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';

  const candidates = [
    getBackendUrl(),
    `${protocol}//${currentHost}:3000`,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.29.240:3000',
    'http://192.168.1.100:3000',
    'http://192.168.0.100:3000',
    'http://192.168.1.50:3000',
    'http://192.168.29.1:3000',
    'http://10.0.0.2:3000'
  ];

  const uniqueCandidates = Array.from(new Set(candidates)).filter(Boolean);

  for (const url of uniqueCandidates) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const res = await fetch(`${url}/api/ip`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && (data.rawIp || data.serverTime)) {
          setBackendUrl(url);
          return url;
        }
      }
    } catch (e) {
      // Continue searching
    }
  }

  return null;
}
