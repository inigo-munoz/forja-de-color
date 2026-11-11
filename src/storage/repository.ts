import type { Inventory } from '../paints/paint';
import type { Project } from '../projects/project';

export type MetaKey = 'lastExportAt';

/** Port: where the app keeps the inventory, projects, photos and small settings. */
export interface Repository {
  getInventory(): Promise<Inventory>;
  saveInventory(inv: Inventory): Promise<void>;
  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  saveProject(p: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;
  /** Stores a blob; `id` is only passed when restoring a backup, so references stay valid. */
  putBlob(blob: Blob, id?: string): Promise<string>;
  getBlob(id: string): Promise<Blob | undefined>;
  deleteBlob(id: string): Promise<void>;
  getMeta(key: MetaKey): Promise<string | undefined>;
  setMeta(key: MetaKey, value: string): Promise<void>;
  clearAll(): Promise<void>;
}
