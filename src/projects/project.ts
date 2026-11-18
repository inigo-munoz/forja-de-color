import type { AdviceEntry } from '../advice/schema';
import type { BaseSetting, Look, PaintingStyle } from './style';

export interface ProgressPhoto {
  id: string;
  /** ISO date */
  takenAt: string;
  /** Blob stored by the Repository */
  blobId: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  status: 'in-progress' | 'done';
  /** The main photo: list, header, Before/after and "Paint it with ChatGPT". */
  initialPhotoBlobId?: string;
  /** Up to MAX_ANGLES more photos of the unpainted miniature; absent when there are none. */
  extraPhotoBlobIds?: string[];
  targetImageBlobId?: string;
  notes: string;
  progress: ProgressPhoto[];
  advice: AdviceEntry[];
  /** Absent: my method. */
  style?: PaintingStyle;
  /** Absent: no setting for the base. */
  baseSetting?: BaseSetting;
}

/** Sets the project's look; my method and no base setting are stored as absent, like older projects. */
export function setLook(p: Project, look: Look): Project {
  const { style: _s, baseSetting: _b, ...rest } = p;
  return {
    ...rest,
    ...(look.style && look.style !== 'my-method' ? { style: look.style } : {}),
    ...(look.baseSetting ? { baseSetting: look.baseSetting } : {}),
  };
}

export function createProject(name: string, now: Date, id: string): Project {
  return { id, name, createdAt: now.toISOString(), status: 'in-progress', notes: '', progress: [], advice: [] };
}

export function setNotes(p: Project, notes: string): Project {
  return { ...p, notes };
}

export function addProgressPhoto(p: Project, photo: ProgressPhoto): Project {
  const progress = [...p.progress, photo].sort((a, b) => a.takenAt.localeCompare(b.takenAt));
  return { ...p, progress };
}

export function addAdvice(p: Project, entry: AdviceEntry): Project {
  return { ...p, advice: [...p.advice, entry] };
}

export function markDone(p: Project): Project {
  return { ...p, status: 'done' };
}

export function reopen(p: Project): Project {
  return { ...p, status: 'in-progress' };
}

/** Ticks a recipe zone off (or back on); keeps doneZones sorted and unique, and drops it when empty. */
export function setZoneDone(p: Project, entryId: string, zone: number, done: boolean): Project {
  const advice = p.advice.map((e) => {
    if (e.id !== entryId) return e;
    const zones = new Set(e.doneZones ?? []);
    if (done) zones.add(zone);
    else zones.delete(zone);
    const { doneZones: _old, ...rest } = e;
    return zones.size ? { ...rest, doneZones: [...zones].sort((a, b) => a - b) } : rest;
  });
  return { ...p, advice };
}

/** Extra angles a project keeps besides its main photo. */
export const MAX_ANGLES = 3;

/** The main photo and its angles, in order: what the advisor sends for start and primed. */
export function photosOf(p: Project): string[] {
  return [p.initialPhotoBlobId, ...(p.extraPhotoBlobIds ?? [])].filter((id): id is string => !!id);
}

/** Adds an angle; ignored once the project has MAX_ANGLES. */
export function addAngle(p: Project, blobId: string): Project {
  const angles = p.extraPhotoBlobIds ?? [];
  return angles.length >= MAX_ANGLES ? p : { ...p, extraPhotoBlobIds: [...angles, blobId] };
}

/** Removes an angle; with none left the field goes away, as in older projects. */
export function removeAngle(p: Project, blobId: string): Project {
  const { extraPhotoBlobIds, ...rest } = p;
  const left = (extraPhotoBlobIds ?? []).filter((id) => id !== blobId);
  return left.length ? { ...rest, extraPhotoBlobIds: left } : rest;
}
