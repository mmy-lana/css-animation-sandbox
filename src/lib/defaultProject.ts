/**
 * Builds the document a fresh session starts from.
 *
 * Every id here is a literal, and that is the whole point. This module is
 * evaluated once per JavaScript realm, so a random id from `createId` would be
 * baked into the server HTML and then regenerated — and rendered — by the
 * client on its first paint. React reports that as a hydration mismatch
 * (#418/#423) and throws the server markup away.
 *
 * Exposing the factory rather than only the record lets the smoke suite build
 * two independent instances and compare them, which is exactly the property
 * hydration depends on.
 */

import {
  createKeyframePoint,
  createProjectRecord,
  createTimeline,
  type ProjectRecord,
} from '@/types/sandbox';

export function createDefaultProject(): ProjectRecord {
  return createProjectRecord({
    id: 'prj_initial',
    name: 'Untitled Study',
    description: 'A three-keyframe entrance used as the starting point.',
    createdAt: 0,
    updatedAt: 0,
    timelines: [
      createTimeline({
        id: 'tl_initial',
        name: 'Entrance',
        durationMs: 1200,
        keyframes: [
          createKeyframePoint({
            id: 'kf_initial_0',
            offset: 0,
            timingFunction: 'ease-out',
            properties: { transform: { translateY: 48, scaleX: 0.94, scaleY: 0.94 }, styles: { opacity: 0 } },
          }),
          createKeyframePoint({
            id: 'kf_initial_70',
            offset: 70,
            timingFunction: 'ease-in-out',
            properties: {
              transform: { translateY: -6, scaleX: 1.03, scaleY: 1.03 },
              styles: { opacity: 1, boxShadowBlur: 56, boxShadowSpread: -14 },
            },
          }),
          createKeyframePoint({
            id: 'kf_initial_100',
            offset: 100,
            timingFunction: 'ease-in-out',
            properties: { transform: { translateY: 0, scaleX: 1, scaleY: 1 }, styles: { opacity: 1 } },
          }),
        ],
      }),
    ],
  });
}

/** The shared instance the studio mounts with. */
export const DEFAULT_PROJECT: ProjectRecord = createDefaultProject();
