/**
 * SVG sanitization boundary.
 *
 * `PreviewConfig.customSvgContent` is user-authored markup that is injected into
 * the stage through `dangerouslySetInnerHTML`, so it must be sanitized by
 * DOMPurify with the SVG profile — regex tag stripping is explicitly prohibited
 * by the spec and is also trivially bypassable.
 *
 * Design notes:
 * - The purifier instance is created lazily and only in a DOM-capable
 *   environment. On the server (or in any environment where DOMPurify reports
 *   `isSupported === false`) {@link sanitizeSvgMarkup} returns an empty string
 *   instead of passing the input through, which keeps SSR markup injection-safe.
 * - Every call returns a result object — never a bare string — so the UI can
 *   surface removals and unsupported environments as real states.
 *
 * Server-safe: importing this module never touches `window` at module scope.
 */

import DOMPurify, {
  type Config,
  type DOMPurify as PurifierInstance,
  type RemovedAttribute,
  type RemovedElement,
} from 'dompurify';

/**
 * The sanitization profile required by the spec:
 * `USE_PROFILES: { svg: true, svgFilters: true }` plus defence in depth.
 */
export const SVG_SANITIZE_CONFIG: Config = Object.freeze<Config>({
  USE_PROFILES: { svg: true, svgFilters: true },
  /** `foreignObject` re-opens the HTML namespace inside an SVG island. */
  FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'object', 'embed', 'base', 'meta', 'link'],
  /** `data-*` attributes have no place in an imported preview asset. */
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: true,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  SANITIZE_DOM: true,
  SAFE_FOR_TEMPLATES: true,
  KEEP_CONTENT: true,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  IN_PLACE: false,
});

export type SanitizeFailureReason = 'empty-input' | 'unsupported-environment' | 'non-svg-root' | 'all-content-removed';

export interface SanitizeResult {
  /** Sanitized markup, always safe to inject. Empty string when `ok` is false. */
  markup: string;
  ok: boolean;
  /** Machine-readable failure reason, `null` on success. */
  reason: SanitizeFailureReason | null;
  /** Tag names and attribute names DOMPurify stripped from the source. */
  removed: string[];
  /** True when the source contained at least one `<svg>` root element. */
  hadSvgRoot: boolean;
}

const SVG_ROOT_PATTERN = /<svg[\s>]/i;
const SVG_OPEN_TAG_PATTERN = /<\s*svg\b[^>]*>/i;

let cachedPurifier: PurifierInstance | null | undefined;

type PurifierFactory = (windowLike?: Window) => PurifierInstance;

function getPurifier(): PurifierInstance | null {
  if (cachedPurifier !== undefined) return cachedPurifier;
  if (typeof window === 'undefined') {
    cachedPurifier = null;
    return cachedPurifier;
  }
  try {
    const factory = DOMPurify as unknown as PurifierFactory;
    const instance = typeof factory === 'function' ? factory(window) : (DOMPurify as unknown as PurifierInstance);
    cachedPurifier = instance && instance.isSupported ? instance : null;
  } catch {
    cachedPurifier = null;
  }
  return cachedPurifier;
}

/** Exposed for tests and for the stage: is DOMPurify usable in this environment? */
export function isSanitizerSupported(): boolean {
  return getPurifier() !== null;
}

/** Resets the cached purifier instance (used by hot reload and tests). */
export function resetSanitizerCache(): void {
  cachedPurifier = undefined;
}

/** Extracts the tag / attribute names DOMPurify reported as removed. */
function collectRemovedNames(removed: Array<RemovedElement | RemovedAttribute>): string[] {
  const names: string[] = [];
  for (const entry of removed) {
    if ('attribute' in entry && entry.attribute) {
      names.push(`@${entry.attribute.name}`);
    } else if ('element' in entry && entry.element) {
      const tagName = (entry.element as Element).tagName;
      names.push(tagName ? tagName.toLowerCase() : '#unknown');
    }
  }
  return names;
}

/** Cheap pre-scan for an `<svg>` root; used only for reporting, never for stripping. */
export function hasSvgRoot(input: string): boolean {
  return SVG_ROOT_PATTERN.test(input);
}

/**
 * Sanitizes untrusted SVG markup.
 *
 * @param input  Raw user markup. Anything that is not a well-formed SVG subtree
 *               is rejected with `reason: 'non-svg-root'`.
 * @returns A {@link SanitizeResult}; `markup` is empty whenever `ok` is false.
 */
