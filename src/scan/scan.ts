import { extractJson } from '../advice/parse';
import { lookUpInCatalogue } from '../paints/catalogue';
import { addBrush, findBrush, findPaint, savePaintKeepingFamily } from '../paints/inventory';
import { normalizeCode, paintKey, type Brush, type Inventory, type Paint, type PaintType } from '../paints/paint';

/** Longest pasted answer read; a photo of a shelf yields a few kilobytes of JSON. */
export const MAX_SCAN_ANSWER_CHARS = 100_000;
/** Most paints, and most brushes, taken from one answer. */
export const MAX_SCAN_ITEMS = 200;
/** Colour given to a paint whose colour the AI did not give or gave in another form. */
export const UNKNOWN_HEX = '#888888';

// Only in the scan instructions, never in a real answer: the user pasted the prompt.
const PROMPT_MARKER = 'PAINT SCAN FORMAT';
const HEX = /^#[0-9a-f]{6}$/i;
const TYPES: PaintType[] = ['opaque', 'wash', 'metallic', 'medium', 'primer', 'other'];

/** The fixed instructions sent with the photo. Same text as the Android app (domain/scan/InventoryScan.kt). */
export function buildScanPrompt(): string {
  return [
    'You are helping a miniature painter add their paints and brushes to Forja de Color.',
    'Look at the photo and list every paint bottle and every brush you can identify.',
    '',
    'Rules:',
    '- Only list what you can see. If you cannot read a code, leave "code" empty instead of guessing.',
    '- For each paint, search the web (the maker\'s site or a colour chart) for its official name in Spanish ("nameEs") and in English ("nameEn") and its real colour ("hex", as #rrggbb). If you cannot confirm a name or the colour, leave it empty instead of inventing it.',
    '- "brand" is the maker (for example Vallejo, Citadel, Army Painter) and "range" the product line (for example Game Color, Model Color).',
    '- "type" is one of: opaque, wash, metallic, medium, primer, other.',
    '- For a brush, "code" is the size or model printed on it (for example 2, 0, 5/0) and "name" a short description.',
    '',
    `${PROMPT_MARKER} (reply with this JSON only):`,
    '```json',
    '{',
    '  "version": 1,',
    '  "kind": "inventory",',
    '  "paints": [',
    '    { "brand": "Vallejo", "code": "72.001", "nameEs": "Blanco Calavera", "nameEn": "Dead White", "range": "Game Color", "type": "opaque", "hex": "#ffffff" }',
    '  ],',
    '  "brushes": [',
    '    { "code": "2", "name": "Round synthetic" }',
    '  ]',
    '}',
    '```',
  ].join('\n');
}

/**
 * A paint read from the photo; existing is the owned paint it would update, if any; fromCatalogue when
 * its data comes from the paint catalogue rather than the AI.
 */
export interface ScannedPaint { paint: Paint; existing?: Paint; fromCatalogue?: boolean }
/** A brush read from the photo; existing is the owned brush it would update, if any. */
export interface ScannedBrush { brush: Brush; existing?: Brush }

export type ScanResult =
  | { ok: true; paints: ScannedPaint[]; brushes: ScannedBrush[] }
  | { ok: false; errors: string[] };

const fail = (message: string): ScanResult => ({ ok: false, errors: [message] });
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (o: Record<string, unknown>, key: string) => (typeof o[key] === 'string' ? (o[key] as string).trim() : typeof o[key] === 'number' ? String(o[key]) : '');

/** The array at key; empty when absent, null when it is something else. */
function list(o: Record<string, unknown>, key: string): unknown[] | null {
  if (!(key in o)) return [];
  return Array.isArray(o[key]) ? (o[key] as unknown[]) : null;
}

function toPaint(e: unknown): Paint | null {
  if (!isObj(e)) return null;
  const brand = text(e, 'brand');
  const code = text(e, 'code');
  const nameEn = text(e, 'nameEn');
  // Spanish is the app's main name; an answer with only "name" or only "nameEn" still works.
  const name = text(e, 'nameEs') || text(e, 'name') || nameEn;
  if (!code && !name) return null;
  const type = TYPES.find((t) => t === text(e, 'type').toLowerCase()) ?? 'other';
  const hex = HEX.test(text(e, 'hex')) ? text(e, 'hex').toLowerCase() : UNKNOWN_HEX;
  return { brand, code: code ? normalizeCode(brand, code) : '', name, ...(nameEn ? { nameEn } : {}), range: text(e, 'range'), type, hex };
}

