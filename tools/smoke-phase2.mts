import assert from 'node:assert/strict';

import { cn, utilityGroup } from '@/lib/cn';
import {
  clampAlpha,
  clampChannel,
  colorsEqual,
  formatColorValue,
  formatRgbString,
  parseCssColor,
  parseHexColor,
  parseRgbFunction,
  readableTextColor,
  rgbaToHex,
} from '@/lib/color';

// --- cn --------------------------------------------------------------------
assert.equal(cn('px-2', 'px-4'), 'px-4', 'same-property utilities: last wins');
assert.equal(cn('p-2', 'text-sm', 'p-4'), 'text-sm p-4', 'independent groups both survive, in source order');
assert.equal(cn('bg-obsidian-900 hover:bg-black', 'bg-obsidian-800'), 'hover:bg-black bg-obsidian-800');
assert.equal(cn('text-red-500', 'text-sm'), 'text-red-500 text-sm', 'text colour and text size are different groups');
assert.equal(cn('text-sm', 'text-red-500'), 'text-sm text-red-500');
assert.equal(cn('h-10', 'h-8', ['w-8', null, undefined, false]), 'h-8 w-8');
assert.equal(cn({ 'p-2': true, hidden: false, 'm-2': true }), 'p-2 m-2');
assert.equal(cn('border-obsidian-700', 'border-studio-accent/60'), 'border-studio-accent/60');
assert.equal(cn('rounded-md', 'rounded-full'), 'rounded-full');
assert.equal(cn(''), '');
assert.equal(cn(undefined, null, false), '');
assert.equal(cn('shadow-panel', 'shadow-raised'), 'shadow-raised');
assert.equal(utilityGroup('md:grid-cols-2'), 'grid-template-columns');
assert.equal(utilityGroup('md:p-4'), 'padding');
assert.equal(utilityGroup('md:justify-between'), 'justify');
assert.equal(utilityGroup('focus-visible:ring-studio-accent'), 'ring');
assert.equal(utilityGroup('[mask-image:linear-gradient(black,transparent)]'), null, 'arbitrary values are ungrouped');
assert.equal(cn('grid grid-cols-2', 'grid-cols-3'), 'grid grid-cols-3');
assert.equal(cn('top-0', 'inset-0'), 'inset-0', 'inset and top share the inset group by design');

// --- color -----------------------------------------------------------------
assert.deepEqual(parseHexColor('#0f5'), { r: 0, g: 255, b: 85, a: 1 });
assert.deepEqual(parseHexColor('0F5C'), { r: 0, g: 255, b: 85, a: 0.8 });
assert.deepEqual(parseHexColor('#00f5d4'), { r: 0, g: 245, b: 212, a: 1 });
assert.deepEqual(parseHexColor('#00f5d480'), { r: 0, g: 245, b: 212, a: 128 / 255 });
assert.equal(parseHexColor('#12345'), null, 'five digits is not a hex colour');
assert.equal(parseHexColor('rgb(0,0,0)'), null);

assert.deepEqual(parseRgbFunction('rgb(0 245 212)'), { r: 0, g: 245, b: 212, a: 1 });
assert.deepEqual(parseRgbFunction('rgba(0, 245, 212, 0.45)'), { r: 0, g: 245, b: 212, a: 0.45 });
assert.deepEqual(parseRgbFunction('rgb(0 245 212 / 45%)'), { r: 0, g: 245, b: 212, a: 0.45 });
assert.equal(parseRgbFunction('rgb(0 245 300)'), null, 'out-of-range channel is rejected');
assert.equal(parseRgbFunction('hsl(0 0% 0%)'), null);

assert.deepEqual(parseCssColor('rgba(0, 245, 212, 0.45)'), { r: 0, g: 245, b: 212, a: 0.45 });
assert.equal(parseCssColor('linear-gradient(red, blue)'), null);
assert.equal(parseCssColor(''), null);

assert.equal(rgbaToHex({ r: 0, g: 245, b: 212, a: 1 }), '#00f5d4');
assert.equal(rgbaToHex({ r: 0, g: 245, b: 212, a: 0.45 }), '#00f5d473');
assert.equal(formatRgbString({ r: 0, g: 245, b: 212, a: 1 }), 'rgb(0 245 212)');
assert.equal(formatRgbString({ r: 0, g: 245, b: 212, a: 0.45 }), 'rgb(0 245 212 / 0.45)');
assert.equal(formatRgbString({ r: 0, g: 245, b: 212, a: 0.45 }, false), 'rgba(0, 245, 212, 0.45)');
assert.equal(formatColorValue({ r: 1, g: 2, b: 3, a: 1 }, 'hex'), '#010203');
assert.equal(formatColorValue({ r: 1, g: 2, b: 3, a: 0.5 }, 'hex'), '#01020380');
assert.equal(formatColorValue({ r: 1, g: 2, b: 3, a: 0.5 }, 'rgb'), 'rgb(1 2 3 / 0.5)');

assert.equal(colorsEqual('#00f5d4', 'rgb(0, 245, 212)'), true, 'notation-independent comparison');
assert.equal(colorsEqual('#00f5d4', 'rgb(0, 245, 213)'), false);
assert.equal(colorsEqual('nope', 'nope'), true, 'unparseable values fall back to string equality');

assert.equal(readableTextColor('#00f5d4'), '#09090b', 'bright swatch gets dark text');
assert.equal(readableTextColor('#09090b'), '#fafafa');
assert.equal(clampChannel(300), 255);
assert.equal(clampChannel(Number.NaN), 0);
assert.equal(clampAlpha(2.4567), 1);
assert.equal(clampAlpha(-1), 0);

console.log('phase-2 smoke: all assertions passed');
