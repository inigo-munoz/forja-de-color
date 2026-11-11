import { CARD_IDS, type CardId } from '../techniques/cards';
import { copy } from './copy';
import { h, type Deps } from './dom';
import { renderInventory } from './inventory-view';
import { renderSettings } from './settings-view';
import { renderTechnique } from './technique-view';

export type Route =
  | { name: 'projects' }
  | { name: 'project'; id: string }
  | { name: 'ask'; id: string }
  | { name: 'inventory' }
  | { name: 'settings' }
  | { name: 'technique'; id: CardId };

export function parseRoute(hash: string): Route {
  const [, name, id] = hash.replace(/^#\/?/, '/').split('/');
  if ((name === 'project' || name === 'ask') && id) return { name, id: decodeURIComponent(id) };
  if (name === 'inventory' || name === 'settings') return { name };
  if (name === 'technique' && (CARD_IDS as readonly string[]).includes(id)) return { name, id: id as CardId };
  return { name: 'projects' };
}

export type ViewRenderers = {
  projects: (root: HTMLElement, deps: Deps) => Promise<void>;
  project: (root: HTMLElement, deps: Deps, id: string) => Promise<void>;
  ask: (root: HTMLElement, deps: Deps, id: string) => Promise<void>;
};

/** Mounts the app shell and renders the view for the current hash on every change. */
export function startRouter(app: HTMLElement, deps: Omit<Deps, 'navigate'>, views: ViewRenderers): void {
  const main = h('main', { id: 'view' });
  const navigate = (hash: string) => {
    location.hash = hash;
  };
  const full: Deps = { ...deps, navigate };
  app.replaceChildren(
    h('header', { class: 'topbar' },
      h('a', { href: '#/projects', class: 'brand' }, copy.appName),
      h('nav', {},
        h('a', { href: '#/projects' }, copy.nav.projects),
        h('a', { href: '#/inventory' }, copy.nav.inventory),
        h('a', { href: '#/settings' }, copy.nav.settings))),
    main,
  );
  const render = async () => {
    const route = parseRoute(location.hash);
    switch (route.name) {
      case 'projects': return views.projects(main, full);
      case 'project': return views.project(main, full, route.id);
      case 'ask': return views.ask(main, full, route.id);
      case 'inventory': return renderInventory(main, full);
      case 'settings': return renderSettings(main, full);
      case 'technique': return renderTechnique(main, full, route.id);
    }
  };
  window.addEventListener('hashchange', () => void render());
  void render();
}
