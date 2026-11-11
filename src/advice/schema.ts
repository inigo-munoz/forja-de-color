import type { PaintRef } from '../paints/paint';

export type Moment = 'start' | 'half-painted' | 'during';
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
  moment: 'start' | 'half-painted';
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
}

export interface AdviceRequest {
  moment: Moment;
  zone?: string;
  question?: Question;
  freeText?: string;
}

export interface AdvicePackage {
  text: string;
  image: Blob;
}
