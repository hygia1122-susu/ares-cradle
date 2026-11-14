import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTsModule } from '../mission-v2/support/load-ts-module.mjs';

const world = await loadTsModule('../../src/modules/outpost-3d/worldRegions.ts', import.meta.url);
const { ADDITIVE_OUTER_COLLIDERS, PRESERVED_CORE_RADIUS, ROVER_ROUTES, WORLD_BOUNDS, WORLD_GROUND_Y, WORLD_REGIONS, createOuterTerrainGrid, getRegionByPosition, sampleWorldGround, sampleWorldNormal } = world;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const segmentDistance = (p, a, b) => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length2 = dx * dx + dz * dz;
  const t = length2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / length2)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
};
const triangleAt = (grid, x, z) => {
  const { positions, indices } = grid;
  for (let i = 0; i < indices.length; i += 3) {
    const vertices = [indices[i], indices[i + 1], indices[i + 2]];
    const points = vertices.map((vertex) => ({
      x: positions[vertex * 3], y: positions[vertex * 3 + 1], z: positions[vertex * 3 + 2],
    }));
    const [a, b, c] = points;
    const denominator = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    const wa = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / denominator;
    const wb = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / denominator;
    const wc = 1 - wa - wb;
    if (wa >= -1e-5 && wb >= -1e-5 && wc >= -1e-5) {
      const crossY = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
      return { points, height: wa * a.y + wb * b.y + wc * c.y, crossY };
    }
  }
  return null;
};

test('preserves the original ground plane exactly throughout the radius-210 world', () => {
  for (let radius = 0; radius <= PRESERVED_CORE_RADIUS; radius += 3) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      assert.equal(sampleWorldGround(radius * Math.cos(angle), radius * Math.sin(angle)), WORLD_GROUND_Y);
    }
  }
  assert.equal(PRESERVED_CORE_RADIUS, 210);
  assert.equal(WORLD_GROUND_Y, -0.4);
});

test('defines five outer regions, centers, opposites, and all markers within bounds', () => {
  assert.deepEqual(WORLD_REGIONS.map(({ id }) => id).sort(), ['dust', 'ice', 'impact', 'lake', 'volcano']);
  for (const region of WORLD_REGIONS) {
    for (const position of [region.center, region.baseConsole, region.safeParking, ...region.discoveries, ...region.branches]) {
      assert.ok(distance(position, { x: 0, z: 0 }) > PRESERVED_CORE_RADIUS, `${region.id} marker in preserved core`);
      assert.ok(position.x >= WORLD_BOUNDS.minX && position.x <= WORLD_BOUNDS.maxX, `${region.id} X bound`);
      assert.ok(position.z >= WORLD_BOUNDS.minZ && position.z <= WORLD_BOUNDS.maxZ, `${region.id} Z bound`);
    }
  }
  assert.ok(distance(WORLD_REGIONS.find(({ id }) => id === 'volcano').center, WORLD_REGIONS.find(({ id }) => id === 'ice').center) > 600);
  assert.equal(WORLD_REGIONS.find(({ id }) => id === 'dust').center.x, 0);
});

test('classifies core as home and outer sample points deterministically', () => {
  assert.equal(getRegionByPosition(0, 0).id, 'home');
  for (const region of WORLD_REGIONS) {
    assert.equal(getRegionByPosition(region.center.x, region.center.z).id, region.id);
    assert.equal(getRegionByPosition(region.center.x, region.center.z).id, getRegionByPosition(region.center.x, region.center.z).id);
  }
  assert.equal(getRegionByPosition(Number.NaN, 12).id, 'home');
});

test('outer ground and normals remain finite, continuous, and gently sloped', () => {
  for (let x = -300; x <= 300; x += 7) {
    for (let z = -300; z <= 300; z += 11) {
      const y = sampleWorldGround(x, z);
      const normal = sampleWorldNormal(x, z);
      assert.ok(Number.isFinite(y));
      assert.ok(y >= -0.401 && y <= 3.6, `height ${y} at ${x},${z}`);
      assert.ok(normal.every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(...normal) - 1) < 1e-10);
      for (const [dx, dz] of [[0.2, 0], [0, 0.2]]) {
        assert.ok(Math.abs(sampleWorldGround(x + dx, z + dz) - y) <= 0.16);
      }
    }
  }
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 24) {
    const x = 210 * Math.cos(angle);
    const z = 210 * Math.sin(angle);
    assert.ok(Math.abs(sampleWorldGround(x, z) - sampleWorldGround(210.01 * Math.cos(angle), 210.01 * Math.sin(angle))) < 0.001);
  }
});

