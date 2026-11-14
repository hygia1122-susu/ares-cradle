import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTsModule } from '../mission-v2/support/load-ts-module.mjs';

const rover = await loadTsModule('../../src/modules/character/roverDynamics.ts', import.meta.url);
const initial = (pose = {}) => rover.initialRoverState({ x: 0, y: -0.4, z: 0, heading: 0, ...pose });
const step = (state, throttle, steer = 0, dt = 0.05, environment) =>
  rover.stepRoverDynamics(state, { throttle, steer, dt }, environment);
const close = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} not near ${b}`);

test('stationary steering angles the wheels without chassis yaw or translation', () => {
  const start = initial();
  const turned = step(start, 0, 1, 0.1);
  assert.ok(turned.steeringAngle > 0);
  close(turned.x, start.x); close(turned.z, start.z); close(turned.heading, start.heading);
  close(turned.acceptedWheelTravel, 0);
});

test('forward input reaches useful speed immediately and release stops within 0.15 seconds', () => {
  let state = step(initial(), 1, 0, 1 / 60);
  assert.equal(state.longitudinalVelocity, 5);
  assert.ok(state.z > 0);
  for (let i = 0; i < 8; i++) state = step(state, 0, 0, 0.02);
  assert.equal(state.longitudinalVelocity, 0);
  assert.ok(state.z > 0, 'accepted travel is retained through braking');
});

test('reverse input changes velocity sign immediately and is capped at -3 m/s', () => {
  const state = step({ ...initial(), longitudinalVelocity: 5 }, -1, 0, 0.02);
  assert.equal(state.longitudinalVelocity, -3);
  assert.ok(state.z < 0);
});

test('positive steering turns right in the watch-camera basis in forward and reverse', () => {
  let right = initial();
  for (let i = 0; i < 12; i++) right = step(right, 1, 1);
  assert.ok(right.heading < 0 && right.x < 0, 'camera-right at heading zero points toward -X');
  let left = initial();
  for (let i = 0; i < 12; i++) left = step(left, 1, -1);
  assert.ok(left.heading > 0 && left.x > 0);
  close(left.x, -right.x, 0.02);

  let reverseRight = { ...initial(), longitudinalVelocity: -2 };
  let reverseLeft = { ...initial(), longitudinalVelocity: -2 };
  for (let i = 0; i < 8; i++) {
    reverseRight = step(reverseRight, 0, 1);
    reverseLeft = step(reverseLeft, 0, -1);
  }
  assert.ok(reverseRight.heading > 0 && reverseRight.z < 0, 'reverse steering follows standard vehicle kinematics');
  assert.ok(reverseLeft.heading < 0 && reverseLeft.z < 0);
});

test('fixed internal substeps make equivalent frame partitions nearly invariant', () => {
  const one = step(initial(), 1, 0.55, 0.1);
  const split = step(step(initial(), 1, 0.55, 0.05), 1, 0.55, 0.05);
  close(one.x, split.x, 1e-8); close(one.z, split.z, 1e-8);
  close(one.heading, split.heading, 1e-8); close(one.longitudinalVelocity, split.longitudinalVelocity, 1e-8);
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
  assert.ok(bounded.z <= 0.5, `oversized dt exceeded one bounded frame: z=${bounded.z}`);
});

test('blocked movement does not advance pose or accepted wheel travel', () => {
  const state = rover.stepRoverDynamics(
    { ...initial(), longitudinalVelocity: 5 },
    { throttle: 1, steer: 0, dt: 0.1 },
    { canOccupy: () => false }
  );
  close(state.z, 0); close(state.acceptedWheelTravel, 0); close(state.longitudinalVelocity, 0);
});

test('ground support samples six wheels and yields finite pitch, roll and suspension travel', () => {
  const state = rover.stepRoverDynamics(initial(), { throttle: 0, steer: 0, dt: 0.02 }, {
    sampleGround: (x, z) => 0.1 * x + 0.2 * z
  });
  assert.ok(state.groundPitch > 0); assert.ok(state.groundRoll > 0); assert.ok(Number.isFinite(state.y));
  assert.deepEqual(Object.keys(state.suspensionTravel).sort(), [
    'frontLeft', 'frontRight', 'middleLeft', 'middleRight', 'rearLeft', 'rearRight'
  ]);
  assert.ok(Object.values(state.suspensionTravel).some(value => Math.abs(value) > 0.01));
  assert.ok(Object.values(state.suspensionTravel).every(value => Number.isFinite(value) && Math.abs(value) <= 0.25));
});

test('world and active-region circle bounds stop travel without teleporting', () => {
  const edge = step(initial({ x: 0, z: 75 }), 1, 0, 0.1, {
    regionCenter: { x: 0, z: 0 }, regionRadius: 75,
  });
  close(edge.z, 75); close(edge.acceptedWheelTravel, 0); close(edge.longitudinalVelocity, 0);
  const worldEdge = step(initial({ z: 299.08 }), 1, 0, 0.1);
  assert.ok(worldEdge.z >= 299.08 && worldEdge.z <= 300);
  close(worldEdge.acceptedWheelTravel, 0); close(worldEdge.longitudinalVelocity, 0);
});
