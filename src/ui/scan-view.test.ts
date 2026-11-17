import { vi } from 'vitest';
import { findPaint } from '../paints/inventory';
import { buildScanPrompt } from '../scan/scan';
import { renderScan } from './scan-view';
import { flush, makeDeps, mount } from './test-helpers';

const ticks = async (n = 10) => { for (let i = 0; i < n; i++) await flush(); };
const SCAN = `Here you go:
\`\`\`json
{"version": 1, "kind": "inventory",
 "paints": [
   {"brand": "Vallejo", "code": "72001", "name": "Dead White", "range": "Game Color", "type": "opaque", "hex": "#fafafa"},
   {"brand": "Vallejo", "code": "72.090", "name": "Black Wash", "range": "Game Wash", "type": "wash", "hex": "#1a1a1a"},
   {"brand": "Army Painter", "code": "", "name": "Dragon Red", "range": "Warpaints", "type": "opaque", "hex": "#aa1111"}
 ],
 "brushes": [{"code": "B02001", "name": "Detail 1, new"}, {"code": "0", "name": "Kolinsky detail"}]}
\`\`\``;

async function setup(answer: string | null = SCAN, sendResult: 'shared' | 'fallback' = 'shared') {
  const deps = await makeDeps({ resize: vi.fn(async (b: Blob) => b) });
  deps.bridge.readAnswer.mockResolvedValue(answer);
  deps.bridge.send.mockResolvedValue(sendResult);
  const root = mount();
  await renderScan(root, deps);
  return { deps, root };
}
const $ = <T extends HTMLElement = HTMLElement>(root: HTMLElement, id: string) => root.querySelector<T>(`[data-testid="${id}"]`)!;
const pickPhoto = (root: HTMLElement) => {
  const input = $<HTMLInputElement>(root, 'scan-photo');
  Object.defineProperty(input, 'files', { value: [new File(['photo'], 'p.jpg', { type: 'image/jpeg' })] });
  input.dispatchEvent(new Event('change'));
};
const type = (root: HTMLElement, id: string, value: string) => {
  const input = $<HTMLInputElement>(root, id);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('add from a photo', () => {
  it('sends the photo with the scan instructions', async () => {
    const { deps, root } = await setup();
    pickPhoto(root);
    $(root, 'scan-send').click();
    await ticks();
    expect(deps.bridge.send.mock.calls[0][0].text).toBe(buildScanPrompt());
    expect(deps.bridge.send.mock.calls[0][0].image.size).toBe(5);
  });

  it('without a photo it asks for one and sends nothing', async () => {
    const { deps, root } = await setup();
    $(root, 'scan-send').click();
    await ticks();
    expect($(root, 'scan-status').textContent).not.toBe('');
    expect(deps.bridge.send).not.toHaveBeenCalled();
  });

  it('when sharing is not possible the instructions are shown to copy', async () => {
    const { root } = await setup(SCAN, 'fallback');
    pickPhoto(root);
    $(root, 'scan-send').click();
    await ticks();
    expect($<HTMLTextAreaElement>(root, 'scan-prompt').hidden).toBe(false);
    expect($<HTMLTextAreaElement>(root, 'scan-prompt').value).toBe(buildScanPrompt());
  });

  it('an answer it cannot use shows why and no list', async () => {
    const { root } = await setup('Sorry, the photo is too blurry.');
    $(root, 'scan-paste').click();
    await ticks();
    expect($(root, 'scan-errors').textContent).toContain('no JSON found in the answer');
    expect(root.querySelector('[data-testid="scan-list"]')).toBeNull();
  });

  it('without clipboard access it offers a box to paste into', async () => {
    const { root } = await setup(null);
    $(root, 'scan-paste').click();
    await ticks();
    type(root, 'scan-answer', SCAN);
    $(root, 'scan-read').click();
    await ticks();
    expect(root.querySelector('[data-testid="scan-list"]')).not.toBeNull();
  });

  it('the list waits for confirmation, and saving adds only what is ticked', async () => {
    const { deps, root } = await setup();
    $(root, 'scan-paste').click();
    await ticks();

    expect($<HTMLInputElement>(root, 'scan-paint-include-0').checked).toBe(true);
    expect($<HTMLInputElement>(root, 'scan-paint-include-1').checked).toBe(true);
    expect($<HTMLInputElement>(root, 'scan-paint-include-2').disabled).toBe(true);
    expect((await deps.repo.getInventory()).paints).toHaveLength(48);

    $<HTMLInputElement>(root, 'scan-brush-include-1').click();
    $(root, 'scan-save').click();
    await ticks();

    const inv = await deps.repo.getInventory();
    expect(inv.paints).toHaveLength(49);
    const white = findPaint(inv, { brand: 'Vallejo', code: '72.001' })!;
    expect(white.name).toBe('Dead White');
    expect(white.family?.name).toBe('BSL Black');
    expect(inv.paints.some((p) => p.name === 'Dragon Red')).toBe(false);
    expect(inv.brushes[0]).toEqual({ code: 'B02001', name: 'Detail 1, new' });
    expect(inv.brushes).toHaveLength(3);
    expect(deps.navigate).toHaveBeenCalledWith('#/inventory');
  });

  it('typing a missing code completes the item so it can be added', async () => {
    const { deps, root } = await setup();
    $(root, 'scan-paste').click();
    await ticks();

    type(root, 'scan-paint-code-2', 'WP1105');
    expect($<HTMLInputElement>(root, 'scan-paint-include-2').disabled).toBe(false);
    expect($<HTMLInputElement>(root, 'scan-paint-include-2').checked).toBe(true);
    $(root, 'scan-save').click();
    await ticks();
    expect(findPaint(await deps.repo.getInventory(), { brand: 'Army Painter', code: 'WP1105' })?.name).toBe('Dragon Red');
  });

  it('discarding the list saves nothing and goes back to the steps', async () => {
    const { deps, root } = await setup();
    $(root, 'scan-paste').click();
    await ticks();
    $(root, 'scan-discard').click();
    await ticks();
    expect(root.querySelector('[data-testid="scan-list"]')).toBeNull();
    expect(root.querySelector('[data-testid="scan-send"]')).not.toBeNull();
    expect((await deps.repo.getInventory()).paints).toHaveLength(48);
  });
});
