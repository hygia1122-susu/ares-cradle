import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTsModule } from '../mission-v2/support/load-ts-module.mjs';

const physics = await loadTsModule('../../src/modules/character/physicsEngine.ts', import.meta.url);
const world = await loadTsModule('../../src/modules/outpost-3d/worldRegions.ts', import.meta.url);
const { PHYSICS_CONSTANTS, STATIC_WORLD_COLLIDERS, buildWorldColliders, canRoverOccupy, stepPlayerPhysics } = physics;
const { ADDITIVE_OUTER_COLLIDERS, OUTER_HERO_LANDMARKS, OUTER_HERO_ROCKS, ROVER_ROUTES, WORLD_BOUNDS, WORLD_GROUND_Y, WORLD_REGIONS, isOuterHeroRouteClear, sampleRegionalLandformHeight, sampleWorldGround } = world;
const initial = (x, z, y = sampleWorldGround(x, z)) => ({
  x, y, z, vy: 0, isGrounded: true, isBlocked: false, blockedByLabel: null,
  blockedObstacleJumpable: false, standingOnLabel: null,
});
const step = (state, moveX = 0, moveZ = 0, jumpJustPressed = false, dt = 0.05) =>
  stepPlayerPhysics(state, { moveX, moveZ, jumpJustPressed, dt });

test('keeps original collider definitions and appends the matching outer colliders', () => {
  assert.equal(ADDITIVE_OUTER_COLLIDERS.length, 25);
  assert.equal(STATIC_WORLD_COLLIDERS.length, 81);
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
  assert.equal(STATIC_WORLD_COLLIDERS[28].id, 'mesa-west');
  assert.equal(STATIC_WORLD_COLLIDERS[54].id, 'legacy-mars-rover-exhibit');
  for (const collider of STATIC_WORLD_COLLIDERS) {
    if (collider.id.startsWith('outer-hero-') || ADDITIVE_OUTER_COLLIDERS.some(({ id }) => collider.id === id)) {
      assert.equal(sampleRegionalLandformHeight(collider.x, collider.z), 0,
        `${collider.id} physical anchor retains its authored ground`);
    }
  }
  assert.equal(STATIC_WORLD_COLLIDERS[54].x, 3.8);
  assert.equal(STATIC_WORLD_COLLIDERS[54].z, -2.2);
  assert.equal(STATIC_WORLD_COLLIDERS[54].radius, 0.95);
  const heroColliders = STATIC_WORLD_COLLIDERS.filter(({ id }) => id.startsWith('outer-hero-') && !id.includes('-rock-'));
  const renderedHeroIds = OUTER_HERO_LANDMARKS.map(({ id }) => `outer-hero-${id}`).sort();
  assert.deepEqual(heroColliders.map(({ id }) => id).sort(), renderedHeroIds,
    'physics includes every rendered hero despite route-clearance filtering');
  assert.equal(heroColliders.length, 5);
  const heroRockColliders = STATIC_WORLD_COLLIDERS.filter(({ id }) => id.includes('-rock-'));
  assert.equal(heroRockColliders.length, 16, 'every rendered rock has its own routeable physical proxy');
  for (const landmark of OUTER_HERO_LANDMARKS) {
    const collider = heroColliders.find(({ id }) => id === `outer-hero-${landmark.id}`);
    assert.ok(collider);
    assert.deepEqual([collider.x, collider.z, collider.halfX, collider.halfZ, collider.rotationY],
      [landmark.position.x, landmark.position.z, landmark.halfX, landmark.halfZ, -landmark.yaw]);
    assert.equal(collider.topY, sampleWorldGround(landmark.position.x, landmark.position.z) + landmark.topOffset);
    const rockColliders = STATIC_WORLD_COLLIDERS.filter(({ id }) => id.startsWith(`outer-hero-${landmark.id}-rock-`));
    assert.equal(rockColliders.length, OUTER_HERO_ROCKS[landmark.id].length);
    for (const [index, [x, y, z, sx, sy, sz]] of OUTER_HERO_ROCKS[landmark.id].entries()) {
      const rock = rockColliders.find(({ id }) => id.endsWith(`rock-${index + 1}`));
      const cos = Math.cos(landmark.yaw);
      const sin = Math.sin(landmark.yaw);
      const radius = Math.max(sx, sy, sz);
      assert.equal(rock.type, 'circle');
      assert.deepEqual([rock.x, rock.z, rock.radius], [
        landmark.position.x + cos * x + sin * z,
        landmark.position.z - sin * x + cos * z,
        radius,
      ]);
      assert.ok(rock.topY >= sampleWorldGround(landmark.position.x, landmark.position.z) + y + sy * 0.43 + radius);
    }

    const localX = landmark.halfX + PHYSICS_CONSTANTS.ROVER_RADIUS + 0.12;
    const outsideX = landmark.position.x + localX * Math.cos(landmark.yaw);
    const outsideZ = landmark.position.z - localX * Math.sin(landmark.yaw);
    const outside = initial(outsideX, outsideZ);
    const approach = stepPlayerPhysics(outside, { moveX: 0, moveZ: 0, jumpJustPressed: false, dt: 0.05 }, [collider], PHYSICS_CONSTANTS.ROVER_RADIUS);
    assert.equal(approach.isBlocked, false, `${landmark.id} approach just outside rendered footprint`);
  }
  for (const region of WORLD_REGIONS) {
    const console = STATIC_WORLD_COLLIDERS.find(({ id }) => id === `${region.id}-base-console`);
    assert.ok(console);
    assert.equal(console.type, 'box');
    assert.deepEqual([console.halfX, console.halfZ], [0.96, 0.96]);
    assert.equal(console.topY, sampleWorldGround(region.baseConsole.x, region.baseConsole.z) + 1.72);
    assert.equal(canRoverOccupy(region.safeParking.x, region.safeParking.z, 1.55), true,
      `${region.id} safe parking remains clear for the rover`);
  }
});

