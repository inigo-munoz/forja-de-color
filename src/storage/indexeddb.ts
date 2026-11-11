import { openDB, type DBSchema } from 'idb';
import type { Inventory } from '../paints/paint';
import { SEED_INVENTORY } from '../paints/seed';
import type { Project } from '../projects/project';
import type { MetaKey, Repository } from './repository';
import { readBytes } from './bytes';

interface StoredBlob {
  type: string;
  bytes: ArrayBuffer;
}

interface ForjaDb extends DBSchema {
  inventory: { key: string; value: Inventory };
  projects: { key: string; value: Project };
  blobs: { key: string; value: StoredBlob };
  meta: { key: string; value: string };
}

const STORES = ['inventory', 'projects', 'blobs', 'meta'] as const;

// Blobs are stored as bytes + type: an ArrayBuffer is structured-cloneable everywhere,
// a Blob is not in every IndexedDB implementation.

export async function openIndexedDbRepository(dbName = 'forja-de-color'): Promise<Repository> {
  const db = await openDB<ForjaDb>(dbName, 1, {
    upgrade(d) {
      d.createObjectStore('inventory');
      d.createObjectStore('projects', { keyPath: 'id' });
      d.createObjectStore('blobs');
      d.createObjectStore('meta');
    },
  });

  return {
    async getInventory() {
      return (await db.get('inventory', 'current')) ?? structuredClone(SEED_INVENTORY);
    },
    async saveInventory(inv) {
      await db.put('inventory', inv, 'current');
    },
    listProjects: () => db.getAll('projects'),
    getProject: (id) => db.get('projects', id),
    async saveProject(p) {
      await db.put('projects', p);
    },
    deleteProject: (id) => db.delete('projects', id),
    async putBlob(blob, id = crypto.randomUUID()) {
      await db.put('blobs', { type: blob.type, bytes: await readBytes(blob) }, id);
      return id;
    },
    async getBlob(id) {
      const stored = await db.get('blobs', id);
      return stored && new Blob([stored.bytes], { type: stored.type });
    },
    deleteBlob: (id) => db.delete('blobs', id),
    getMeta: (key: MetaKey) => db.get('meta', key),
    async setMeta(key: MetaKey, value: string) {
      await db.put('meta', value, key);
    },
    async replaceAll({ inventory, projects, blobs }) {
      // Read every blob first: an IndexedDB transaction auto-commits across non-IDB awaits.
      const stored = await Promise.all(blobs.map(async ([id, b]) => [id, { type: b.type, bytes: await readBytes(b) }] as const));
      const tx = db.transaction([...STORES], 'readwrite');
      const writes: Promise<unknown>[] = STORES.filter((s) => s !== 'meta').map((s) => tx.objectStore(s).clear());
      writes.push(tx.objectStore('inventory').put(inventory, 'current'));
      for (const p of projects) writes.push(tx.objectStore('projects').put(p));
      for (const [id, b] of stored) writes.push(tx.objectStore('blobs').put(b, id));
      await Promise.all([...writes, tx.done]);
    },
    async clearAll() {
      const tx = db.transaction([...STORES], 'readwrite');
      await Promise.all([...STORES.map((s) => tx.objectStore(s).clear()), tx.done]);
    },
  };
}
