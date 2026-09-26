/**
 * Dependency-free class-name composition with Tailwind-aware conflict
 * resolution.
 *
 * `cn('px-2', 'px-4')` keeps only `px-4`; `cn('text-sm text-red-500')` keeps
 * both because they target different properties. Conflicts are detected by
 * mapping a utility to a *group* (the CSS property it drives) so the later
 * class in the argument list always wins — the behaviour `tailwind-merge`
 * provides, scoped to the utilities this project actually uses.
 *
 * Server-safe and pure.
 */

export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | { [key: string]: boolean | null | undefined };

/**
 * Group patterns, evaluated in order. A utility matches the first pattern whose
 * expression covers it; anything unmatched gets a group of its own and is
 * therefore never dropped.
 */
const GROUP_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  // Layout
  ['display', /^((?!-)[-\w]+:)*-?(block|inline-block|inline|flex|inline-flex|grid|inline-grid|table|inline-table|contents|flow-root|list-item|hidden)$/],
  ['position', /^((?!-)[-\w]+:)*-?(static|fixed|absolute|relative|sticky)$/],
  ['inset', /^((?!-)[-\w]+:)*-?(inset|inset-x|inset-y|top|right|bottom|left|start|end)-/],
  ['z-index', /^((?!-)[-\w]+:)*-?z-/],
  ['flex-basis', /^((?!-)[-\w]+:)*-?(basis|order)-/],
  ['flex-direction', /^((?!-)[-\w]+:)*-?flex-(row|row-reverse|col|col-reverse)$/],
  ['flex-wrap', /^((?!-)[-\w]+:)*-?flex-(wrap|wrap-reverse|nowrap)$/],
  ['flex', /^((?!-)[-\w]+:)*-?flex-(grow|shrink)$/],
  ['gap', /^((?!-)[-\w]+:)*-?(gap|gap-x|gap-y)-/],
  ['justify', /^((?!-)[-\w]+:)*-?justify-/],
  ['items', /^((?!-)[-\w]+:)*-?items-/],
  ['self', /^((?!-)[-\w]+:)*-?self-/],
  ['content', /^((?!-)[-\w]+:)*-?content-/],
  ['grid-template-columns', /^((?!-)[-\w]+:)*-?grid-cols-/],
  ['grid-template-rows', /^((?!-)[-\w]+:)*-?grid-rows-/],
  ['grid-column', /^((?!-)[-\w]+:)*-?col-(start|end)-/],
  ['grid-column-span', /^((?!-)[-\w]+:)*-?col-span-/],
  ['grid-row', /^((?!-)[-\w]+:)*-?row-(start|end)-/],
  ['grid-row-span', /^((?!-)[-\w]+:)*-?row-span-/],
  ['overflow', /^((?!-)[-\w]+:)*-?overflow(-[xy])?-/],
  ['overscroll', /^((?!-)[-\w]+:)*-?overscroll(-[xy])?-/],
  ['object', /^((?!-)[-\w]+:)*-?object-/],
  // Box model
  ['padding', /^((?!-)[-\w]+:)*-?(p|px|py|pt|pr|pb|pl|ps|pe)-/],
  ['margin', /^((?!-)[-\w]+:)*-?(m|mx|my|mt|mr|mb|ml|ms|me)-/],
  ['width', /^((?!-)[-\w]+:)*-?(w|min-w|max-w)-/],
  ['height', /^((?!-)[-\w]+:)*-?(h|min-h|max-h)-/],
  ['size', /^((?!-)[-\w]+:)*-?(size|min-size|max-size)-/],
  // Border
  ['rounded', /^((?!-)[-\w]+:)*-?rounded(-[a-z]+)?(-[a-z0-9\[\]\.%#/_-]+)?(\/.*)?$/],
  ['border-width', /^((?!-)[-\w]+:)*-?border(-[xytrble])?(-[0-9.]+)?$/],
  ['border-color', /^((?!-)[-\w]+:)*-?border(-[xytrble])?-[a-z0-9\[\]#\/%().,_-]+$/],
  ['outline', /^((?!-)[-\w]+:)*-?outline(-offset)?(-[a-z0-9%._-]+)?$/],
  // Colour
  ['bg', /^((?!-)[-\w]+:)*-?bg-[a-z0-9\[\]#\/%().,_-]+$/],
  ['text-color', /^((?!-)[-\w]+:)*-?text-(?!(xs|sm|base|lg|xl|[2-9]xl|left|center|right|justify|start|end|uppercase|lowercase|capitalize|underline|line-through|overline|truncate|wrap|nowrap|balance|pretty|ellipsis|indent|opacity|decoration|transform|shadow|blur|overflow|clip|wrap-anywhere)\b)[a-z0-9\[\]#\/%().,_-]+$/],
  ['text-align', /^((?!-)[-\w]+:)*-?text-(left|center|right|justify|start|end)$/],
  ['text-size', /^((?!-)[-\w]+:)*-?text-(xs|sm|base|lg|xl|[2-9]xl)$/],
  ['fill', /^((?!-)[-\w]+:)*-?fill-[a-z0-9\[\]#\/%().,_-]+$/],
  ['stroke', /^((?!-)[-\w]+:)*-?stroke-(?!width-)[a-z0-9\[\]#\/%().,_-]+$/],
  ['stroke-width', /^((?!-)[-\w]+:)*-?stroke-(width-)?[0-9.]+$/],
  ['opacity', /^((?!-)[-\w]+:)*-?opacity-/],
  ['shadow', /^((?!-)[-\w]+:)*-?shadow(-[a-z]+)?(-[a-z0-9\[\]#\/%().,_-]+)?$/],
  ['ring', /^((?!-)[-\w]+:)*-?ring(-offset)?(-[a-z0-9\[\]#\/%().,_-]+)?$/],
  // Typography
  ['font-family', /^((?!-)[-\w]+:)*-?font-(sans|serif|mono|system-ui)$/],
  ['font-weight', /^((?!-)[-\w]+:)*-?font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/],
  ['font-style', /^((?!-)[-\w]+:)*-?italic$/],
  ['letter-spacing', /^((?!-)[-\w]+:)*-?tracking-/],
  ['line-height', /^((?!-)[-\w]+:)*-?(leading|line-clamp)-/],
  ['list-style', /^((?!-)[-\w]+:)*-?list-/],
  // Effects & motion
  ['transform', /^((?!-)[-\w]+:)*-?(transform|translate-[xy]|scale|rotate|skew|origin)-?/],
  ['transform-origin', /^((?!-)[-\w]+:)*-?origin-/],
  ['transition', /^((?!-)[-\w]+:)*-?transition(-[a-z-]+)?(-[0-9.]+)?$/],
  ['duration', /^((?!-)[-\w]+:)*-?duration-/],
  ['ease', /^((?!-)[-\w]+:)*-?ease-(linear|in-out|out|in|initial|\[)/],
  ['delay', /^((?!-)[-\w]+:)*-?delay-/],
  ['filter', /^((?!-)[-\w]+:)*-?(filter|blur|backdrop-blur)-/],
  ['mix-blend', /^((?!-)[-\w]+:)*-?mix-blend-/],
  // Interactivity
  ['cursor', /^((?!-)[-\w]+:)*-?cursor-/],
  ['pointer-events', /^((?!-)[-\w]+:)*-?pointer-events-/],
  ['user-select', /^((?!-)[-\w]+:)*-?(select-none|select-text|select-all|select-auto)$/],
  ['appearance', /^((?!-)[-\w]+:)*-?appearance-/],
  ['resize', /^((?!-)[-\w]+:)*-?resize(-[xy])?$/],
  // Effects that must not collide with the rest
  ['visibility', /^((?!-)[-\w]+:)*-?(visible|invisible)$/],
];

function collect(input: ClassValue, out: string[]): void {
  if (input === null || input === undefined || input === false) return;
  if (typeof input === 'string') {
    for (const token of input.split(/\s+/)) {
      if (token.length > 0) out.push(token);
    }
    return;
  }
  if (typeof input === 'number') {
    out.push(String(input));
    return;
  }
  if (Array.isArray(input)) {
    for (const item of input) collect(item, out);
    return;
  }
  for (const [key, enabled] of Object.entries(input)) {
    if (enabled) out.push(key);
  }
}

/** Returns the conflict group a utility belongs to, or `null` when ungrouped. */
export function utilityGroup(utility: string): string | null {
  for (const [group, pattern] of GROUP_PATTERNS) {
    if (pattern.test(utility)) return group;
  }
  return null;
}

function groupWithModifiers(utility: string): { modifiers: string; group: string | null } {
  const parts = utility.split(':');
  const base = parts.pop() ?? utility;
  return { modifiers: parts.join(':'), group: utilityGroup(base) };
}

/**
 * Joins class values and resolves Tailwind conflicts so the last utility of a
 * given property wins. Unknown utilities are preserved verbatim.
 */
export function cn(...inputs: ClassValue[]): string {
  const tokens: string[] = [];
  for (const input of inputs) collect(input, tokens);

  const lastIndexByGroup = new Map<string, number>();
  tokens.forEach((token, index) => {
    const { modifiers, group } = groupWithModifiers(token);
    if (group === null) return;
    // `hover:bg-x` and `bg-x` live in different namespaces.
    lastIndexByGroup.set(`${modifiers}::${group}`, index);
  });

  const result: string[] = [];
  tokens.forEach((token, index) => {
    const { modifiers, group } = groupWithModifiers(token);
    if (group === null) {
      result.push(token);
      return;
    }
    if (lastIndexByGroup.get(`${modifiers}::${group}`) === index) {
      result.push(token);
    }
  });

  return result.join(' ');
}

export default cn;
