import { vi } from 'vitest';
import { createShareBridge } from './share-bridge';

const pkg = { text: 'PROMPT', image: new Blob(['img'], { type: 'image/jpeg' }) };

function fakeNavigator(over: Record<string, unknown> = {}) {
  const writeText = vi.fn().mockResolvedValue(undefined);
  const readText = vi.fn().mockResolvedValue('ANSWER');
  return { clipboard: { writeText, readText }, ...over } as unknown as Navigator & {
    clipboard: { writeText: ReturnType<typeof vi.fn>; readText: ReturnType<typeof vi.fn> };
  };
}

function downloads() {
  const clicked: string[] = [];
  const spy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this.download);
  });
  return { clicked, restore: () => spy.mockRestore() };
}

beforeAll(() => {
  (URL as unknown as { createObjectURL: () => string }).createObjectURL ??= () => 'blob:fake';
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL ??= () => undefined;
});

describe('share bridge', () => {
  it('shares text and the photo as a file when the device can share files', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const nav = fakeNavigator({ share, canShare: () => true });
    const result = await createShareBridge({ navigator: nav }).send(pkg);
    expect(result).toBe('shared');
    const arg = share.mock.calls[0][0] as ShareData;
    expect(arg.text).toBe('PROMPT');
    expect(arg.files?.[0]).toBeInstanceOf(File);
  });

  it('copies the prompt and downloads the photo when files cannot be shared', async () => {
    const nav = fakeNavigator({ canShare: () => false });
    const d = downloads();
    const result = await createShareBridge({ navigator: nav }).send(pkg);
    d.restore();
    expect(result).toBe('fallback');
    expect(nav.clipboard.writeText).toHaveBeenCalledWith('PROMPT');
    expect(d.clicked).toHaveLength(1);
  });

  it('falls back when the user cancels the share sheet', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'));
    const nav = fakeNavigator({ share, canShare: () => true });
    const d = downloads();
    const result = await createShareBridge({ navigator: nav }).send(pkg);
    d.restore();
    expect(result).toBe('fallback');
    expect(nav.clipboard.writeText).toHaveBeenCalledWith('PROMPT');
  });

  it('reads the pasted answer from the clipboard', async () => {
    expect(await createShareBridge({ navigator: fakeNavigator() }).readAnswer()).toBe('ANSWER');
  });

  it('returns null when reading the clipboard is denied', async () => {
    const nav = fakeNavigator();
    nav.clipboard.readText.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    expect(await createShareBridge({ navigator: nav }).readAnswer()).toBeNull();
  });
});

describe('share bridge — prompt safety', () => {
  it('copies the prompt to the clipboard before sharing, in case the share target drops the text', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const nav = fakeNavigator({ share, canShare: () => true });
    await createShareBridge({ navigator: nav }).send(pkg);
    expect(nav.clipboard.writeText).toHaveBeenCalledWith('PROMPT');
  });
});
