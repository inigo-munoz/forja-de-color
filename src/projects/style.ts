/** How the miniature is painted. 'my-method' is the quick, showy BSL / slapchop method the app was built for. */
export const PAINTING_STYLES = ['my-method', 'nmm', 'osl', 'vivid', 'grimdark'] as const;
export type PaintingStyle = (typeof PAINTING_STYLES)[number];

/** Optional setting for the base (snow, sand…). No setting is the default. */
export const BASE_SETTINGS = ['winter', 'desert', 'fantasy'] as const;
export type BaseSetting = (typeof BASE_SETTINGS)[number];

/** The style and base setting a prompt follows. */
export interface Look {
  style?: PaintingStyle;
  baseSetting?: BaseSetting;
  /** Free-text theme for the base ("lava", "graveyard"…), alone or with a setting. */
  baseMotif?: string;
}

export const isPaintingStyle = (s: unknown): s is PaintingStyle => (PAINTING_STYLES as readonly unknown[]).includes(s);
export const isBaseSetting = (s: unknown): s is BaseSetting => (BASE_SETTINGS as readonly unknown[]).includes(s);

/** A project's look; a project saved before styles existed is painted with my method. */
/** Longest base motif kept. */
export const MAX_MOTIF = 100;

/** A motif as stored: trimmed, without a final full stop, at most MAX_MOTIF characters; empty → absent. */
export const cleanMotif = (m: string | undefined): string | undefined =>
  m?.trim().replace(/\.+$/, '').slice(0, MAX_MOTIF).trim() || undefined;

export function lookOf(p: Look): Look {
  const motif = cleanMotif(p.baseMotif);
  return { style: p.style ?? 'my-method', ...(p.baseSetting ? { baseSetting: p.baseSetting } : {}), ...(motif ? { baseMotif: motif } : {}) };
}

// Prompt text: same as the Android app (domain/projects/PaintingStyle.kt). My method adds nothing,
// so the prompts and the AI instructions stay as they were.
const ADVICE_STYLE: Record<Exclude<PaintingStyle, 'my-method'>, string> = {
  nmm: 'STYLE: NMM (non-metallic metal). Paint every metal with non-metallic paints only, faking the shine with strong light-to-dark gradients and sharp highlights.',
  osl: 'STYLE: OSL (object source lighting). Choose one glowing light source on the miniature and tint the nearby surfaces with its colour, brightest closest to it.',
  vivid: 'STYLE: Vivid · High-Fantasy. Bright, saturated colours like an animated film, with strong contrast between zones.',
  grimdark: 'STYLE: Grimdark. Muted, desaturated colours with wear, dirt, rust and battle damage.',
};

const ADVICE_BASE: Record<BaseSetting, string> = {
  winter: 'BASE SETTING: winter. Snow, ice and cold tones on the base.',
  desert: 'BASE SETTING: desert. Sand, dry earth and warm tones on the base.',
  fantasy: 'BASE SETTING: fantasy. Magical, unreal colours on the base.',
};

const IMAGE_STYLE: Record<Exclude<PaintingStyle, 'my-method'>, string> = {
  nmm: 'Painting style: NMM — metals painted with flat colours and sharp highlights instead of metallic paint.',
  osl: 'Painting style: OSL — a glowing light source on the miniature tints the nearby surfaces.',
  vivid: 'Painting style: vivid high fantasy — bright, saturated colours like an animated film.',
  grimdark: 'Painting style: grimdark — muted colours with wear, dirt and battle damage.',
};

const IMAGE_BASE: Record<BaseSetting, string> = {
  winter: 'Base: winter ground with snow and ice.',
  desert: 'Base: desert sand and dry earth.',
  fantasy: 'Base: magical ground with unreal colours.',
};

/** Lines for the advisor prompt; empty for my method without a base setting. */
export function adviceLookLines(look: Look): string[] {
  const lines: string[] = [];
  if (look.style && look.style !== 'my-method') {
    lines.push(ADVICE_STYLE[look.style], 'Keep my method above for speed, but follow this style in the colours, the steps and the tips.');
  }
  if (look.baseSetting) lines.push(ADVICE_BASE[look.baseSetting]);
  const motif = cleanMotif(look.baseMotif);
  if (motif) lines.push(`BASE MOTIF: ${motif}.`);
  if (look.baseSetting || motif) lines.push(BASE_MATERIALS);
  return lines;
}

// With a themed base the advisor may go beyond the paint inventory, for basing materials only.
const BASE_MATERIALS = 'BASE MATERIALS: you may also recommend basing materials for this base (sand, static grass, snow, pigments, tufts…) in a top-level "baseMaterials" list of short strings; I may not have them.';
const IMAGE_TERRAIN = 'On the base only, you may add terrain that fits it (snow, rocks, plants, effects); leave the miniature itself exactly as it is.';

/** Lines for the image prompt; empty for my method without a base setting. */
export function imageLookLines(look: Look): string[] {
  const lines: string[] = [];
  if (look.style && look.style !== 'my-method') lines.push(IMAGE_STYLE[look.style]);
  if (look.baseSetting) lines.push(IMAGE_BASE[look.baseSetting]);
  const motif = cleanMotif(look.baseMotif);
  if (motif) lines.push(`Base theme: ${motif}.`);
  if (look.baseSetting || motif) lines.push(IMAGE_TERRAIN);
  return lines;
}