function toBrush(e: unknown): Brush | null {
  if (!isObj(e)) return null;
  const code = text(e, 'code');
  const name = text(e, 'name');
  return code || name ? { code, name } : null;
}

function distinctBy<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((t) => (seen.has(key(t)) ? false : (seen.add(key(t)), true)));
}

/**
 * Reads the AI's list of paints and brushes. Lenient with each item (unknown type → other, unreadable
 * colour → UNKNOWN_HEX, missing code kept empty for the user to fill in), strict with the shape.
 * Nothing is saved here: the user confirms each item first. Same rules and messages as Android.
 */
export function parseScanAnswer(raw: string, inv: Inventory): ScanResult {
  if (raw.length > MAX_SCAN_ANSWER_CHARS) return fail('the answer is too long');
  if (raw.includes(PROMPT_MARKER)) return fail('this is the prompt, not the AI answer: paste what the AI replied');
  const json = extractJson(raw);
  if (json === null) return fail('no JSON found in the answer');
  let root: unknown;
  try {
    root = JSON.parse(json);
  } catch (e) {
    return fail(`invalid JSON: ${(e as Error).message.split('\n')[0]}`);
  }
  if (!isObj(root)) return fail('version must be 1');
  const version = typeof root.version === 'number' ? root.version : typeof root.version === 'string' ? Number(root.version) : NaN;
  if (version !== 1) return fail('version must be 1');
  if (text(root, 'kind') !== 'inventory') return fail('this answer is not a paint list');
  const paintItems = list(root, 'paints');
  if (paintItems === null) return fail('paints must be a list');
  const brushItems = list(root, 'brushes');
  if (brushItems === null) return fail('brushes must be a list');

  const paints = distinctBy(paintItems.map(toPaint).filter((p): p is Paint => p !== null),
    (p) => (p.code ? paintKey(p) : `name:${p.brand}|${p.name}`))
    .slice(0, MAX_SCAN_ITEMS)
    .map((paint) => ({ paint, existing: paint.code ? findPaint(inv, paint) : undefined }));
  const brushes = distinctBy(brushItems.map(toBrush).filter((b): b is Brush => b !== null), (b) => b.code.toLowerCase())
    .slice(0, MAX_SCAN_ITEMS)
    .map((brush) => ({ brush, existing: brush.code ? findBrush(inv, brush.code) : undefined }));
  if (!paints.length && !brushes.length) return fail('the AI did not find any paints or brushes');
  return { ok: true, paints, brushes };
}

/** A paint can be saved once it has a brand, a code, a name and a readable colour. */
export function isComplete(p: Paint): boolean {
  return !!p.brand.trim() && !!p.code.trim() && !!p.name.trim() && HEX.test(p.hex);
}

/** Saves what the user confirmed; items still missing a brand, code or name are skipped. */
export function applyScan(inv: Inventory, paints: Paint[], brushes: Brush[]): Inventory {
  const withPaints = paints.filter(isComplete).reduce(savePaintKeepingFamily, inv);
  return brushes.filter((b) => b.code.trim() && b.name.trim()).reduce(addBrush, withPaints);
}

/**
 * Looks every scanned paint up in the catalogue first (lookUpInCatalogue): found ones take the
 * catalogue's data and are flagged; owned paints are found again with the corrected codes, and two rows
 * that turn out to be the same paint are kept once.
 */
export function checkInCatalogue(result: Extract<ScanResult, { ok: true }>, inv: Inventory): Extract<ScanResult, { ok: true }> {
  const checked = result.paints.map((s) => lookUpInCatalogue(s.paint));
  const paints = distinctBy(checked, ({ paint }) => (paint.code ? paintKey(paint) : `name:${paint.brand}|${paint.name}`))
    .map(({ paint, fromCatalogue }) => ({ paint, fromCatalogue, existing: paint.code ? findPaint(inv, paint) : undefined }));
  return { ...result, paints };
}
