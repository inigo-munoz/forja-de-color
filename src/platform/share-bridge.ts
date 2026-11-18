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
    [pkg.image, ...(pkg.extraImages ?? [])].forEach((img, i) => {
      const url = URL.createObjectURL(img);
      const a = doc.createElement('a');
      a.href = url;
      a.download = i === 0 ? 'forja-de-color.jpg' : `forja-de-color-${i + 1}.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    return 'fallback';
  }

  return {
    async send(pkg) {
      const files = [pkg.image, ...(pkg.extraImages ?? [])].map((img, i) =>
        new File([img], i === 0 ? 'forja-de-color.jpg' : `forja-de-color-${i + 1}.jpg`, { type: img.type || 'image/jpeg' }));
      const data: ShareData = { text: pkg.text, files };
      if (typeof nav.share === 'function' && nav.canShare?.(data)) {
        // Some share targets keep the image and drop the text: keep the prompt on the clipboard too.
        try {
          await nav.clipboard?.writeText(pkg.text);
        } catch {
          // Not fatal: the share itself still carries the text.
        }
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
