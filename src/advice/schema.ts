import type { Look } from '../projects/style';
import type { PaintRef } from '../paints/paint';

export type Moment = 'start' | 'primed' | 'half-painted' | 'during';
export type Question = 'apply-layer' | 'light' | 'shadow' | 'highlight' | 'which-technique' | 'free';
export type TechniqueCardId = 'slapchop' | 'dilution' | 'bsl' | 'drybrush';

export interface ZoneRecipe {
  name: string;
  technique: 'slapchop' | 'bsl';
  /** Slapchop: required, with a dilution "N:M" (paint:medium). */
  paint?: PaintRef;
  dilution?: string;
  /** BSL: required. */
  bsl?: { base: PaintRef; shadow: PaintRef; light: PaintRef };
  steps: string[];
  brush?: string;
  alreadyPainted?: boolean;
}

export interface RecipeResponse {
  version: 1;
  kind: 'recipe';
  moment: 'start' | 'primed' | 'half-painted';
  /** Empty for primed: the miniature is already primed and drybrushed. */
  prep: string[];
  zones: ZoneRecipe[];
  tips: string[];
  /** half-painted only */
  complements?: PaintRef[];
  remainingSteps?: string[];
}

export interface ConsultationResponse {
  version: 1;
  kind: 'consultation';
  zone: string;
  question: Question;
  technique: string;
  steps: string[];
  paints: { paint: PaintRef; dilution?: string }[];
  brush?: string;
  techniqueCard?: TechniqueCardId;
}

export type AdviceResponse = RecipeResponse | ConsultationResponse;

export interface AdviceEntry {
  id: string;
  receivedAt: string;
  response: AdviceResponse;
  unknownPaints: PaintRef[];
  unknownBrushes: string[];
  /** Recipes only: indices into response.zones the user ticked off as painted, sorted and unique. Absent when none. */
  doneZones?: number[];
}

export interface AdviceRequest extends Look {
  moment: Moment;
  /** Half-painted: the project's latest recipe and the zones ticked as painted. */
  previous?: { response: RecipeResponse; doneZones?: number[] };
  zone?: string;
  question?: Question;
  freeText?: string;
}

export interface AdvicePackage {
  text: string;
  image: Blob;
  /** More angles of the miniature, shared after the main image. */
  extraImages?: Blob[];
}
