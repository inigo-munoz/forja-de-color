import { isBaseSetting, isPaintingStyle } from '../projects/style';
import type { Inventory } from '../paints/paint';
import type { Project } from '../projects/project';
import type { Repository } from './repository';
import { readBytes } from './bytes';

export interface BackupFile {
  app: 'forja-de-color';
  version: 1;
  exportedAt: string;
  inventory: Inventory;
  projects: Project[];
  blobs: Record<string, { type: string; base64: string }>;
}

const DAY_MS = 86_400_000;

function blobIdsOf(p: Project): string[] {
  return [p.initialPhotoBlobId, p.targetImageBlobId, ...p.progress.map((x) => x.blobId)].filter(
    (id): id is string => typeof id === 'string',
  );
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await readBytes(blob));
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function exportAll(repo: Repository, now: Date): Promise<BackupFile> {
  const projects = await repo.listProjects();
  const blobs: BackupFile['blobs'] = {};
  for (const id of new Set(projects.flatMap(blobIdsOf))) {
    const blob = await repo.getBlob(id);
    if (blob) blobs[id] = { type: blob.type, base64: await toBase64(blob) };
  }
  const exportedAt = now.toISOString();
  const file: BackupFile = { app: 'forja-de-color', version: 1, exportedAt, inventory: await repo.getInventory(), projects, blobs };
  await repo.setMeta('lastExportAt', exportedAt);
  return file;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Optional doneZones on an advice entry: distinct integer indices into its recipe's zones. */
function doneZonesProblem(project: Record<string, unknown>, projectIndex: number): string | null {
  const advice = project.advice as unknown[];
  for (let i = 0; i < advice.length; i++) {
    const entry = advice[i];
    if (!isObj(entry) || !('doneZones' in entry)) continue;
    const zones = isObj(entry.response) && Array.isArray(entry.response.zones) ? entry.response.zones.length : 0;
    const done = entry.doneZones;
    const valid = Array.isArray(done) && new Set(done).size === done.length &&
      done.every((z) => Number.isInteger(z) && (z as number) >= 0 && (z as number) < zones);
    if (!valid) return `project #${projectIndex + 1}, advice #${i + 1} has invalid done zones: each must be a different zone index below ${zones}`;
  }
  return null;
}

/** Why a file cannot be restored, or null when it is a valid backup. */
export function validateBackup(file: unknown): string | null {
  if (!isObj(file)) return 'not a backup file';
  if (file.app !== 'forja-de-color') return 'this file is not a Forja de Color backup';
  if (file.version !== 1) return `unsupported backup version: ${String(file.version)}`;
  const inv = file.inventory;
  if (!isObj(inv) || !Array.isArray(inv.paints) || !Array.isArray(inv.brushes)) return 'backup has no valid inventory';
  const str = (o: Record<string, unknown>, ...keys: string[]) => keys.every((k) => typeof o[k] === 'string');
  const badPaint = inv.paints.findIndex((p) => !isObj(p) || !str(p, 'brand', 'code', 'name', 'range', 'type', 'hex'));
  if (badPaint >= 0) return `paint #${badPaint + 1} needs brand, code, name, range, type and hex`;
  const badBrush = inv.brushes.findIndex((b) => !isObj(b) || !str(b, 'code', 'name'));
  if (badBrush >= 0) return `brush #${badBrush + 1} needs code and name`;
  if (!Array.isArray(file.projects)) return 'backup has no valid projects';
  const badProject = file.projects.findIndex(
    (p) => !isObj(p) || !str(p, 'id', 'name', 'createdAt', 'status', 'notes') || !Array.isArray(p.progress) || !Array.isArray(p.advice),
  );
  if (badProject >= 0) return `project #${badProject + 1} is incomplete`;
  const badLook = file.projects.findIndex((p) => {
    const o = p as Record<string, unknown>;
    return ('style' in o && !isPaintingStyle(o.style)) || ('baseSetting' in o && !isBaseSetting(o.baseSetting));
  });
  if (badLook >= 0) return `project #${badLook + 1} has an unknown painting style or base setting`;
  const doneZonesError = file.projects.map((p, i) => doneZonesProblem(p as Record<string, unknown>, i)).find((e) => e !== null);
  if (doneZonesError) return doneZonesError;
  if (!isObj(file.blobs)) return 'backup has no valid photos';
  for (const b of Object.values(file.blobs)) {
    if (!isObj(b) || typeof b.type !== 'string' || typeof b.base64 !== 'string') return 'backup has a damaged photo';
  }
  return null;
}

/** Validates the whole file first; only then replaces everything. */
export async function importAll(repo: Repository, file: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const error = validateBackup(file);
  if (error) return { ok: false, error };
  const backup = file as BackupFile;
  let decoded: Array<[string, Blob]>;
  try {
    decoded = Object.entries(backup.blobs).map(([id, b]) => [id, fromBase64(b.base64, b.type)]);
  } catch {
    return { ok: false, error: 'backup has a damaged photo' };
  }
  try {
    await repo.replaceAll({ inventory: backup.inventory, projects: backup.projects, blobs: decoded });
  } catch (e) {
    return { ok: false, error: `could not restore the backup: ${(e as Error).message}` };
  }
  return { ok: true };
}

export function shouldRemindBackup(lastExportAt: string | undefined, now: Date, everyDays = 7): boolean {
  if (!lastExportAt) return true;
  return now.getTime() - new Date(lastExportAt).getTime() >= everyDays * DAY_MS;
}
