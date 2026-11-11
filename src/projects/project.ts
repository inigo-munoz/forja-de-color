import type { AdviceEntry } from '../advice/schema';

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
  initialPhotoBlobId?: string;
  targetImageBlobId?: string;
  notes: string;
  progress: ProgressPhoto[];
  advice: AdviceEntry[];
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
