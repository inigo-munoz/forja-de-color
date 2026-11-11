import 'fake-indexeddb/auto';
import { SEED_INVENTORY } from '../paints/seed';
import { createProject } from '../projects/project';
import { openIndexedDbRepository } from './indexeddb';

let n = 0;
const fresh = () => openIndexedDbRepository(`test-${++n}`);

describe('IndexedDB repository', () => {
  it('returns the seed inventory on first open', async () => {
    const repo = await fresh();
    expect(await repo.getInventory()).toEqual(SEED_INVENTORY);
  });

  it('round-trips a project', async () => {
    const repo = await fresh();
    const p = createProject('Bárbara', new Date('2026-11-11T10:00:00Z'), 'p1');
    await repo.saveProject(p);
    expect(await repo.getProject('p1')).toEqual(p);
    expect(await repo.listProjects()).toEqual([p]);
  });

  it('deletes a project', async () => {
    const repo = await fresh();
    await repo.saveProject(createProject('B', new Date(), 'p1'));
    await repo.deleteProject('p1');
    expect(await repo.getProject('p1')).toBeUndefined();
  });

  it('round-trips a blob keeping size and type', async () => {
    const repo = await fresh();
    const id = await repo.putBlob(new Blob(['hola'], { type: 'image/jpeg' }));
    const blob = await repo.getBlob(id);
    expect(blob?.size).toBe(4);
    expect(blob?.type).toBe('image/jpeg');
  });

  it('clearAll empties everything and the inventory falls back to the seed', async () => {
    const repo = await fresh();
    await repo.saveInventory({ paints: [], brushes: [] });
    await repo.saveProject(createProject('B', new Date(), 'p1'));
    const blobId = await repo.putBlob(new Blob(['x']));
    await repo.setMeta('lastExportAt', '2026-11-11');
    await repo.clearAll();
    expect(await repo.listProjects()).toEqual([]);
    expect(await repo.getBlob(blobId)).toBeUndefined();
    expect(await repo.getMeta('lastExportAt')).toBeUndefined();
    expect(await repo.getInventory()).toEqual(SEED_INVENTORY);
  });
});
