import { findPaint } from '../paints/inventory';
import type { Inventory, PaintRef } from '../paints/paint';
import type { RecipeResponse } from './schema';

function describe(inv: Inventory, ref: PaintRef): string {
  const p = findPaint(inv, ref);
  return p ? `${p.name} ${p.hex}` : `${ref.brand} ${ref.code}`;
}

/**
 * Prompt for an image model (ChatGPT) to paint the miniature in the attached photo with the
 * colours of a recipe. Image generation stays outside the app, like the recipe itself.
 */
export function buildImagePrompt(recipe: RecipeResponse, inv: Inventory): string {
  const zones = recipe.zones.map((z) => {
    if (z.technique === 'bsl' && z.bsl) {
      return `- ${z.name}: base ${describe(inv, z.bsl.base)}, shadows ${describe(inv, z.bsl.shadow)}, highlights ${describe(inv, z.bsl.light)}`;
    }
    return z.paint ? `- ${z.name}: ${describe(inv, z.paint)}` : `- ${z.name}: keep as it is`;
  });
  return [
    'Edit the attached photo of a miniature so it looks painted. Keep the exact pose, sculpt, base and framing: do not add, remove or reshape anything.',
    'Style: tabletop-quality "slapchop" painting — strong light and shadow from a white drybrush over black primer, with translucent colour on top; detail zones (faces, skin) with smooth base / shadow / highlight.',
    'Paint each zone with these colours:',
    ...zones,
    'Photorealistic photo of a painted miniature on a plain neutral background. Reply with the image only.',
  ].join('\n');
}
