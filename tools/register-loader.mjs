// Temporary dev-only module hook: registers the "@/*" alias loader so the
// TypeScript sources can be executed directly by Node's type stripper.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./alias-loader.mjs', pathToFileURL('./tools/'));
