import type { AdvisorBridge } from '../advice/bridge';
import type { AdvicePackage } from '../advice/schema';

interface Env {
  navigator?: Navigator;
  document?: Document;
}

// Adapter for the AdvisorBridge port: the system share sheet when the device can share files
// (Android), otherwise copy the prompt + download the photo so the user pastes both by hand
// (desktop Linux, Firefox, or when the share sheet is cancelled).
export function createShareBridge(env: Env = {}): AdvisorBridge {
  const nav = env.navigator ?? navigator;
  const doc = env.document ?? document;

  async function fallback(pkg: AdvicePackage): Promise<'fallback'> {
    try {
      await nav.clipboard?.writeText(pkg.text);
    } catch {
      // Clipboard denied: the UI still shows the prompt to copy by hand.
    }
    const url = URL.createObjectURL(pkg.image);
    const a = doc.createElement('a');
    a.href = url;
    a.download = 'forja-de-color.jpg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'fallback';
  }

  return {
    async send(pkg) {
      const file = new File([pkg.image], 'forja-de-color.jpg', { type: pkg.image.type || 'image/jpeg' });
      const data: ShareData = { text: pkg.text, files: [file] };
      if (typeof nav.share === 'function' && nav.canShare?.(data)) {
        try {
          await nav.share(data);
          return 'shared';
        } catch {
          return fallback(pkg);
        }
      }
      return fallback(pkg);
    },
    async readAnswer() {
      try {
        return (await nav.clipboard?.readText()) ?? null;
      } catch {
        return null;
      }
    },
  };
}
