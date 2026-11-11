import { registerSW } from 'virtual:pwa-register';

// `autoUpdate` reloads open windows once the browser detects a new build, but a service
// worker only looks when it registers. An installed app left open keeps the version it
// started with, so ask the network periodically (same pattern as Pomodoro Fantasy).
const CHECK_EVERY_MS = 30 * 60 * 1000;

export const registerServiceWorker = (): void => {
  registerSW({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      setInterval(async () => {
        if (registration.installing) return;
        if (!navigator.onLine) return;
        try {
          const response = await fetch(swUrl, {
            cache: 'no-store',
            headers: { cache: 'no-store', 'cache-control': 'no-cache' },
          });
          if (response?.status === 200) await registration.update();
        } catch {
          // Offline or server down: try again next interval.
        }
      }, CHECK_EVERY_MS);
    },
  });
};
