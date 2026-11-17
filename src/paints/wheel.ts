import type { Paint } from './paint';

/** The painter's 12-colour RYB wheel (red, yellow and blue as primaries), clockwise from red. */
export const WHEEL = [
  'red', 'red-orange', 'orange', 'yellow-orange', 'yellow', 'yellow-green',
  'green', 'blue-green', 'blue', 'blue-violet', 'violet', 'red-violet',
] as const;

export type WheelColour = (typeof WHEEL)[number];
export type WheelKind = 'primary' | 'secondary' | 'tertiary';

const step = (c: WheelColour, n: number): WheelColour => WHEEL[(((WHEEL.indexOf(c) + n) % 12) + 12) % 12];

/** The opposite colour: the strongest contrast. */
export const complementary = (c: WheelColour): WheelColour => step(c, 6);

/** The two neighbours, counter-clockwise first: a soft harmony. */
export const analogous = (c: WheelColour): WheelColour[] => [step(c, -1), step(c, 1)];

/** The other two corners of the triangle, clockwise first: a balanced contrast. */
export const triad = (c: WheelColour): WheelColour[] => [step(c, 4), step(c, -4)];

export function kindOf(c: WheelColour): WheelKind {
  const i = WHEEL.indexOf(c);
  if (i % 4 === 0) return 'primary';
  return i % 2 === 0 ? 'secondary' : 'tertiary';
}

export function isWheelColour(s: string | undefined): s is WheelColour {
  return (WHEEL as readonly string[]).includes(s ?? '');
}

const HEX = /^#[0-9a-f]{6}$/i;
/** Below this saturation a colour reads as grey, black or white. */
const MIN_SATURATION = 0.2;
/** Below this brightness a colour reads as black. */
const MIN_VALUE = 0.15;
/** [screen hue, painter's wheel hue] in degrees: the RYB wheel gives yellow and orange more room. */
const RGB_TO_RYB: [number, number][] = [[0, 0], [30, 60], [60, 120], [120, 180], [180, 210], [240, 240], [280, 300], [360, 360]];

/**
 * Where a '#rrggbb' colour falls on the painter's wheel; null for greys, black, white and anything
 * that is not a readable colour. Same rule as the Android app.
 */
export function wheelColourOf(hex: string): WheelColour | null {
  const h = hex.trim();
  if (!HEX.test(h)) return null;
  const rgb = parseInt(h.slice(1), 16);
  const r = ((rgb >> 16) & 0xff) / 255;
  const g = ((rgb >> 8) & 0xff) / 255;
  const b = (rgb & 0xff) / 255;
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  if (max < MIN_VALUE || delta / max < MIN_SATURATION) return null;
  const hue = max === r ? 60 * ((((g - b) / delta) % 6) + 6) % 360
    : max === g ? 60 * ((b - r) / delta + 2)
      : 60 * ((r - g) / delta + 4);
  const ryb = toRyb(hue);
  return WHEEL[Math.floor(((ryb + 15) % 360) / 30)];
}

function toRyb(hue: number): number {
  for (let i = 1; i < RGB_TO_RYB.length; i++) {
    const [x0, y0] = RGB_TO_RYB[i - 1];
    const [x1, y1] = RGB_TO_RYB[i];
    if (hue <= x1) return y0 + ((hue - x0) / (x1 - x0)) * (y1 - y0);
  }
  return hue;
}

export interface WheelPaints {
  paintsOf(c: WheelColour): Paint[];
  /** Paints with no colour of their own: greys, black, white and metallics. */
  neutrals: Paint[];
}

/** Sorts paints by wheel colour, keeping their order; mediums are not colours and are left out. */
export function placeOnWheel(paints: Paint[]): WheelPaints {
  const coloured = new Map<WheelColour, Paint[]>();
  const neutrals: Paint[] = [];
  for (const p of paints) {
    if (p.type === 'medium') continue;
    const c = p.type === 'metallic' ? null : wheelColourOf(p.hex);
    if (c === null) neutrals.push(p);
    else coloured.set(c, [...(coloured.get(c) ?? []), p]);
  }
  return { paintsOf: (c) => coloured.get(c) ?? [], neutrals };
}

/** A group of paints in "My paints": one wheel colour, the neutrals, or the mediums. */
export type ColourGroup = WheelColour | 'neutrals' | 'mediums';

/**
 * Paints grouped by where they fall on the wheel (wheelColourOf, the same rule as the colour wheel),
 * in wheel order, then the neutrals (greys, black, white, metallics), then the mediums, which are not
 * colours. Empty groups are left out and each group keeps the paints' order. Same as the Android app.
 */
export function groupByColour(paints: Paint[]): [ColourGroup, Paint[]][] {
  const wheel = placeOnWheel(paints);
  const all: [ColourGroup, Paint[]][] = [
    ...WHEEL.map((c): [ColourGroup, Paint[]] => [c, wheel.paintsOf(c)]),
    ['neutrals', wheel.neutrals],
    ['mediums', paints.filter((p) => p.type === 'medium')],
  ];
  return all.filter(([, list]) => list.length > 0);
}
