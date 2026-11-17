import { BASE_SETTINGS, PAINTING_STYLES, isBaseSetting, isPaintingStyle, type Look } from '../projects/style';
import { copy } from './copy';
import { h } from './dom';

/**
 * The painting style and base setting as two selects, each with a line for beginners. Every change
 * calls [onChange] with the whole look; the caller saves it in the project.
 */
export function lookFields(look: Look, onChange: (look: Look) => void): HTMLElement {
  const c = copy.look;
  const style = h('select', { 'data-testid': 'look-style' },
    ...PAINTING_STYLES.map((s) => h('option', { value: s }, c.styles[s].name)));
  style.value = look.style ?? 'my-method';
  const base = h('select', { 'data-testid': 'look-base' },
    h('option', { value: '' }, c.noBase),
    ...BASE_SETTINGS.map((b) => h('option', { value: b }, c.bases[b].name)));
  base.value = look.baseSetting ?? '';
  const styleHelp = h('p', { class: 'hint', 'data-testid': 'look-style-help' });
  const baseHelp = h('p', { class: 'hint', 'data-testid': 'look-base-help' });
  const current = (): Look => ({
    style: isPaintingStyle(style.value) ? style.value : 'my-method',
    ...(isBaseSetting(base.value) ? { baseSetting: base.value } : {}),
  });
  const explain = () => {
    const l = current();
    styleHelp.textContent = c.styles[l.style ?? 'my-method'].help;
    baseHelp.textContent = l.baseSetting ? c.bases[l.baseSetting].help : '';
  };
  explain();
  for (const el of [style, base]) {
    el.addEventListener('change', () => {
      explain();
      onChange(current());
    });
  }
  return h('fieldset', { class: 'look', 'data-testid': 'look' },
    h('legend', {}, c.title),
    h('label', {}, c.style, style), styleHelp,
    h('label', {}, c.base, base), baseHelp);
}
