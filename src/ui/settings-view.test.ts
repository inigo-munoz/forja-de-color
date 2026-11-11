import { vi } from 'vitest';
import { buildBrainInstructions } from '../advice/package';
import { createProject } from '../projects/project';
import { readBytes } from '../storage/bytes';
import { renderSettings } from './settings-view';
import { renderTechnique } from './technique-view';
import { flush, makeDeps, mount, stubObjectUrls } from './test-helpers';

const text = async (b: Blob) => new TextDecoder().decode(await readBytes(b));

describe('settings view', () => {
  it('exports a downloadable JSON backup', async () => {
    const created = stubObjectUrls();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const root = mount();
    const deps = await makeDeps();
    await deps.repo.saveProject(createProject('Bárbara', deps.now(), 'p1'));
    await renderSettings(root, deps);
    root.querySelector<HTMLButtonElement>('[data-testid="export"]')!.click();
    await flush(); await flush(); await flush();
    click.mockRestore();
    const file = JSON.parse(await text(created[0]));
    expect(file.app).toBe('forja-de-color');
    expect(file.projects[0].name).toBe('Bárbara');
  });

  it('shows the error and keeps the data when importing an invalid file', async () => {
    const root = mount();
    const deps = await makeDeps();
    await deps.repo.saveProject(createProject('Bárbara', deps.now(), 'p1'));
    await renderSettings(root, deps);
    const input = root.querySelector<HTMLInputElement>('[data-testid="import"]')!;
    Object.defineProperty(input, 'files', { value: [new File(['{"foo":1}'], 'x.json', { type: 'application/json' })] });
    input.dispatchEvent(new Event('change'));
    for (let i = 0; i < 6; i++) await flush();
    expect(root.querySelector('[data-testid="import-error"]')?.textContent).toMatch(/not a Forja de Color backup|not a backup/);
    expect(await deps.repo.listProjects()).toHaveLength(1);
  });

  it('copies the brain instructions to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const root = mount();
    const deps = await makeDeps();
    await renderSettings(root, deps);
    root.querySelector<HTMLButtonElement>('[data-testid="copy-brain"]')!.click();
    await flush(); await flush();
    expect(writeText).toHaveBeenCalledWith(buildBrainInstructions(await deps.repo.getInventory()));
  });

  it('shows the backup reminder when never exported', async () => {
    const root = mount();
    await renderSettings(root, await makeDeps());
    expect(root.querySelector('[data-testid="backup-reminder"]')).not.toBeNull();
  });

  it('hides the backup reminder after a recent export', async () => {
    const root = mount();
    const deps = await makeDeps();
    await deps.repo.setMeta('lastExportAt', '2026-11-10T10:00:00Z');
    await renderSettings(root, deps);
    expect(root.querySelector('[data-testid="backup-reminder"]')).toBeNull();
    expect(root.textContent).not.toContain('null');
  });
});

describe('technique view', () => {
  it('renders the card markdown as text', async () => {
    const root = mount();
    await renderTechnique(root, await makeDeps(), 'slapchop');
    expect(root.textContent).toContain('Slapchop');
    expect(root.textContent).toContain('TODO(user): write from the BSL book');
  });
});
