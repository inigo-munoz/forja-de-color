import { buildBrainInstructions } from '../advice/package';
import { readBytes } from '../storage/bytes';
import { exportAll, importAll, shouldRemindBackup, validateBackup } from '../storage/backup';
import { copy } from './copy';
import { download, h, show, type Deps } from './dom';

export async function renderSettings(root: HTMLElement, deps: Deps): Promise<void> {
  const remind = shouldRemindBackup(await deps.repo.getMeta('lastExportAt'), deps.now());
  const status = h('p', { 'data-testid': 'import-status', role: 'status' });

  const exportBtn = h('button', {
    'data-testid': 'export',
    onclick: async () => {
      const file = await exportAll(deps.repo, deps.now());
      const date = file.exportedAt.slice(0, 10);
      download(new Blob([JSON.stringify(file)], { type: 'application/json' }), `forja-de-color-${date}.json`);
      await renderSettings(root, deps);
    },
  }, copy.settings.export);

  const importInput = h('input', { type: 'file', accept: 'application/json', 'data-testid': 'import' });
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(await readBytes(file)));
    } catch {
      parsed = null;
    }
    importInput.value = '';
    const invalid = validateBackup(parsed);
    if (invalid) return void status.replaceChildren(h('span', { 'data-testid': 'import-error', class: 'error' }, invalid));
    if (!window.confirm(copy.settings.importConfirm)) return;
    const result = await importAll(deps.repo, parsed);
    status.replaceChildren(
      result.ok ? copy.settings.importOk : h('span', { 'data-testid': 'import-error', class: 'error' }, result.error),
    );
  });

  const copied = h('span', { role: 'status' });
  const brainBtn = h('button', {
    'data-testid': 'copy-brain',
    onclick: async () => {
      await navigator.clipboard.writeText(buildBrainInstructions(await deps.repo.getInventory()));
      copied.textContent = copy.settings.copied;
    },
  }, copy.settings.copyBrain);

  show(root, 
    h('h2', {}, copy.settings.title),
    remind ? h('p', { 'data-testid': 'backup-reminder', class: 'banner' }, copy.settings.backupReminder) : null,
    h('section', { class: 'card' }, exportBtn, h('label', { class: 'button' }, copy.settings.import, importInput), status),
    h('section', { class: 'card' }, h('h3', {}, copy.settings.brain), h('p', {}, copy.settings.brainHelp), brainBtn, copied),
  );
}
