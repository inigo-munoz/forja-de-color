import { getCard, type CardId } from '../techniques/cards';
import { h, show, type Deps } from './dom';

export async function renderTechnique(root: HTMLElement, _deps: Deps, id: CardId): Promise<void> {
  const card = getCard(id);
  show(root, h('h2', {}, card.title), h('pre', { class: 'card markdown' }, card.markdown.replace(/^# .+\n+/, '')));
}
