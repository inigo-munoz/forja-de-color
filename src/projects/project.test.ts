import type { AdviceEntry } from '../advice/schema';
import { addAdvice, addProgressPhoto, createProject, markDone, reopen, setNotes } from './project';

const now = new Date('2026-11-11T10:00:00Z');

describe('project', () => {
  it('starts in progress with empty notes, progress and advice', () => {
    const p = createProject('Bárbara', now, 'p1');
    expect(p).toMatchObject({ id: 'p1', name: 'Bárbara', status: 'in-progress', notes: '', progress: [], advice: [] });
    expect(p.createdAt).toBe(now.toISOString());
  });

  it('keeps progress photos sorted by date, oldest first', () => {
    let p = createProject('Bárbara', now, 'p1');
    p = addProgressPhoto(p, { id: 'b', takenAt: '2026-11-12T00:00:00Z', blobId: 'blob-b' });
    p = addProgressPhoto(p, { id: 'a', takenAt: '2026-11-10T00:00:00Z', blobId: 'blob-a' });
    expect(p.progress.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('marks done and reopens', () => {
    const p = createProject('Bárbara', now, 'p1');
    expect(markDone(p).status).toBe('done');
    expect(reopen(markDone(p)).status).toBe('in-progress');
  });

  it('sets notes and appends advice', () => {
    const entry = { id: 'e1' } as AdviceEntry;
    const p = addAdvice(setNotes(createProject('B', now, 'p1'), 'capa roja'), entry);
    expect(p.notes).toBe('capa roja');
    expect(p.advice).toEqual([entry]);
  });

  it('never mutates its input', () => {
    const p = Object.freeze(createProject('B', now, 'p1'));
    expect(() => {
      setNotes(p, 'x');
      markDone(p);
      addProgressPhoto(p, { id: 'a', takenAt: '2026-11-10T00:00:00Z', blobId: 'b' });
      addAdvice(p, { id: 'e' } as AdviceEntry);
    }).not.toThrow();
    expect(p.notes).toBe('');
    expect(p.status).toBe('in-progress');
  });
});
