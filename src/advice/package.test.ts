import { SEED_INVENTORY } from '../paints/seed';
import { buildAdvicePackage, buildBrainInstructions } from './package';

const photo = new Blob(['x'], { type: 'image/jpeg' });

describe('buildAdvicePackage', () => {
  const start = buildAdvicePackage({ moment: 'start' }, SEED_INVENTORY, photo);

  it('lists every owned paint code', () => {
    for (const p of SEED_INVENTORY.paints) expect(start.text).toContain(p.code);
  });

  it('states the method: Slapchop with dilution, BSL details, black primer and drybrush', () => {
    for (const term of ['Slapchop', 'dilution', 'BSL', 'black primer', 'drybrush']) {
      expect(start.text).toContain(term);
    }
  });

  it('asks for a version 1 recipe at the start moment', () => {
    expect(start.text).toContain('"version": 1');
    expect(start.text).toContain('"kind": "recipe"');
  });

  it('asks for a recipe at the half-painted moment', () => {
    const half = buildAdvicePackage({ moment: 'half-painted' }, SEED_INVENTORY, photo);
    expect(half.text).toContain('"kind": "recipe"');
    expect(half.text).toContain('"moment": "half-painted"');
  });

  it('asks for a consultation about the zone and question while painting', () => {
    const during = buildAdvicePackage({ moment: 'during', zone: 'capa', question: 'highlight' }, SEED_INVENTORY, photo);
    expect(during.text).toContain('"kind": "consultation"');
    expect(during.text).toContain('capa');
    expect(during.text).toContain('highlight');
  });

  it('restricts the answer to the inventory, cited by brand and code', () => {
    expect(start.text).toContain('only use paints and brushes from this inventory; cite them by brand and code');
  });

  it('stays under 8000 characters with the seed inventory', () => {
    expect(start.text.length).toBeLessThan(8000);
  });

  it('carries the photo as the image', () => {
    expect(start.image).toBe(photo);
  });
});

describe('buildBrainInstructions', () => {
  it('contains the method and format but no moment-specific request', () => {
    const brain = buildBrainInstructions(SEED_INVENTORY);
    expect(brain).toContain('Slapchop');
    expect(brain).toContain('"version": 1');
    expect(brain).toContain('72.003');
    expect(brain).not.toContain('MOMENT:');
  });
});
