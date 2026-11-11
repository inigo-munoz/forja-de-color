import { registerServiceWorker } from './pwa';
import { createShareBridge } from './platform/share-bridge';
import { openIndexedDbRepository } from './storage/indexeddb';
import { renderAsk } from './ui/ask-view';
import { renderProject } from './ui/project-view';
import { renderProjects } from './ui/projects-view';
import { startRouter } from './ui/router';
import './ui/styles.css';

async function boot(): Promise<void> {
  const app = document.querySelector<HTMLElement>('#app');
  if (!app) return;
  const repo = await openIndexedDbRepository();
  startRouter(app, { repo, bridge: createShareBridge(), now: () => new Date() }, {
    projects: renderProjects,
    project: renderProject,
    ask: renderAsk,
  });
}

void boot();
registerServiceWorker();
