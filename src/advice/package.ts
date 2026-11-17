import { adviceLookLines } from '../projects/style';
import type { BslRole, Inventory } from '../paints/paint';
import { bslRole } from '../paints/roles';
import type { AdvicePackage, AdviceRequest } from './schema';

const METHOD = `You are my miniature painting assistant. I paint fast but want a good-looking result.
METHOD
- Default technique is Slapchop: black primer, then a heavy grey drybrush and a lighter white drybrush to sketch light and shadow, then translucent colour on top.
- I have no translucent paints: make them by thinning my opaque paints. Every Slapchop zone needs a dilution ratio "N:M" (paint:medium or water), e.g. "1:3".
- Use BSL (base, shadow, light) triads only on detail zones: faces, skin, focal points. Prefer the BSL families listed below; each family is ordered 1 (lightest) to 4 (darkest).
- For a BSL zone use the family's base, shadow and light paints by their role (extra light for final highlights); a family without a shadow paint is shaded by glazing its base.
- Rules: only use paints and brushes from this inventory; cite them by brand and code. Never invent paints. Do not repeat the same paint needlessly.
- Write every human-readable text (zone names, steps, tips) in Spanish.`;

const RECIPE_FORMAT = (moment: 'start' | 'primed' | 'half-painted') => `ANSWER FORMAT: reply with JSON only, in one \`\`\`json block, exactly this shape:
{
  "version": 1,
  "kind": "recipe",
  "moment": "${moment}",
  "prep": ${moment === 'primed' ? '[]' : '["step", "..."]'},
  "zones": [
    { "name": "zone", "technique": "slapchop", "paint": { "brand": "Vallejo", "code": "72.021" }, "dilution": "1:3", "steps": ["..."], "brush": "B02001" },
    { "name": "zone", "technique": "bsl", "bsl": { "base": { "brand": "Vallejo", "code": "72.099" }, "shadow": { "brand": "Vallejo", "code": "72.071" }, "light": { "brand": "Vallejo", "code": "72.098" } }, "steps": ["..."] }
  ],
  "tips": ["..."]${moment === 'half-painted' ? `,
  "complements": [{ "brand": "Vallejo", "code": "72.008" }],
  "remainingSteps": ["..."]
  (mark zones that are already painted with "alreadyPainted": true)` : ''}
}`;

const CONSULTATION_FORMAT = `ANSWER FORMAT: reply with JSON only, in one \`\`\`json block, exactly this shape:
{
  "version": 1,
  "kind": "consultation",
  "zone": "zone",
  "question": "apply-layer | light | shadow | highlight | which-technique | free",
  "technique": "short name",
  "steps": ["..."],
  "paints": [{ "paint": { "brand": "Vallejo", "code": "72.021" }, "dilution": "1:3" }],
  "brush": "B02001",
  "techniqueCard": "slapchop | dilution | bsl | drybrush"
}`;

const ROLE_WORDS: Record<BslRole, string> = { base: 'base', shadow: 'shadow', light: 'light', fourth: 'extra light' };

function inventoryLines(inv: Inventory): string {
  const paints = inv.paints.map((p) => {
    const role = bslRole(p);
    return [p.brand, p.code, p.name, p.family?.name ?? p.range, p.family?.order ?? '', role ? ROLE_WORDS[role] : ''].join('|');
  });
  const brushes = inv.brushes.map((b) => `brush|${b.code}|${b.name}`);
  return ['INVENTORY (brand|code|name|family|order|role)', ...paints, ...brushes].join('\n');
}

function momentRequest(req: AdviceRequest): string {
  switch (req.moment) {
    case 'start':
      return 'MOMENT: start. The photo shows an unpainted miniature. Give me a palette by zones.';
    case 'primed':
      return 'MOMENT: primed. The photo shows my miniature already primed in black with the grey and white drybrush done. Skip priming and drybrushing (leave prep empty) and give me a palette by zones, starting from the colour layers.';
    case 'half-painted':
      return 'MOMENT: half-painted. The photo shows my miniature partly painted. Say which zones are already painted, propose complementary colours and the steps left to finish it.';
    case 'during':
      return `MOMENT: during. Zone: "${req.zone ?? ''}". Question: ${req.question ?? 'free'}.${req.freeText ? ` Details: ${req.freeText}` : ''} Tell me which technique to use and how, for that zone only.`;
  }
}

export function buildAdvicePackage(req: AdviceRequest, inv: Inventory, photo: Blob): AdvicePackage {
  const format =
    req.moment === 'during' ? CONSULTATION_FORMAT : RECIPE_FORMAT(req.moment);
  const look = adviceLookLines(req);
  const text = [METHOD, inventoryLines(inv), momentRequest(req), ...(look.length ? [look.join('\n')] : []), format].join('\n\n');
  return { text, image: photo };
}

export function buildBrainInstructions(inv: Inventory): string {
  return [
    METHOD,
    inventoryLines(inv),
    'When I send a photo I will say the moment (start, primed, half-painted or during). For start, primed and half-painted answer with this format (for primed, leave prep empty):',
    RECIPE_FORMAT('start'),
    'For during answer with this format:',
    CONSULTATION_FORMAT,
  ].join('\n\n');
}