test('blocks the legacy rover exhibit, hero footprints, and console bodies', () => {
  const rover = STATIC_WORLD_COLLIDERS.find(({ id }) => id === 'legacy-mars-rover-exhibit');
  assert.ok(rover);
  assert.equal(canRoverOccupy(rover.x, rover.z), false);
  assert.equal(canRoverOccupy(rover.x + rover.radius + PHYSICS_CONSTANTS.ROVER_RADIUS + 0.5, rover.z + 4), true);

  const console = STATIC_WORLD_COLLIDERS.find(({ id }) => id === 'impact-base-console');
  assert.ok(console);
  assert.equal(canRoverOccupy(console.x, console.z), false);

  const hero = STATIC_WORLD_COLLIDERS.find(({ id }) => id === 'outer-hero-impact-radome');
  assert.ok(hero);
  assert.equal(canRoverOccupy(hero.x, hero.z), false);

  const localX = hero.halfX + PHYSICS_CONSTANTS.ROVER_RADIUS + 0.01;
  const angle = hero.rotationY ?? 0;
  const outsideX = hero.x + localX * Math.cos(angle);
  const outsideZ = hero.z + localX * Math.sin(angle);
  const outside = {
    x: outsideX, y: sampleWorldGround(outsideX, outsideZ), z: outsideZ,
    vy: 0, isGrounded: true, isBlocked: false,
    blockedByLabel: null, blockedObstacleJumpable: false, standingOnLabel: null,
  };
  const freeStep = stepPlayerPhysics(outside, { moveX: 0, moveZ: 0, jumpJustPressed: false, dt: 0.05 }, [hero], PHYSICS_CONSTANTS.ROVER_RADIUS);
  assert.equal(freeStep.isBlocked, false, 'rover stays clear just outside the measured hero footprint');
});

test('parked rover collider encloses authored playable model height and footprint', () => {
  const parked = buildWorldColliders([3.8, -0.32, -2.2], false).at(-1);
  assert.equal(parked.id, 'parked-mars-rover');
  assert.equal(parked.radius, 1.55);
  assert.equal(parked.topY, -0.32 + 1.6);
  assert.equal(buildWorldColliders([3.8, -0.32, -2.2], true), STATIC_WORLD_COLLIDERS);
});

test('samples exact home ground and lands on clear outer terrain without a nearby feature', () => {
  assert.equal(sampleWorldGround(209, 0), WORLD_GROUND_Y);
  assert.equal(sampleWorldGround(210, 0), WORLD_GROUND_Y);
  const x = 240;
  const z = -232;
  assert.equal(canRoverOccupy(x, z), true, 'fixture must be clear of nearby outer colliders');
  const originalGround = sampleWorldGround(x, z);
  assert.notEqual(originalGround, WORLD_GROUND_Y);
  const landed = step(initial(x, z, WORLD_GROUND_Y));
  assert.deepEqual([landed.x, landed.z], [x, z], 'stationary landing probe stays at the clear fixture point');
  assert.equal(landed.y, sampleWorldGround(landed.x, landed.z));
  assert.equal(landed.y, originalGround, 'clear-body landing equals the original sampled ground exactly');
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

test('keeps the 1.55m rover clear along every authored route at half-meter samples', () => {
  for (const route of ROVER_ROUTES) {
    for (let segment = 1; segment < route.points.length; segment += 1) {
      const from = route.points[segment - 1];
      const to = route.points[segment];
      const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.5);
      for (let index = 0; index <= steps; index += 1) {
        const t = index / steps;
        const x = from.x + (to.x - from.x) * t;
        const z = from.z + (to.z - from.z) * t;
        assert.equal(canRoverOccupy(x, z, 1.55), true,
          `${route.regionId} route segment ${segment} blocked at (${x}, ${z})`);
      }
    }
  }
});

test('outer science anchors retain a rover-accessible approach inside 4.5m', () => {
  for (const region of WORLD_REGIONS) {
    for (const [index, anchor] of region.discoveries.entries()) {
      const approach = Array.from({ length: 16 }, (_, direction) => ({
        x: anchor.x + Math.cos(direction * Math.PI / 8) * 4.5,
        z: anchor.z + Math.sin(direction * Math.PI / 8) * 4.5,
      })).find(({ x, z }) => canRoverOccupy(x, z, 1.55));
      assert.ok(approach, `${region.id} discovery ${index + 1} has no clear rover approach within 4.5m`);
    }
  }
  const feature = ADDITIVE_OUTER_COLLIDERS.find(({ id }) => id === 'ice.discovery-1');
  assert.ok(feature);
  assert.equal(canRoverOccupy(feature.x, feature.z), false);
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
