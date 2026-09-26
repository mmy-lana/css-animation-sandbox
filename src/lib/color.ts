/**
 * Colour parsing and formatting for the studio colour input.
 *
 * Pure and server-safe: no DOM access, no browser APIs. Values that cannot be
 * parsed return `null` so callers can surface an explicit error state instead
 * of silently emitting broken CSS.
 */

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type ColorFormatMode = 'hex' | 'rgb';

const HEX_PATTERN = /^#?([0-9a-f]{3,8})$/i;
const RGB_FUNCTION_PATTERN =
  /^rgba?\(\s*(-?\d{1,3})\s*(?:,|\s)\s*(-?\d{1,3})\s*(?:,|\s)\s*(-?\d{1,3})\s*(?:(?:,|\/)\s*([0-9.]+%?)\s*)?\)$/i;

/** Clamps an 8-bit channel to `0…255` and rounds it. */
export function clampChannel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.round(value), 0), 255);
}

/** Clamps an alpha channel to `0…1` and rounds it to three decimals. */
export function clampAlpha(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(Number(value.toFixed(3)), 0), 1);
}

/** Parses `#abc`, `#abcd`, `#aabbcc` and `#aabbccdd`. */
export function parseHexColor(input: string): RgbaColor | null {
  const match = HEX_PATTERN.exec(input.trim());
  if (!match) return null;
  const digits = match[1].toLowerCase();

  const expand = (chunk: string): number => Number.parseInt(chunk.length === 1 ? chunk + chunk : chunk, 16);

  if (digits.length === 3 || digits.length === 4) {
    const [r, g, b, a] = digits.split('').map(expand);
    return { r, g, b, a: digits.length === 4 ? a / 255 : 1 };
  }
  if (digits.length === 6 || digits.length === 8) {
    const hex = (index: number): number => Number.parseInt(digits.slice(index * 2, index * 2 + 2), 16);
    return {
      r: hex(0),
      g: hex(1),
      b: hex(2),
      a: digits.length === 8 ? hex(3) / 255 : 1,
    };
  }
  return null;
}

/** Parses `rgb()` and `rgba()` in both the legacy and CSS Color 4 syntaxes. */
export function parseRgbFunction(input: string): RgbaColor | null {
  const match = RGB_FUNCTION_PATTERN.exec(input.trim());
  if (!match) return null;
  const [, r, g, b, a] = match;
  if ([r, g, b].some((channel) => Number.parseInt(channel, 10) > 255)) return null;

  let alpha = 1;
  if (a !== undefined) {
    alpha = a.endsWith('%') ? Number.parseFloat(a) / 100 : Number.parseFloat(a);
    if (!Number.isFinite(alpha)) return null;
  }
  return { r: clampChannel(Number.parseInt(r, 10)), g: clampChannel(Number.parseInt(g, 10)), b: clampChannel(Number.parseInt(b, 10)), a: clampAlpha(alpha) };
}

/** Parses any colour the studio controls emit. */
export function parseCssColor(input: string): RgbaColor | null {
  return parseHexColor(input) ?? parseRgbFunction(input);
}

/** Renders to `#rrggbb`, or `#rrggbbaa` when the colour is translucent. */
export function rgbaToHex(color: RgbaColor, includeAlpha = false): string {
  const toHex = (channel: number): string => clampChannel(channel).toString(16).padStart(2, '0');
  const base = `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
  if (!includeAlpha && color.a >= 1) return base;
  return `${base}${Math.round(clampAlpha(color.a) * 255).toString(16).padStart(2, '0')}`;
}

/** `true` for the modern space-separated syntax, `false` for legacy `rgba()`. */
export function formatRgbString(color: RgbaColor, modern = true): string {
  const channels = `${clampChannel(color.r)} ${clampChannel(color.g)} ${clampChannel(color.b)}`;
  const alpha = clampAlpha(color.a);
  if (alpha >= 1 && modern) return `rgb(${channels})`;
  if (!modern) return `rgba(${clampChannel(color.r)}, ${clampChannel(color.g)}, ${clampChannel(color.b)}, ${alpha})`;
  return `rgb(${channels} / ${alpha})`;
}

/** Emits the colour in the requested notation. */
export function formatColorValue(color: RgbaColor, mode: ColorFormatMode): string {
  if (mode === 'hex') return rgbaToHex(color, color.a < 1);
  return formatRgbString(color, true);
}

/** Compares two CSS colours by value, independent of notation. */
export function colorsEqual(left: string, right: string): boolean {
  const a = parseCssColor(left);
  const b = parseCssColor(right);
  if (!a || !b) return left.trim() === right.trim();
  return a.r === b.r && a.g === b.g && a.b === b.b && Math.abs(a.a - b.a) < 0.005;
}

/** Picks a legible foreground for a swatch using the WCAG relative luminance. */
export function readableTextColor(background: string): '#09090b' | '#fafafa' {
  const color = parseCssColor(background);
  if (!color) return '#fafafa';
  const channel = (raw: number): number => {
    const value = clampChannel(raw) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  return luminance > 0.45 ? '#09090b' : '#fafafa';
}

/** The 6×8 checkerboard used to reveal transparency. */
export const TRANSPARENCY_CHECKER =
  'linear-gradient(45deg, #3f3f46 25%, transparent 25%), linear-gradient(-45deg, #3f3f46 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #3f3f46 75%), linear-gradient(-45deg, transparent 75%, #3f3f46 75%)';

/** Preset studio swatches (neon accents, neutrals, transparents). */
export const STUDIO_SWATCHES: readonly string[] = [
  '#00f5d4',
  '#5eead4',
  '#0f766e',
  '#7928ca',
  '#a855f7',
  '#f43f5e',
  '#fbbf24',
  '#34d399',
  '#fafafa',
  '#a1a1aa',
  '#52525b',
  '#27272a',
  '#09090b',
  '#ef4444',
  '#3b82f6',
  'rgba(0, 245, 212, 0.45)',
];
