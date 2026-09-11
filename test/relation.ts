import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import type {LineString, MultiLineString} from 'geojson';
import {reverseGeometry, waysOf} from '../src/relation.ts';

describe('waysOf', () => {
  it('wraps a LineString so callers walk one shape', () => {
    const geometry: LineString = {
      type: 'LineString',
      coordinates: [
        [35, 31],
        [35.1, 31.1],
      ],
    };
    assert.deepEqual(waysOf(geometry), [
      [
        [35, 31],
        [35.1, 31.1],
      ],
    ]);
  });

  it('passes a MultiLineString through as its segments', () => {
    const geometry: MultiLineString = {
      type: 'MultiLineString',
      coordinates: [[[35, 31]], [[36, 32]]],
    };
    assert.deepEqual(waysOf(geometry), [[[35, 31]], [[36, 32]]]);
  });
});

describe('reverseGeometry', () => {
  it('reverses the points of a LineString', () => {
    const geometry: LineString = {
      type: 'LineString',
      coordinates: [
        [35, 31],
        [35.1, 31.1],
        [35.2, 31.2],
      ],
    };
    reverseGeometry(geometry);
    assert.deepEqual(geometry.coordinates, [
      [35.2, 31.2],
      [35.1, 31.1],
      [35, 31],
    ]);
  });

  /*
   * The regression this function exists for: a bare `coordinates.reverse()`
   * reorders the segments and leaves the points inside each running forwards,
   * so the walk jumps to the end of the route and then retraces each segment
   * in the original direction.
   */
  it('reverses both the segments and the points inside them', () => {
    const geometry: MultiLineString = {
      type: 'MultiLineString',
      coordinates: [
        [
          [35, 31],
          [35.1, 31.1],
        ],
        [
          [36, 32],
          [36.1, 32.1],
        ],
      ],
    };
    reverseGeometry(geometry);
    assert.deepEqual(geometry.coordinates, [
      [
        [36.1, 32.1],
        [36, 32],
      ],
      [
        [35.1, 31.1],
        [35, 31],
      ],
    ]);
  });

  it('walks the route back to front as one flat sequence', () => {
    const geometry: MultiLineString = {
      type: 'MultiLineString',
      coordinates: [
        [
          [0, 0],
          [1, 1],
        ],
        [
          [2, 2],
          [3, 3],
        ],
      ],
    };
    const forwards = waysOf(geometry).flat();
    reverseGeometry(geometry);
    assert.deepEqual(waysOf(geometry).flat(), [...forwards].reverse());
  });

  it('restores the original order when applied twice', () => {
    const geometry: MultiLineString = {
      type: 'MultiLineString',
      coordinates: [
        [
          [35, 31],
          [35.1, 31.1],
        ],
        [[36, 32]],
      ],
    };
    const original = structuredClone(geometry.coordinates);
    reverseGeometry(geometry);
    reverseGeometry(geometry);
    assert.deepEqual(geometry.coordinates, original);
  });
});
