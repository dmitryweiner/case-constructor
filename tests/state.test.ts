// sanitizeState is the single gate for numbers from outside (UI, files,
// localStorage, worker messages). It must digest any garbage without
// throwing, and twice must equal once.

import { defaultState, sanitizeState, RESOLUTIONS, STATE_VERSION } from '../src/state/schema';
import { WALL_MIN, WALL_MAX, SIZE_MAX, SIZE_MIN } from '../src/geo/shape';
import { lidFaces } from '../src/geo/lidSpec';
import { garbageLike, rng } from './helpers';

describe('defaultState', () => {
  it('is its own sanitized form', () => {
    expect(sanitizeState(defaultState())).toEqual(defaultState());
    expect(defaultState().version).toBe(STATE_VERSION);
  });
});

describe('sanitizeState', () => {
  it('never throws, whatever comes in', () => {
    for (const raw of [null, undefined, 'box', 42, [], { shape: 'no' }, { lid: [] }, { shape: { size: 5 } }]) {
      expect(() => sanitizeState(raw)).not.toThrow();
    }
  });

  it('fuzz: never throws and is idempotent', () => {
    const random = rng(7);
    for (let i = 0; i < 2000; i++) {
      const raw = garbageLike(defaultState(), random);
      const once = sanitizeState(raw);
      expect(sanitizeState(once)).toEqual(once);
      expect(sanitizeState(JSON.parse(JSON.stringify(once)))).toEqual(once);
    }
  });

  it('clamps walls and sizes into the printable range', () => {
    const state = sanitizeState({ shape: { wall: 0.1, floor: 99, size: { w: -5, d: 1e6, h: 'tall' } } });
    expect(state.shape.wall).toBe(WALL_MIN);
    expect(state.shape.floor).toBe(WALL_MAX);
    expect(state.shape.size.w).toBe(SIZE_MIN);
    expect(state.shape.size.d).toBe(SIZE_MAX);
    expect(state.shape.size.h).toBe(defaultState().shape.size.h);
  });

  it('an unknown shape falls back to the box, an unknown lid face to the first allowed one', () => {
    expect(sanitizeState({ shape: { kind: 'sphere' } }).shape.kind).toBe('box');
    expect(sanitizeState({ lid: { face: 'inside' } }).lid.face).toBe('top');
  });

  it('a lid face the shape cannot have falls back to an allowed one', () => {
    const cylinder = sanitizeState({ shape: { kind: 'cylinder' }, lid: { face: 'left' } });
    expect(lidFaces('cylinder')).toContain(cylinder.lid.face);
    const console = sanitizeState({ shape: { kind: 'console' }, lid: { face: 'top' } });
    expect(console.lid.face).not.toBe('top');
    expect(sanitizeState({ shape: { kind: 'console' }, lid: { face: 'left' } }).lid.face).toBe('left');
  });

  it('an unknown resolution or export mode falls back to the default', () => {
    expect(sanitizeState({ resolution: 777 }).resolution).toBe(defaultState().resolution);
    expect(sanitizeState({ resolution: RESOLUTIONS[0] }).resolution).toBe(RESOLUTIONS[0]);
    expect(sanitizeState({ exportMode: 'all' }).exportMode).toBe(defaultState().exportMode);
    expect(sanitizeState({ exportMode: 'lid' }).exportMode).toBe('lid');
  });

  it('screw specs are checked against the table', () => {
    const state = sanitizeState({ lid: { screw: { size: 'M7', hole: 'nut', head: 'dome' } } });
    expect(state.lid.screw).toEqual({ size: defaultState().lid.screw.size, hole: 'nut', head: defaultState().lid.screw.head });
  });
});
