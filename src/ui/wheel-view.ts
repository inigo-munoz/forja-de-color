import type { Paint } from '../paints/paint';
import { analogous, complementary, kindOf, placeOnWheel, triad, WHEEL, type WheelColour, type WheelPaints } from '../paints/wheel';
import { copy } from './copy';
import { h, show, swatch, type Deps } from './dom';

/** The classic painter's wheel swatches. */
const WHEEL_HEX: Record<WheelColour, string> = {
  'red': '#fe2712', 'red-orange': '#fc600a', 'orange': '#fb9902', 'yellow-orange': '#fccc1a',
  'yellow': '#fefe33', 'yellow-green': '#b2d732', 'green': '#66b032', 'blue-green': '#347c98',
  'blue': '#0247fe', 'blue-violet': '#4424d6', 'violet': '#8601af', 'red-violet': '#c21460',
};

const SVG = 'http://www.w3.org/2000/svg';
const OUTER = 118;
const POP = 14;
const HOLE = 48;

function svg(tag: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** A ring sector from [from] to [to] degrees (0 = right, clockwise, as in SVG). */
function sectorPath(from: number, to: number, outer: number): string {
  const p = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  };
  return `M ${p(outer, from)} A ${outer} ${outer} 0 0 1 ${p(outer, to)} L ${p(HOLE, to)} A ${HOLE} ${HOLE} 0 0 0 ${p(HOLE, from)} Z`;
}

function wheelSvg(selected: WheelColour | undefined, onSelect: (c: WheelColour) => void): SVGElement {
  const lit = selected ? new Set([selected, complementary(selected), ...analogous(selected), ...triad(selected)]) : null;
  const root = svg('svg', { viewBox: '-140 -140 280 280', class: 'wheel', role: 'group', 'aria-label': copy.wheel.title });
  WHEEL.forEach((c, i) => {
    const centre = -90 + i * 30;
    const on = !lit || lit.has(c);
    const path = svg('path', {
      d: sectorPath(centre - 14.5, centre + 14.5, lit && on ? OUTER + POP : OUTER),
      fill: WHEEL_HEX[c],
      opacity: on ? 1 : 0.25,
      class: c === selected ? 'sector selected' : 'sector',
      role: 'button',
      tabindex: 0,
      'aria-label': copy.wheel.colours[c],
      'aria-pressed': String(c === selected),
      'data-testid': `sector-${c}`,
    });
    path.addEventListener('click', () => onSelect(c));
    path.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') onSelect(c);
    });
    root.append(path);
  });
  return root;
}

function paintList(paints: Paint[]): HTMLElement {
  if (!paints.length) return h('p', { class: 'hint', 'data-testid': 'no-paints' }, copy.wheel.noPaints);
  return h('ul', {}, ...paints.map((p) => h('li', { class: 'paint-row' }, swatch(p.hex), h('span', { class: 'code' }, p.code), ` ${p.name}`)));
}

function colourHeading(c: WheelColour): HTMLElement {
  return h('h4', {}, swatch(WHEEL_HEX[c]), copy.wheel.colours[c]);
}

function harmony(testid: string, title: string, hint: string, colours: WheelColour[], wheel: WheelPaints): HTMLElement {
  return h('section', { class: 'family', 'data-testid': testid },
    h('h3', {}, title),
    h('p', { class: 'hint' }, hint),
    ...colours.flatMap((c) => [colourHeading(c), paintList(wheel.paintsOf(c))]));
}

/**
 * The painter's colour wheel. A chosen colour (from the address, #/wheel/<colour>) is outlined, its
 * harmonies come forward and the rest dims; below, each harmony lists the user's paints of that colour.
 */
export async function renderWheel(root: HTMLElement, deps: Deps, selected?: WheelColour): Promise<void> {
  const inv = await deps.repo.getInventory();
  const wheel = placeOnWheel(inv.paints);
  const w = copy.wheel;
  show(root,
    h('h2', {}, w.title),
    selected ? null : h('p', { class: 'hint', 'data-testid': 'wheel-hint' }, w.hint),
    h('div', { class: 'wheel-box' }, wheelSvg(selected, (c) => deps.navigate(`#/wheel/${c}`))),
    selected ? h('section', { class: 'family', 'data-testid': 'wheel-selected' },
      h('h3', {}, swatch(WHEEL_HEX[selected]), w.colours[selected]),
      h('p', { class: 'hint' }, w.kinds[kindOf(selected)]),
      h('h4', {}, w.yourPaints),
      paintList(wheel.paintsOf(selected))) : null,
    selected ? harmony('harmony-complementary', w.complementary, w.complementaryHint, [complementary(selected)], wheel) : null,
    selected ? harmony('harmony-analogous', w.analogous, w.analogousHint, analogous(selected), wheel) : null,
    selected ? harmony('harmony-triad', w.triad, w.triadHint, triad(selected), wheel) : null,
    h('section', { class: 'family', 'data-testid': 'wheel-neutrals' },
      h('h3', {}, w.neutrals),
      h('p', { class: 'hint' }, w.neutralsHint),
      paintList(wheel.neutrals)),
  );
}
