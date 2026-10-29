// Reusable heraldic ornaments taken from the crest: star, flame, shield, divider, ribbon banner.
// Later screens (timer, dashboard) should use these instead of inventing new decorations.
// Colours come from CSS ("currentColor"), so the same icon works in gold, flame or parchment.

import { h } from './dom';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(viewBox: string, className: string, inner: string): SVGSVGElement {
  const el = document.createElementNS(SVG_NS, 'svg');
  el.setAttribute('viewBox', viewBox);
  el.setAttribute('class', className);
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = inner; // fixed drawing code only – never user text
  return el;
}

// Eight-pointed star as on the shield: four long points, four short ones.
const STAR_POINTS = Array.from({ length: 16 }, (_, i) => {
  const r = i % 4 === 0 ? 12 : i % 4 === 2 ? 5.5 : 1.7;
  const a = (i * Math.PI) / 8 - Math.PI / 2;
  return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
}).join(' ');

export function star(className = 'icon'): SVGSVGElement {
  return svg('-12 -12 24 24', `star ${className}`, `<polygon points="${STAR_POINTS}" fill="currentColor"/>`);
}

/** The flame from the crest. Add class "burning" to make it glow (used by the timer). */
export function flame(className = 'icon'): SVGSVGElement {
  return svg(
    '0 0 24 32',
    `flame ${className}`,
    `<path fill="currentColor" d="M12 1c1.6 4.4 6.8 7.4 6.8 15.2 0 6.6-3.4 11.6-6.8 14.3-3.4-2.7-6.8-7.7-6.8-14.3 0-4.6 2.4-7 3.6-10.4 1 2.6 1.7 4 2.8 5.2C11.4 7.8 10.9 4.6 12 1z"/>` +
      `<path fill="var(--bg)" opacity=".55" d="M12 14c1.2 2.6 3.3 4.6 3.3 8.2 0 3.3-1.6 5.6-3.3 7-1.7-1.4-3.3-3.7-3.3-7 0-2.4 1.2-3.6 1.8-5.2.5 1.2.9 1.8 1.5 2.4 0-1.9-.4-3.5 0-5.4z"/>`,
  );
}

/** A small heraldic shield, optionally with a letter on it (e.g. a project's first letter). */
export function shield(letter = '', className = 'shield-icon'): HTMLElement {
  const outline = svg(
    '0 0 24 28',
    'shield-shape',
    `<path d="M2 2.5h20V12c0 7.6-4.6 11.6-10 14.5C6.6 23.6 2 19.6 2 12z" fill="var(--surface)" stroke="currentColor" stroke-width="1.5"/>`,
  );
  return h('span', { class: className }, outline, letter ? h('span', { class: 'shield-letter' }, letter) : star('shield-star'));
}

/** A round seal with a star – stands for the account / signing in. */
export function seal(className = 'icon'): SVGSVGElement {
  return svg(
    '-12 -12 24 24',
    `seal ${className}`,
    `<circle r="10.5" fill="none" stroke="currentColor" stroke-width="1.6"/>` +
      `<g transform="scale(.55)"><polygon points="${STAR_POINTS}" fill="currentColor"/></g>`,
  );
}

/** An oak-leaf sprig with an acorn, for the corners of dashboard panels (dashboard only). */
export function oakSprig(className = 'sprig'): SVGSVGElement {
  const leaf = (x: number, y: number, angle: number) =>
    `<path transform="translate(${x} ${y}) rotate(${angle})" fill="currentColor" ` +
    `d="M0 0c2-1 2.5-3 4.5-3.2c-.4 1.2.6 1.6 1.8 1.4c-.5 1.3.3 2 1.6 2.1c-.8 1-.8 1.9.2 2.6` +
    `c-1.4.6-2.9.3-4-.5c-.3 1.1-1.5 1.4-2.6.9C1 2.6.4 1.4 0 0z"/>`;
  return svg(
    '0 0 40 40',
    className,
    `<path d="M3 3c7 4 13 10 17 18" fill="none" stroke="currentColor" stroke-width="1.2"/>` +
      leaf(8, 6, 20) +
      leaf(13, 11, 70) +
      leaf(16, 16, 15) +
      `<ellipse cx="21" cy="23" rx="2.4" ry="3" fill="currentColor"/>` +
      `<path d="M18.4 21.2h5.2" stroke="currentColor" stroke-width="1.6"/>`,
  );
}

/** A gold line with a star in the middle, used to separate sections. */
export function divider(): HTMLElement {
  return h('div', { class: 'divider', role: 'separator' }, star());
}

/** A ribbon banner, used for page titles and for completed milestones. */
export function banner(text: string, className = 'banner'): HTMLElement {
  return h('div', { class: className }, h('span', {}, text));
}
