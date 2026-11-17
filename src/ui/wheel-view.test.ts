import type { Paint } from '../paints/paint';
import { renderWheel } from './wheel-view';
import { makeDeps, mount } from './test-helpers';

const paint = (code: string, name: string, hex: string, type: Paint['type'] = 'opaque'): Paint => ({
  brand: 'Vallejo', code, name, range: 'Game Color', type, hex,
});

async function depsWithPaints() {
  const deps = await makeDeps();
  await deps.repo.saveInventory({
    paints: [
      paint('72.011', 'Test Scarlet', '#c02321'),
      paint('72.029', 'Test Moss', '#2e6b2e'),
      paint('72.051', 'Test Black', '#000000'),
      paint('72.052', 'Test Gold', '#d4af37', 'metallic'),
    ],
    brushes: [],
  });
  return deps;
}

const text = (root: HTMLElement, testid: string) => root.querySelector(`[data-testid="${testid}"]`)?.textContent ?? '';

describe('colour wheel view', () => {
  it('before choosing, shows the 12 colours, invites a tap and lists the neutral paints', async () => {
    const root = mount();
    await renderWheel(root, await depsWithPaints());

    expect(root.querySelectorAll('[data-testid^="sector-"]')).toHaveLength(12);
    expect(root.querySelector('[data-testid="sector-red"]')!.getAttribute('aria-label')).toBe('Red');
    expect(root.querySelector('[data-testid="wheel-hint"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="harmony-complementary"]')).toBeNull();
    expect(text(root, 'wheel-neutrals')).toContain('Test Black');
    expect(text(root, 'wheel-neutrals')).toContain('Test Gold');
  });

  it("with red chosen, shows its harmonies with the user's paints in each colour", async () => {
    const root = mount();
    await renderWheel(root, await depsWithPaints(), 'red');

    expect(root.querySelector('[data-testid="wheel-hint"]')).toBeNull();
    expect(root.querySelector('[data-testid="sector-red"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(text(root, 'wheel-selected')).toContain('Red');
    expect(text(root, 'wheel-selected')).toContain('Primary');
    expect(text(root, 'wheel-selected')).toContain('Test Scarlet');
    expect(text(root, 'harmony-complementary')).toContain('Green');
    expect(text(root, 'harmony-complementary')).toContain('Test Moss');
    expect(text(root, 'harmony-analogous')).toContain('Red-orange');
    expect(text(root, 'harmony-analogous')).toContain('Red-violet');
    const triad = root.querySelector('[data-testid="harmony-triad"]')!;
    expect(triad.textContent).toContain('Yellow');
    expect(triad.textContent).toContain('Blue');
    expect(triad.querySelectorAll('[data-testid="no-paints"]')).toHaveLength(2);
  });

  it('tapping a colour opens it in the address, so it survives a reload', async () => {
    const root = mount();
    const deps = await depsWithPaints();
    await renderWheel(root, deps);

    root.querySelector<SVGElement>('[data-testid="sector-green"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(deps.navigate).toHaveBeenCalledWith('#/wheel/green');
  });
});
