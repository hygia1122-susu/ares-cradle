import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTsModule } from '../mission-v2/support/load-ts-module.mjs';

const physics = await loadTsModule('../../src/modules/character/physicsEngine.ts', import.meta.url);
const world = await loadTsModule('../../src/modules/outpost-3d/worldRegions.ts', import.meta.url);
const { PHYSICS_CONSTANTS, STATIC_WORLD_COLLIDERS, canRoverOccupy, stepPlayerPhysics } = physics;
const { ADDITIVE_OUTER_COLLIDERS, WORLD_BOUNDS, WORLD_GROUND_Y, sampleWorldGround } = world;
const initial = (x, z, y = sampleWorldGround(x, z)) => ({
  x, y, z, vy: 0, isGrounded: true, isBlocked: false, blockedByLabel: null,
  blockedObstacleJumpable: false, standingOnLabel: null,
});
const step = (state, moveX = 0, moveZ = 0, jumpJustPressed = false, dt = 0.05) =>
  stepPlayerPhysics(state, { moveX, moveZ, jumpJustPressed, dt });

test('keeps original collider definitions and appends all 25 outer landmarks', () => {
  assert.equal(ADDITIVE_OUTER_COLLIDERS.length, 25);
  assert.equal(STATIC_WORLD_COLLIDERS.length, 54);
  assert.equal(STATIC_WORLD_COLLIDERS[0].id, 'habitat-dome-wall');
  assert.equal(STATIC_WORLD_COLLIDERS[28].id, 'mesa-west');
  for (const [index, outer] of ADDITIVE_OUTER_COLLIDERS.entries()) {
    const collider = STATIC_WORLD_COLLIDERS[29 + index];
    assert.equal(collider.id, outer.id);
    assert.equal(collider.type, 'circle');
    assert.equal(collider.x, outer.x);
    assert.equal(collider.z, outer.z);
    assert.equal(collider.radius, outer.radius);
    assert.equal(collider.topY, sampleWorldGround(outer.x, outer.z) + 3.4);
    assert.equal(collider.jumpable, false);
  }
});

test('samples the exact home ground and follows outer terrain contact height', () => {
  assert.equal(sampleWorldGround(209, 0), WORLD_GROUND_Y);
  assert.equal(sampleWorldGround(210, 0), WORLD_GROUND_Y);
  const x = 240;
  const z = -240;
  const ground = sampleWorldGround(x, z);
  assert.notEqual(ground, WORLD_GROUND_Y);
  const landed = step(initial(x, z, WORLD_GROUND_Y));
  assert.equal(landed.y, ground);
  assert.equal(landed.isGrounded, true);
});

test('walks past the old 78m radius without wrapping at tested radii', () => {
  for (const x of [80, 100, 209, 260]) {
    const state = step(initial(x, 12), 4.2, 0);
    assert.ok(state.x > x, `x=${x} wrapped or stopped at ${state.x}`);
    assert.ok(Math.abs(state.x - (x + 4.2 * 0.05)) < 1e-8);
    assert.equal(state.z, 12);
  }
});

test('clamps actor center by radius at all four world edges without teleporting', () => {
  const radius = PHYSICS_CONSTANTS.PLAYER_RADIUS;
  for (const [start, direction, axis] of [
    [299.5, 1, 'x'], [-299.5, -1, 'x'], [299.5, 1, 'z'], [-299.5, -1, 'z'],
  ]) {
    const state = axis === 'x'
      ? step(initial(start, 0), direction * 4.2, 0)
      : step(initial(0, start), 0, direction * 4.2);
    const value = state[axis];
    assert.equal(value, direction * (WORLD_BOUNDS.maxX - radius));
    assert.equal(state.isBlocked, true);
    assert.equal(state.blockedByLabel, 'World Boundary');
    assert.equal(state[axis === 'x' ? 'vx' : 'vz'], 0);
    assert.ok(Math.abs(value - start) < 1);
  }
});

test('outer landmark circle blocks rover occupancy but leaves nearby ground open', () => {
  const feature = ADDITIVE_OUTER_COLLIDERS.find(({ id }) => id === 'ice.discovery-1');
  assert.ok(feature);
  assert.equal(canRoverOccupy(feature.x, feature.z), false);
  assert.equal(canRoverOccupy(feature.x + feature.radius + PHYSICS_CONSTANTS.ROVER_RADIUS + 0.5, feature.z), true);
  assert.equal(canRoverOccupy(301, 0), false);
});

test('keeps the original jump, gravity and double-jump cycle on outer ground', () => {
  assert.equal(PHYSICS_CONSTANTS.JUMP_VELOCITY, 5.6);
  assert.equal(PHYSICS_CONSTANTS.DOUBLE_JUMP_VELOCITY, 5.2);
  assert.equal(PHYSICS_CONSTANTS.MARS_GRAVITY, 9.2);
  let state = step(initial(240, -240), 0, 0, true, 0.02);
  assert.equal(state.isGrounded, false);
  for (let i = 0; i < 10; i += 1) state = step(state, 0, 0, false, 0.03);
  state = step(state, 0, 0, true, 0.02);
  assert.equal(state.didDoubleJump, true);
  assert.equal(state.airJumpsLeft, 0);
  for (let i = 0; i < 80 && !state.isGrounded; i += 1) state = step(state, 0, 0, false, 0.03);
  assert.equal(state.isGrounded, true);
  assert.equal(state.y, sampleWorldGround(state.x, state.z));
});
