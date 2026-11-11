import type { TechniqueCardId } from '../advice/schema';

export type CardId = TechniqueCardId;
export const CARD_IDS: readonly CardId[] = ['slapchop', 'dilution', 'bsl', 'drybrush'];

// Card text is the user's, written from their BSL book — never AI-generated (spec §6.4).
const files = import.meta.glob<string>('./cards/*.md', { query: '?raw', import: 'default', eager: true });

export function getCard(id: CardId): { id: CardId; title: string; markdown: string } {
  const markdown = files[`./cards/${id}.md`] ?? '';
  const title = markdown.match(/^# (.+)$/m)?.[1].trim() ?? id;
  return { id, title, markdown };
}
