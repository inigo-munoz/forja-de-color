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

  it('asks for a recipe without prep for a primed and drybrushed miniature', () => {
    const primed = buildAdvicePackage({ moment: 'primed' }, SEED_INVENTORY, photo);
    expect(primed.text).toContain('MOMENT: primed.');
    expect(primed.text).toContain('already primed');
    expect(primed.text).toContain('"kind": "recipe"');
    expect(primed.text).toContain('"moment": "primed"');
    expect(primed.text).toContain('"prep": []');
    expect(primed.text).not.toContain('"complements"');
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

  it("sends each paint's BSL role, then its type, in the inventory", () => {
    expect(start.text).toContain('INVENTORY (brand|code|name|family|order|role|type)');
    expect(start.text).toContain('Vallejo|72.020|Azul Imperial|BSL Blue|3|base|opaque');
    expect(start.text).toContain('Vallejo|72.019|Azul Negro|BSL Blue|4|shadow|opaque');
    expect(start.text).toContain('Vallejo|72.021|Azul Mágico|BSL Blue|2|light|opaque');
    expect(start.text).toContain('Vallejo|72.118|Azul Amanecer|BSL Blue|1|extra light|opaque');
    expect(start.text).toContain('Vallejo|72.011|Rojo Visceral|BSL Multipurpose|1||opaque\n');
  });

  it('fills the role from the seed for a stored inventory without roles', () => {
    const bare = { ...SEED_INVENTORY, paints: SEED_INVENTORY.paints.map((p) => ({ ...p, family: p.family && { name: p.family.name, order: p.family.order } })) };
    expect(buildAdvicePackage({ moment: 'start' }, bare, photo).text).toBe(start.text);
  });

  it('tells the AI to use the BSL paints by their role', () => {
    expect(start.text).toContain('For a BSL zone use the family\'s base, shadow and light paints by their role');
    expect(buildBrainInstructions(SEED_INVENTORY)).toContain('|role|type)');
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
    expect(brain).toContain('start, primed, half-painted or during');
  });
});
