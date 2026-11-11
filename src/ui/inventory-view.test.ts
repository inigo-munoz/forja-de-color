import { renderInventory } from './inventory-view';
import { flush, makeDeps, mount } from './test-helpers';

describe('inventory view', () => {
  it('lists the 48 paints grouped by family, lightest first, with swatch, code and name', async () => {
    const root = mount();
    await renderInventory(root, await makeDeps());
    expect(root.querySelectorAll('[data-testid="paint"]')).toHaveLength(48);
    const black = root.querySelector('[data-family="BSL Black"]')!;
    const rows = [...black.querySelectorAll('[data-testid="paint"]')].map((r) => r.textContent);
    expect(rows[0]).toContain('72.001');
    expect(rows[0]).toContain('Blanco Calavera');
    expect(rows[3]).toContain('72.051');
    expect(black.querySelector('[data-testid="swatch"]')).not.toBeNull();
  });

  it('lists the brushes', async () => {
    const root = mount();
    await renderInventory(root, await makeDeps());
    expect(root.querySelectorAll('[data-testid="brush"]')).toHaveLength(3);
    expect(root.textContent).not.toContain('null');
  });

  it('replaces a paint when adding one with an existing brand + code', async () => {
    const root = mount();
    const deps = await makeDeps();
    await renderInventory(root, deps);
    const form = root.querySelector<HTMLFormElement>('[data-testid="add-paint"]')!;
    const set = (name: string, value: string) => ((form.elements.namedItem(name) as HTMLInputElement).value = value);
    set('brand', 'Vallejo'); set('code', '72003'); set('name', 'Carne Pálida (renombrada)'); set('range', 'Game Color'); set('hex', '#c9a47f');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await flush(); await flush();
    const inv = await deps.repo.getInventory();
    expect(inv.paints).toHaveLength(48);
    expect(inv.paints.find((p) => p.code === '72.003')?.name).toBe('Carne Pálida (renombrada)');
  });
});
