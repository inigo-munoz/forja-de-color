import { addAdvice, createProject } from '../projects/project';
import type { AdviceEntry } from '../advice/schema';
import { renderAsk } from './ask-view';
import { renderProject } from './project-view';
import { renderProjects } from './projects-view';
import { makeDeps, mount, stubObjectUrls } from './test-helpers';

beforeEach(() => stubObjectUrls());

// capture="environment" forces the camera on Android and hides the gallery; the user must be
// able to pick an existing photo too.
describe('photo inputs let the user pick from the gallery', () => {
  it('on every screen that takes a photo', async () => {
    const deps = await makeDeps();
    await deps.repo.saveProject(addAdvice(createProject('B', deps.now(), 'p1'), { id: 'e', receivedAt: '', unknownPaints: [], unknownBrushes: [], response: { version: 1, kind: 'recipe', moment: 'start', prep: [], tips: [], zones: [] } } as AdviceEntry));
    for (const render of [() => renderProjects(mount(), deps), () => renderProject(mount(), deps, 'p1'), () => renderAsk(mount(), deps, 'p1')]) {
      await render();
      const inputs = [...document.querySelectorAll<HTMLInputElement>('input[type="file"][accept^="image"]')];
      expect(inputs.length).toBeGreaterThan(0);
      for (const input of inputs) expect(input.hasAttribute('capture')).toBe(false);
    }
  });
});
