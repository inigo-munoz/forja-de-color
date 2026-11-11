import { registerServiceWorker } from './pwa';
import { createShareBridge } from './platform/share-bridge';
import { openIndexedDbRepository } from './storage/indexeddb';
import { h } from './ui/dom';
import { renderProject } from './ui/project-view';
import { renderProjects } from './ui/projects-view';
import { startRouter } from './ui/router';
import './ui/styles.css';

const placeholder = async (root: HTMLElement) => {
  root.replaceChildren(h('p', {}, '…'));
};

async function boot(): Promise<void> {
  const app = document.querySelector<HTMLElement>('#app');
  if (!app) return;
  const repo = await openIndexedDbRepository();
  startRouter(app, { repo, bridge: createShareBridge(), now: () => new Date() }, {
    projects: renderProjects,
    project: renderProject,
    ask: placeholder,
  });
}

void boot();
registerServiceWorker();
