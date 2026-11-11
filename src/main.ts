import { registerServiceWorker } from './pwa';

const root = document.querySelector<HTMLElement>('#app');
if (root) root.textContent = 'Forja de Color';
registerServiceWorker();
