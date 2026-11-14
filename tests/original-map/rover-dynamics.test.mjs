import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTsModule } from '../mission-v2/support/load-ts-module.mjs';

const rover = await loadTsModule('../../src/modules/character/roverDynamics.ts', import.meta.url);
const initial = (pose = {}) => rover.initialRoverState({ x: 0, y: -0.4, z: 0, heading: 0, ...pose });
const step = (state, throttle, steer = 0, dt = 0.05, environment) =>
  rover.stepRoverDynamics(state, { throttle, steer, dt }, environment);
const close = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} not near ${b}`);

test('steering while stationary changes front wheel angle but never moves or yaws chassis', () => {
  const start = initial();
  const turned = step(start, 0, 1, 0.1);
  assert.ok(turned.steeringAngle > 0);
  close(turned.x, start.x);
  close(turned.z, start.z);
  close(turned.heading, start.heading);
  close(turned.acceptedWheelTravel, 0);
});

test('forward throttle accelerates along +Z and coasts with retained momentum', () => {
  let state = initial();
  for (let i = 0; i < 20; i++) state = step(state, 1);
  assert.ok(state.longitudinalVelocity > 1.5);
  assert.ok(state.z > 0.5);
  assert.ok(Math.abs(state.x) < 1e-6);
  const speed = state.longitudinalVelocity;
  state = step(state, 0, 0, 0.05);
  assert.ok(state.longitudinalVelocity > 0);
  assert.ok(state.longitudinalVelocity < speed);
  assert.ok(state.z > 0);
});

test('opposing throttle brakes forward motion to zero before reversing', () => {
  let state = { ...initial(), longitudinalVelocity: 1 };
  state = step(state, -1, 0, 0.1);
  assert.ok(state.longitudinalVelocity > 0);
  state = step(state, -1, 0, 0.1);
  close(state.longitudinalVelocity, 0);
  const travelAtRest = state.acceptedWheelTravel;
  state = step(state, -1, 0, 0.1);
  assert.ok(state.longitudinalVelocity < 0);
  assert.ok(state.acceptedWheelTravel < travelAtRest);
});

test('Ackermann bicycle steering yaws only while moving and mirrors in forward and reverse', () => {
  let left = initial();
  for (let i = 0; i < 12; i++) left = step(left, 1, 1);
  let right = initial();
  for (let i = 0; i < 12; i++) right = step(right, 1, -1);
  assert.ok(left.heading > 0 && left.x > 0);
  assert.ok(right.heading < 0 && right.x < 0);
  close(left.x, -right.x, 0.02);

  let reverseLeft = { ...initial(), longitudinalVelocity: -2 };
  let reverseRight = { ...initial(), longitudinalVelocity: -2 };
  for (let i = 0; i < 8; i++) {
    reverseLeft = step(reverseLeft, 0, 1);
    reverseRight = step(reverseRight, 0, -1);
  }
  assert.ok(reverseLeft.heading < 0);
  assert.ok(reverseRight.heading > 0);
  assert.ok(reverseLeft.z < 0 && reverseRight.z < 0);
  close(reverseLeft.x, -reverseRight.x, 0.02);
});

test('fixed internal substeps make equivalent frame partitions nearly invariant', () => {
  let one = initial();
  one = step(one, 0.8, 0.55, 0.1);
  let split = initial();
  split = step(split, 0.8, 0.55, 0.05);
  split = step(split, 0.8, 0.55, 0.05);
  close(one.x, split.x, 1e-8);
  close(one.z, split.z, 1e-8);
  close(one.heading, split.heading, 1e-8);
  close(one.longitudinalVelocity, split.longitudinalVelocity, 1e-8);
});

test('invalid and oversized input remains finite and bounded', () => {
  const start = initial({ x: NaN, y: Infinity, z: -Infinity, heading: NaN });
  assert.deepEqual([start.x, start.y, start.z, start.heading], [0, -0.4, 0, 0]);
  const state = rover.stepRoverDynamics(start, { throttle: NaN, steer: Infinity, dt: 1e99 });
  for (const value of [state.x, state.y, state.z, state.heading, state.longitudinalVelocity,
    state.lateralVelocity, state.steeringAngle, state.acceptedWheelTravel, state.groundPitch, state.groundRoll]) {
    assert.ok(Number.isFinite(value));
  }
  assert.ok(Math.hypot(state.x - start.x, state.z - start.z) < 1e-9);
  const bounded = step(initial(), 1, 0, 1e99);
  assert.ok(bounded.z < 0.1, `Oversized dt was not clamped: z=${bounded.z}`);
});

test('swept substeps stop at an obstacle without tunneling or wheel spin travel', () => {
  const state = rover.stepRoverDynamics(
    { ...initial(), longitudinalVelocity: 5 },
    { throttle: 1, steer: 0, dt: 0.1 },
    { canOccupy: (_x, z) => z <= 0.02 }
  );
  close(state.z, 0);
  close(state.acceptedWheelTravel, 0);
  close(state.longitudinalVelocity, 0);
});

test('ground support samples all six wheels and yields finite pitch, roll and suspension travel', () => {
  const state = rover.stepRoverDynamics(initial(), { throttle: 0, steer: 0, dt: 0.02 }, {
    sampleGround: (x, z) => 0.1 * x + 0.2 * z
  });
  assert.ok(state.groundPitch > 0);
  assert.ok(state.groundRoll > 0);
  assert.ok(Number.isFinite(state.y));
  assert.deepEqual(Object.keys(state.suspensionTravel).sort(), [
    'frontLeft', 'frontRight', 'middleLeft', 'middleRight', 'rearLeft', 'rearRight'
  ]);
  assert.ok(Object.values(state.suspensionTravel).some(value => Math.abs(value) > 0.01));
  assert.ok(Object.values(state.suspensionTravel).every(value => Number.isFinite(value) && Math.abs(value) <= 0.25));
});

test('world bounds stop travel at ±300 without teleporting around the planet', () => {
  for (const z of [-299.08, 299.08]) {
    const direction = Math.sign(z);
    const state = rover.stepRoverDynamics(
      { ...initial({ z }), longitudinalVelocity: direction * 5 },
      { throttle: direction, steer: 0, dt: 0.1 }
    );
    assert.ok(state.z >= -300 && state.z <= 300);
    assert.ok(Math.abs(state.z - z) < 0.1);
    close(state.acceptedWheelTravel, 0);
    close(state.longitudinalVelocity, 0);
  }
});
