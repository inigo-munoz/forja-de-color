import 'fake-indexeddb/auto';
import { vi } from 'vitest';
import type { AdviceEntry } from '../advice/schema';
import { addAdvice, createProject, setLook, setZoneDone } from '../projects/project';
import { exportAll, importAll, shouldRemindBackup, validateBackup } from './backup';
import { openIndexedDbRepository } from './indexeddb';
import { readBytes } from './bytes';

let n = 0;
const fresh = () => openIndexedDbRepository(`backup-${++n}`);
const now = new Date('2026-11-11T10:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

async function populated() {
  const repo = await fresh();
  const blobId = await repo.putBlob(new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/jpeg' }));
  await repo.saveProject({ ...createProject('Bárbara', now, 'p1'), initialPhotoBlobId: blobId, notes: 'capa roja' });
  const inv = await repo.getInventory();
  await repo.saveInventory({ ...inv, brushes: inv.brushes.slice(0, 1) });
  return { repo, blobId };
}

describe('backup', () => {
  it('round-trips projects, inventory and blob bytes', async () => {
    const { repo, blobId } = await populated();
    const file = JSON.parse(JSON.stringify(await exportAll(repo, now)));
    const before = { projects: await repo.listProjects(), inventory: await repo.getInventory() };
    await repo.clearAll();
    expect(await importAll(repo, file)).toEqual({ ok: true });
    expect(await repo.listProjects()).toEqual(before.projects);
    expect(await repo.getInventory()).toEqual(before.inventory);
    const blob = await repo.getBlob(blobId);
    expect(blob?.type).toBe('image/jpeg');
    expect([...new Uint8Array(await readBytes(blob!))]).toEqual([1, 2, 3, 250]);
  });

  it.each([
    ['an unrelated object', { foo: 1 }],
    ['another app', { app: 'other', version: 1, exportedAt: '', inventory: { paints: [], brushes: [] }, projects: [], blobs: {} }],
    ['a newer version', { app: 'forja-de-color', version: 2, exportedAt: '', inventory: { paints: [], brushes: [] }, projects: [], blobs: {} }],
  ])('rejects %s and leaves existing data untouched', async (_label, file) => {
    const { repo } = await populated();
    const before = { projects: await repo.listProjects(), inventory: await repo.getInventory() };
    const result = await importAll(repo, file);
    expect(result.ok).toBe(false);
    expect(await repo.listProjects()).toEqual(before.projects);
    expect(await repo.getInventory()).toEqual(before.inventory);
  });

  it('records when the export happened', async () => {
    const { repo } = await populated();
    await exportAll(repo, now);
    expect(await repo.getMeta('lastExportAt')).toBe(now.toISOString());
  });

  it('reminds when never exported, not after 3 days, yes after 8 days', () => {
    expect(shouldRemindBackup(undefined, now)).toBe(true);
    expect(shouldRemindBackup(daysAgo(3), now)).toBe(false);
    expect(shouldRemindBackup(daysAgo(8), now)).toBe(true);
  });
});

describe('backup — deep validation', () => {
  const file = (over: Record<string, unknown>) => ({
    app: 'forja-de-color', version: 1, exportedAt: '', inventory: { paints: [], brushes: [] }, projects: [], blobs: {}, ...over,
  });

  it.each([
    ['a paint without brand', { inventory: { paints: [{ code: '72.003', name: 'x' }], brushes: [] } }],
    ['a project without progress', { projects: [{ id: 'p', name: 'x', createdAt: '', status: 'in-progress', notes: '', advice: [] }] }],
    ['a brush without code', { inventory: { paints: [], brushes: [{ name: 'x' }] } }],
  ])('rejects %s and keeps existing data', async (_label, over) => {
    const { repo } = await populated();
    const before = await repo.listProjects();
    const result = await importAll(repo, file(over));
    expect(result.ok).toBe(false);
    expect(await repo.listProjects()).toEqual(before);
  });

  it('restores in one step, so a failure mid-restore leaves the old data intact', async () => {
    const { repo } = await populated();
    const before = await repo.listProjects();
    const good = JSON.parse(JSON.stringify(await exportAll(repo, now)));
    vi.spyOn(repo, 'replaceAll').mockRejectedValue(new Error('QuotaExceededError'));
    const result = await importAll(repo, good);
    expect(result.ok).toBe(false);
    expect(await repo.listProjects()).toEqual(before);
  });
});

describe('backup — done zones', () => {
  const zone = { name: 'z', technique: 'slapchop' as const, paint: { brand: 'Vallejo', code: '72.021' }, dilution: '1:1', steps: [] };
  const entry: AdviceEntry = {
    id: 'e1', receivedAt: '2026-11-11T10:00:00Z', unknownPaints: [], unknownBrushes: [],
    response: { version: 1, kind: 'recipe', moment: 'start', prep: [], tips: [], zones: [zone, zone, zone] },
  };
  const withDone = (doneZones?: unknown) => ({
    app: 'forja-de-color', version: 1, exportedAt: '', inventory: { paints: [], brushes: [] }, blobs: {},
    projects: [{ ...createProject('B', now, 'p1'), advice: [{ id: 'c', receivedAt: '', unknownPaints: [], unknownBrushes: [], response: { kind: 'consultation' } },
      doneZones === undefined ? entry : { ...entry, doneZones }] }],
  });

  it('accepts entries without doneZones and with a valid list', () => {
    expect(validateBackup(withDone())).toBeNull();
    expect(validateBackup(withDone([0, 2]))).toBeNull();
    expect(validateBackup(withDone([]))).toBeNull();
  });

  it.each([
    ['not a list', 1],
    ['a non-integer', [1.5]],
    ['a string', ['1']],
    ['a negative index', [-1]],
    ['an index out of range', [3]],
    ['a duplicate', [1, 1]],
  ])('rejects %s with a clear message', (_label, doneZones) => {
    expect(validateBackup(withDone(doneZones))).toBe('project #1, advice #2 has invalid done zones: each must be a different zone index below 3');
  });

  it('rejects done zones on an entry with no zones', () => {
    const file = withDone();
    (file.projects[0].advice[0] as Record<string, unknown>).doneZones = [0];
    expect(validateBackup(file)).toBe('project #1, advice #1 has invalid done zones: each must be a different zone index below 0');
  });

  it('exports doneZones only when some zone is done, and round-trips it', async () => {
    const repo = await fresh();
    await repo.saveProject(addAdvice(createProject('B', now, 'p1'), entry));
    const plain = JSON.parse(JSON.stringify(await exportAll(repo, now)));
    expect('doneZones' in plain.projects[0].advice[0]).toBe(false);

    await repo.saveProject(setZoneDone((await repo.getProject('p1'))!, 'e1', 1, true));
    const file = JSON.parse(JSON.stringify(await exportAll(repo, now)));
    expect(file.projects[0].advice[0].doneZones).toEqual([1]);
    await repo.clearAll();
    expect(await importAll(repo, file)).toEqual({ ok: true });
    expect((await repo.getProject('p1'))?.advice[0].doneZones).toEqual([1]);
  });

  const withLook = (look: Record<string, unknown>) => ({
    app: 'forja-de-color', version: 1, exportedAt: '', inventory: { paints: [], brushes: [] }, blobs: {},
    projects: [{ ...createProject('B', now, 'p1'), ...look }],
  });

  it('accepts projects without a style and with a known style and base setting', () => {
    expect(validateBackup(withLook({}))).toBeNull();
    expect(validateBackup(withLook({ style: 'osl', baseSetting: 'desert' }))).toBeNull();
  });

  it.each([
    [{ style: 'cel-shading' }],
    [{ style: 3 }],
    [{ baseSetting: 'jungle' }],
  ])('rejects an unknown style or base setting: %o', (look) => {
    expect(validateBackup(withLook(look))).toBe('project #1 has an unknown painting style or base setting');
  });

  it('exports the style only when one is chosen, and round-trips it', async () => {
    const repo = await fresh();
    await repo.saveProject(createProject('B', now, 'p1'));
    const plain = JSON.parse(JSON.stringify(await exportAll(repo, now)));
    expect('style' in plain.projects[0]).toBe(false);
    expect('baseSetting' in plain.projects[0]).toBe(false);

    await repo.saveProject(setLook((await repo.getProject('p1'))!, { style: 'vivid', baseSetting: 'fantasy' }));
    const file = JSON.parse(JSON.stringify(await exportAll(repo, now)));
    await repo.clearAll();
    expect(await importAll(repo, file)).toEqual({ ok: true });
    const p = (await repo.getProject('p1'))!;
    expect([p.style, p.baseSetting]).toEqual(['vivid', 'fantasy']);
  });

  it('rejects null and wrong-case looks, and a rejected import leaves the data unchanged', async () => {
    for (const look of [{ style: null }, { baseSetting: null }, { style: 'NMM' }, { baseSetting: '' }]) {
      expect(validateBackup(withLook(look))).toBe('project #1 has an unknown painting style or base setting');
    }
    const repo = await fresh();
    await repo.saveProject(setLook(createProject('Keep', now, 'k1'), { style: 'osl', baseSetting: 'winter' }));
    const before = JSON.stringify(await exportAll(repo, now));
    expect(await importAll(repo, withLook({ style: 'cel' }))).toEqual({ ok: false, error: 'project #1 has an unknown painting style or base setting' });
    expect(JSON.stringify(await exportAll(repo, now))).toBe(before);
  });

  const withPaint = (paint: Record<string, unknown>) => ({
    app: 'forja-de-color', version: 1, exportedAt: '', blobs: {}, projects: [],
    inventory: { brushes: [], paints: [{ brand: 'Vallejo', code: '72.001', name: 'Blanco Calavera', range: 'Game Color', type: 'opaque', hex: '#ffffff', ...paint }] },
  });

  it('accepts paints with and without an English name, and rejects one that is not text', () => {
    expect(validateBackup(withPaint({}))).toBeNull();
    expect(validateBackup(withPaint({ nameEn: 'Dead White' }))).toBeNull();
    expect(validateBackup(withPaint({ nameEn: 3 }))).toBe('paint #1 has an invalid English name');
  });

  it('exports the angles with their photos and imports them back; rejects a malformed list', async () => {
    const repo = await fresh();
    const a = await repo.putBlob(new Blob([new Uint8Array([7, 7])], { type: 'image/jpeg' }));
    await repo.saveProject({ ...createProject('B', now, 'p1'), extraPhotoBlobIds: [a] });
    const file = JSON.parse(JSON.stringify(await exportAll(repo, now)));
    expect(file.projects[0].extraPhotoBlobIds).toEqual([a]);
    expect(Object.keys(file.blobs)).toContain(a);
    await repo.clearAll();
    expect(await importAll(repo, file)).toEqual({ ok: true });
    expect((await repo.getProject('p1'))?.extraPhotoBlobIds).toEqual([a]);
    expect(validateBackup(withLook({ extraPhotoBlobIds: 'x' }))).toBe('project #1 has invalid extra photos');
    expect(validateBackup(withLook({ extraPhotoBlobIds: [1] }))).toBe('project #1 has invalid extra photos');
  });
});
