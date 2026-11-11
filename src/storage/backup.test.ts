import 'fake-indexeddb/auto';
import { createProject } from '../projects/project';
import { exportAll, importAll, shouldRemindBackup } from './backup';
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