export function sanitizeSvgMarkup(input: string): SanitizeResult {
  const hadSvgRoot = hasSvgRoot(input);
  const failure = (reason: SanitizeFailureReason): SanitizeResult => ({
    markup: '',
    ok: false,
    reason,
    removed: [],
    hadSvgRoot,
  });

  if (typeof input !== 'string' || input.trim().length === 0) {
    return failure('empty-input');
  }
  if (!hadSvgRoot) {
    return failure('non-svg-root');
  }

  const purifier = getPurifier();
  if (!purifier) {
    return failure('unsupported-environment');
  }

  // DOMPurify resets `removed` at the start of every `sanitize()` call, so the
  // report has to be read back from the instance *after* the run.
  let markup: string;
  try {
    markup = purifier.sanitize(input, SVG_SANITIZE_CONFIG);
  } catch {
    return failure('all-content-removed');
  } finally {
    purifier.removed = [];
  }

  const removedNames = collectRemovedNames(purifier.removed);

  if (typeof markup !== 'string' || markup.trim().length === 0) {
    return { ...failure('all-content-removed'), removed: removedNames };
  }
  if (!SVG_OPEN_TAG_PATTERN.test(markup)) {
    // The `<svg>` root was stripped (or only unwrapped text survived).
    return { ...failure('all-content-removed'), removed: removedNames };
  }

  return {
    markup,
    ok: true,
    reason: null,
    removed: removedNames,
    hadSvgRoot,
  };
}

/** Convenience wrapper returning only the sanitized markup (empty on failure). */
export function sanitizeSvgForPreview(input: string): string {
  return sanitizeSvgMarkup(input).markup;
}

/**
 * Wraps sanitized markup in a sized container so the stage can scale it with
 * CSS. Fails closed: if sanitization rejects the input, the fallback empty
 * state markup is returned instead.
 */
export function buildPreviewSvgContainer(input: string, className: string): string {
  const result = sanitizeSvgMarkup(input);
  if (!result.ok) return '';
  return `<span class="${className}">${result.markup}</span>`;
}

/**
 * Reads the `viewBox` attribute straight out of the `<svg>` open tag.
 *
 * This deliberately avoids a DOM round-trip. `RETURN_DOM: true` only returns
 * the sanitized element when `RETURN_DOM_FRAGMENT` is set as well; with the
 * fragment disabled DOMPurify hands back its internal `<body>`, so reading
 * `viewBox` off that node silently yields `null` for every document. Parsing
 * the attribute also keeps untrusted markup out of the DOM and makes the
 * behaviour testable in a DOM-less environment. The name is matched
 * case-insensitively because the HTML parser maps `viewbox` onto the SVG
 * `viewBox` attribute when the markup is injected.
 */
function readViewBoxAttribute(openTag: string): string | null {
  const match = /(?:^|\s)viewbox\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(openTag);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? null;
}

/**
 * Extracts the viewBox of the first `<svg>` element so the stage can preserve
 * the author's aspect ratio. Returns `null` when no usable viewBox exists.
 */
export function extractSvgViewBox(input: string): { minX: number; minY: number; width: number; height: number } | null {
  if (typeof input !== 'string') return null;
  const match = SVG_OPEN_TAG_PATTERN.exec(input);
  if (!match) return null;

  const raw = readViewBoxAttribute(match[0]);
  if (!raw) return null;
  const parts = raw
    .trim()
    .split(/[\s,]+/)
    .map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [minX, minY, width, height] = parts;
  if (width <= 0 || height <= 0) return null;
  return { minX, minY, width, height };
}

/**
 * A human readable summary of what a sanitization run changed, used by the
 * inspector to explain to the user why their markup was altered.
 */
export function describeSanitizeResult(result: SanitizeResult): string {
  if (result.ok && result.removed.length === 0) return 'Custom SVG accepted without modification.';
  if (result.ok) {
    const unique = [...new Set(result.removed)];
    return `Custom SVG accepted. Removed ${unique.length} unsafe item(s): ${unique.join(', ')}.`;
  }
  switch (result.reason) {
    case 'empty-input':
      return 'Paste an SVG document to preview it.';
    case 'non-svg-root':
      return 'Input rejected: markup must contain an <svg> root element.';
    case 'unsupported-environment':
      return 'Sanitizer unavailable in this environment; the SVG was not rendered.';
    case 'all-content-removed':
      return 'Input rejected: nothing survived sanitization. Check for scripts, event handlers or embedded HTML.';
    default:
      return 'Input rejected.';
  }
}