test('routes are bounded, continuous, and do not cross additive landmark lanes', () => {
  assert.equal(ROVER_ROUTES.length, 5);
  assert.equal(ADDITIVE_OUTER_COLLIDERS.length, 25);
  for (const route of ROVER_ROUTES) {
    const region = WORLD_REGIONS.find(({ id }) => id === route.regionId);
    assert.deepEqual(route.points[0], route.entryPoint);
    assert.deepEqual(route.points.at(-1), region.center);
    assert.ok(distance(route.entryPoint, { x: 0, z: 0 }) > PRESERVED_CORE_RADIUS);
    for (const [index, p] of route.points.entries()) {
      assert.ok(p.x >= WORLD_BOUNDS.minX && p.x <= WORLD_BOUNDS.maxX);
      assert.ok(p.z >= WORLD_BOUNDS.minZ && p.z <= WORLD_BOUNDS.maxZ);
      assert.ok(Number.isFinite(sampleWorldGround(p.x, p.z)));
      if (index) assert.ok(distance(p, route.points[index - 1]) <= 45, `${route.regionId} route gap`);
    }
    for (const collider of ADDITIVE_OUTER_COLLIDERS) {
      for (let i = 1; i < route.points.length; i += 1) {
        assert.ok(segmentDistance(collider, route.points[i - 1], route.points[i]) > collider.radius + 8,
          `${route.regionId} route intersects ${collider.id}`);
      }
    }
    for (let i = 1; i < route.points.length; i += 1) {
      const a = route.points[i - 1];
      const b = route.points[i];
      const length = distance(a, b);
      const steps = Math.max(1, Math.ceil(length / 2));
      let previous = sampleWorldGround(a.x, a.z);
      for (let step = 1; step <= steps; step += 1) {
        const t = step / steps;
        const current = sampleWorldGround(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
        assert.ok(Math.abs(current - previous) <= 0.22, `${route.regionId} steep route segment`);
        previous = current;
      }
    }
  }
});

test('outer terrain grid covers the legacy-ring seam with a hidden overlapping apron', () => {
  const grid = createOuterTerrainGrid(8);
  for (let i = 0; i < grid.positions.length; i += 3) {
    if (Math.hypot(grid.positions[i], grid.positions[i + 2]) <= PRESERVED_CORE_RADIUS) {
      assert.ok(grid.positions[i + 1] < -0.56, `core overlap vertex above legacy ring: ${grid.positions[i + 1]}`);
    }
  }
  for (const radius of [210.1, 211, 214, 218, 224]) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 32) {
      const x = radius * Math.cos(angle);
      const z = radius * Math.sin(angle);
      const triangle = triangleAt(grid, x, z);
      assert.ok(triangle, `missing terrain triangle at radius ${radius}, angle ${angle}`);
      assert.ok(triangle.crossY > 0, `downward triangle at radius ${radius}, angle ${angle}`);
      if (radius <= 218) {
        assert.ok(triangle.height <= -0.559, `seam terrain above legacy ring at radius ${radius}, angle ${angle}`);
      }
      for (const vertex of triangle.points) {
        if (Math.hypot(vertex.x, vertex.z) <= PRESERVED_CORE_RADIUS) {
          assert.ok(vertex.y < -0.56, `overlap vertex rises above legacy ring: ${vertex.y}`);
        }
      }
    }
  }
});

test('outer terrain render grid is deterministic, bounded, and preserves original core geometry', () => {
  const grid = createOuterTerrainGrid(8);
  const again = createOuterTerrainGrid(8);
  assert.equal(grid.segments, 75);
  assert.equal(grid.positions.length, 76 * 76 * 3);
  assert.deepEqual(grid.indices, again.indices);
  assert.deepEqual(grid.positions, again.positions);
  assert.ok(grid.indices.length > 0);
  for (let i = 0; i < grid.positions.length; i += 3) {
    assert.ok(grid.positions[i] >= WORLD_BOUNDS.minX && grid.positions[i] <= WORLD_BOUNDS.maxX);
    assert.ok(grid.positions[i + 2] >= WORLD_BOUNDS.minZ && grid.positions[i + 2] <= WORLD_BOUNDS.maxZ);
    assert.ok(Number.isFinite(grid.positions[i + 1]));
  }
  for (let i = 0; i < grid.indices.length; i += 3) {
    for (let j = 0; j < 3; j += 1) {
      const vertex = grid.indices[i + j] * 3;
      assert.ok(Math.hypot(grid.positions[vertex], grid.positions[vertex + 2]) >= PRESERVED_CORE_RADIUS - 12);
    }
  }
});
