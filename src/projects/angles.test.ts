import { MAX_ANGLES, addAngle, createProject, photosOf, removeAngle } from './project';

const p = { ...createProject('Búho', new Date('2026-11-18T10:00:00Z'), 'p1'), initialPhotoBlobId: 'main' };

describe('project angles', () => {
  it('a project starts with only its main photo, and no extra field', () => {
    expect(photosOf(p)).toEqual(['main']);
    expect('extraPhotoBlobIds' in p).toBe(false);
  });

  it('keeps up to 3 extra angles after the main photo, in order', () => {
    const full = ['a', 'b', 'c', 'd'].reduce(addAngle, p);
    expect(MAX_ANGLES).toBe(3);
    expect(photosOf(full)).toEqual(['main', 'a', 'b', 'c']);
  });

  it('removing the last angle leaves the project as it was', () => {
    const one = addAngle(p, 'a');
    expect(removeAngle(addAngle(one, 'b'), 'a').extraPhotoBlobIds).toEqual(['b']);
    expect(removeAngle(one, 'a')).toEqual(p);
  });

  it('a project with angles and no main photo has no photos to send', () => {
    expect(photosOf(createProject('X', new Date(), 'x'))).toEqual([]);
  });
});
