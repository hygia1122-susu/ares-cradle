import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import ts from 'typescript';
import { loadTsModule } from '../mission-v2/support/load-ts-module.mjs';

const world = await loadTsModule('../../src/modules/outpost-3d/worldRegions.ts', import.meta.url);
const physics = await loadTsModule('../../src/modules/character/physicsEngine.ts', import.meta.url);
const outerSource = readFileSync(new URL('../../src/modules/outpost-3d/OuterRegions.tsx', import.meta.url), 'utf8');
const outerCompiled = ts.transpileModule(outerSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
}).outputText;
const outerModule = { exports: {} };
const outerRefs = [];
const outerFrames = [];
let outerState = { playerPos: [0, -0.4, 0], isDrivingRover: false, remoteRegionId: null, roverPos: [0, -0.4, 0] };
const outerReact = {
  Fragment: Symbol('Fragment'),
  createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.length ? children : props?.children } }),
  useEffect: () => {},
  useMemo: (factory) => factory(),
  useRef: (current) => { const ref = { current }; outerRefs.push(ref); return ref; },
};
const outerRequire = (id) => {
  if (id === 'react') return { __esModule: true, default: outerReact, ...outerReact };
  if (id === 'react/jsx-runtime') return {
    jsx: (type, props, key) => ({ type, props: { ...props, key } }),
    jsxs: (type, props, key) => ({ type, props: { ...props, key } }),
    Fragment: outerReact.Fragment,
  };
  if (id === '@react-three/fiber') return { useFrame: (callback) => outerFrames.push(callback) };
  if (id === 'three') return THREE;
  if (id === '@/modules/store/useOutpostStore') return { useOutpostStore: { getState: () => outerState } };
  if (id === './worldRegions') return world;
  if (id === './RegionLandmarks') return { RegionConsole: () => null, RegionHero: () => null };
  throw new Error(`Unexpected OuterRegions import: ${id}`);
};
new Function('require', 'module', 'exports', outerCompiled)(outerRequire, outerModule, outerModule.exports);
const { OuterRegionFill, getOuterRegionFillActor, getOuterRegionFillState, getOuterRegionFillPositions,
  OUTER_REGION_FILL_LIGHTS, OUTER_REGION_FILL_RANGE, OUTER_REGION_FILL_START, OUTER_REGION_FILL_FULL } = outerModule.exports;
const {
  ADDITIVE_OUTER_COLLIDERS, OUTER_HERO_LANDMARKS, OUTER_HERO_ROCKS, PRESERVED_CORE_RADIUS, ROVER_ROUTES,
  WORLD_BOUNDS, WORLD_GROUND_Y, WORLD_REGIONS, createOuterTerrainGrid, distanceFromOuterHeroToRoutes,
  getRegionByPosition, isOuterHeroRouteClear,
  sampleRegionalLandformHeight, sampleWorldGround, sampleWorldNormal,
} = world;
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

test('outer fill uses only the actual outer actor and leaves home unlit', () => {
  const playerPos = [244, -0.4, -239];
  const roverPos = [271, 1.1, -250];
  assert.equal(getOuterRegionFillActor(playerPos, false, null, roverPos), playerPos);
  assert.equal(getOuterRegionFillActor(playerPos, true, 'ice', roverPos), roverPos);
  assert.equal(getOuterRegionFillActor(playerPos, true, null, roverPos), playerPos);

  const home = getOuterRegionFillState(0, 0);
  assert.equal(home.region, null);
  assert.equal(home.weight, 0);
  for (const region of WORLD_REGIONS) {
    for (const [x, , z] of getOuterRegionFillPositions(region)) {
      assert.ok(Math.hypot(x, z) - PRESERVED_CORE_RADIUS > OUTER_REGION_FILL_RANGE,
        `${region.id} source range must not touch the preserved core`);
    }
    const centered = getOuterRegionFillState(region.center.x, region.center.z);
    assert.equal(centered.region.id, region.id);
    assert.equal(centered.distance, 0);
    assert.equal(centered.weight, 1);

    const fading = getOuterRegionFillState(region.center.x + OUTER_REGION_FILL_START, region.center.z);
    assert.equal(fading.weight, 0);
    assert.ok(Number.isFinite(fading.distance));
  }
  assert.equal(OUTER_REGION_FILL_START, 90);
  assert.equal(OUTER_REGION_FILL_FULL, 65);
  assert.equal(OUTER_REGION_FILL_RANGE, 60);
  assert.deepEqual(OUTER_REGION_FILL_LIGHTS.map(({ intensity, color }) => [intensity, color]), [
    [1600, '#FFE6C7'], [600, '#C8D3D5'],
  ]);

  const region = WORLD_REGIONS.find(({ id }) => id === 'ice');
  const positions = getOuterRegionFillPositions(region);
  assert.equal(positions.length, 2);
  for (const [index, position] of positions.entries()) {
    assert.equal(position.length, 3);
    assert.ok(position.every(Number.isFinite));
    assert.ok(position[1] > sampleWorldGround(position[0], position[2]));
    assert.ok(Number.isFinite(OUTER_REGION_FILL_LIGHTS[index].intensity));
  }
});

test('outer region lights are exactly two shadowless finite-range point lights', () => {
  const lightTree = OuterRegionFill();
  const renderedLights = lightTree.props.children[0];
  assert.equal(renderedLights.length, 2);
  assert.deepEqual(renderedLights.map(({ type, props }) => ({
    type, intensity: props.intensity, distance: props.distance, decay: props.decay, castShadow: props.castShadow,
  })), OUTER_REGION_FILL_LIGHTS.map(() => ({
    type: 'pointLight', intensity: 0, distance: 60, decay: 2, castShadow: false,
  })));
  assert.equal(outerRefs.length, 2);
  for (const ref of outerRefs) ref.current = new THREE.PointLight();

  assert.equal(outerFrames.length, 1);
  for (const [x, z] of [[0, 0], ...WORLD_REGIONS.map(({ center }) => [center.x, center.z])]) {
    outerState = { playerPos: [x, -0.4, z], isDrivingRover: false, remoteRegionId: null, roverPos: [0, -0.4, 0] };
    outerFrames[0]();
    const { region, weight } = getOuterRegionFillState(x, z);
    const expectedIntensities = region
      ? OUTER_REGION_FILL_LIGHTS.map(({ intensity }) => intensity * weight)
      : [0, 0];
    assert.deepEqual(outerRefs.map(({ current }) => current.intensity), expectedIntensities);
  }
  const ice = WORLD_REGIONS.find(({ id }) => id === 'ice');
  outerState = { playerPos: [0, -0.4, 0], isDrivingRover: true, remoteRegionId: 'ice', roverPos: [ice.center.x, -0.4, ice.center.z] };
  outerFrames[0]();
  assert.deepEqual(outerRefs.map(({ current }) => current.intensity), OUTER_REGION_FILL_LIGHTS.map(({ intensity }) => intensity));
});

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
      assert.ok(y >= -3 && y <= 8, `height ${y} at ${x},${z}`);
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

test('regional geology produces visible bigforms while preserving every authored ground anchor', () => {
  const expectedSpans = { impact: 2.5, ice: 3.5, volcano: 3.5, lake: 3.5, dust: 3.5 };
  for (const region of WORLD_REGIONS) {
    let min = Infinity;
    let max = -Infinity;
    for (let dx = -65; dx <= 65; dx += 2) {
      for (let dz = -65; dz <= 65; dz += 2) {
        const x = region.center.x + dx;
        const z = region.center.z + dz;
        const height = sampleRegionalLandformHeight(x, z);
        assert.ok(Number.isFinite(height));
        if (Math.hypot(x, z) > 224) { min = Math.min(min, height); max = Math.max(max, height); }
      }
    }
    assert.ok(max - min >= expectedSpans[region.id], `${region.id} relief span ${max - min}`);
    for (const anchor of [...region.discoveries, ...region.branches, region.baseConsole, region.safeParking]) {
      assert.equal(sampleRegionalLandformHeight(anchor.x, anchor.z), 0, `${region.id} authored anchor delta`);
    }
  }
  for (const landmark of OUTER_HERO_LANDMARKS) {
    assert.equal(sampleRegionalLandformHeight(landmark.position.x, landmark.position.z), 0, `${landmark.id} hero root delta`);
  }
});

test('routes are bounded, continuous, and do not cross additive landmark lanes', () => {
  assert.equal(ROVER_ROUTES.length, 5);
  assert.equal(ADDITIVE_OUTER_COLLIDERS.length, 25);
  for (const route of ROVER_ROUTES) {
    const region = WORLD_REGIONS.find(({ id }) => id === route.regionId);
    assert.deepEqual(route.points[0], route.entryPoint);
    const approach = route.points.at(-1);
    assert.ok(distance(approach, region.baseConsole) >= 9.9 && distance(approach, region.baseConsole) <= 10.1,
      `${route.regionId} route should stop about 10m from its console`);
    assert.ok(distance(route.points.at(-2), approach) >= 9.9,
      `${route.regionId} final route segment should reach the approach point`);
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
        assert.ok(Math.abs(current - previous) <= 0.22, `${route.regionId} steep route segment ${previous} -> ${current} at t=${t}`);
        previous = current;
      }
    }
  }
});

test('five named hero assemblies have bounded physical footprints and clear routes', () => {
  assert.equal(OUTER_HERO_LANDMARKS.length, 5);
  assert.deepEqual(OUTER_HERO_LANDMARKS.map(({ id }) => id).sort(), [
    'dust-weather-truss', 'ice-drill-gantry', 'impact-radome', 'lake-strata-arch', 'volcano-survey-truss',
  ]);
  const footprintGeometry = new THREE.BoxGeometry(1, 1, 1);
  const source = readFileSync(new URL('../../src/modules/outpost-3d/RegionLandmarks.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
  }).outputText;
  const element = (type, props, ...children) => ({
    type, props: { ...props, children: children.length ? children.length === 1 ? children[0] : children : props?.children },
  });
  const React = {
    Fragment: Symbol('Fragment'), createElement: element, useMemo: (factory) => factory(), useEffect: () => {}, useRef: (current) => ({ current }),
  };
  const realMaterials = Object.fromEntries(['frame', 'dark', 'shell', 'shellShade', 'seam', 'amber', 'glass', 'foil']
    .map((name) => [name, new THREE.MeshStandardMaterial()]));
  const componentModule = { exports: {} };
  const localRequire = (id) => {
    if (id === 'react') return { __esModule: true, default: React, ...React };
    if (id === 'three') return THREE;
    if (id === '@react-three/fiber') return { useFrame: () => {} };
    if (id === '../../game/art/realism/materials') return { realMaterials };
    if (id === './worldRegions') return world;
    throw new Error(`Unexpected RegionLandmarks import: ${id}`);
  };
  new Function('require', 'module', 'exports', compiled)(localRequire, componentModule, componentModule.exports);
  const { RegionHero } = componentModule.exports;
  const findNamedNode = (node, name) => {
    if (!node) return null;
    if (Array.isArray(node)) return node.map((child) => findNamedNode(child, name)).find(Boolean) ?? null;
    if (typeof node.type === 'function') return findNamedNode(node.type(node.props), name);
    if (node.type === React.Fragment) return findNamedNode(node.props.children, name);
    if (node.props?.name === name) return node;
    return findNamedNode(node.props?.children, name);
  };
  const lakeLandmark = OUTER_HERO_LANDMARKS.find(({ id }) => id === 'lake-strata-arch');
  const lakeRegion = WORLD_REGIONS.find(({ id }) => id === 'lake');
  const strataFace = findNamedNode(RegionHero({ landmark: lakeLandmark, region: lakeRegion }), 'exposed-lake-strata-face');
  assert.ok(strataFace, 'lake hero exposes its sediment face');
  const strataBands = strataFace.props.children;
  assert.equal(strataBands.length, 5);
  assert.ok(strataBands.every(({ type, props }) => type === 'mesh' && props.position[0] < -1.74));
  assert.deepEqual(strataBands.map(({ props }) => props.position[1]), [0.22, 0.55, 0.88, 1.21, 1.54]);
  assert.ok(strataBands.every(({ props }) => props.scale[1] === 0.13
    && props.position[1] - props.scale[1] / 2 >= 0.1
    && props.position[1] + props.scale[1] / 2 <= 1.7));
  assert.equal(new Set(strataBands.map(({ props }) => props.material)).size, 5);
  const heroAdapter = physics.buildOuterPhysicsAdapter();
  const collectWorldVertices = (root) => {
    const vertices = [];
    const visit = (node, parentMatrix = new THREE.Matrix4(), skip = false) => {
      if (!node) return;
      if (Array.isArray(node)) { node.forEach((child) => visit(child, parentMatrix, skip)); return; }
      if (typeof node.type === 'function') { visit(node.type(node.props), parentMatrix, skip); return; }
      if (node.type === React.Fragment) { visit(node.props.children, parentMatrix, skip); return; }
      const props = node.props ?? {};
      const object = new THREE.Object3D();
      if (props.position) object.position.set(...props.position);
      if (props.quaternion) object.quaternion.copy(props.quaternion);
      if (props.rotation) object.rotation.set(...props.rotation);
      if (props.scale) object.scale.set(...props.scale);
      object.updateMatrix();
      const matrix = parentMatrix.clone().multiply(object.matrix);
      const ignored = skip || props.name === 'slow-bounded-dust-devil' || props.name === 'hero-rock-cluster';
      if (!ignored && props.geometry) {
        const positions = props.geometry.getAttribute('position');
        for (let index = 0; index < positions.count; index += 1) {
          vertices.push(new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(matrix));
        }
      }
      if (props.children) visit(props.children, matrix, ignored);
    };
    visit(root);
    return vertices;
  };
  const rockGeometry = new THREE.DodecahedronGeometry(1, 0);
  for (const landmark of OUTER_HERO_LANDMARKS) {
    const clearance = distanceFromOuterHeroToRoutes(landmark);
    assert.ok(Number.isFinite(clearance) && clearance >= 8, `${landmark.id} route clearance ${clearance}`);
    assert.equal(isOuterHeroRouteClear(landmark), clearance >= 8);
    assert.ok(landmark.halfX > 0 && landmark.halfZ > 0 && landmark.topOffset > 0);
    const region = WORLD_REGIONS.find(({ id }) => id === landmark.regionId);
    const heroVertices = collectWorldVertices(RegionHero({ landmark, region }));
    const ground = sampleWorldGround(landmark.position.x, landmark.position.z);
    const bodyBounds = { halfX: 0, halfZ: 0, topY: -Infinity };
    for (const vertex of heroVertices) {
      const dx = vertex.x - landmark.position.x;
      const dz = vertex.z - landmark.position.z;
      const localX = dx * Math.cos(landmark.yaw) - dz * Math.sin(landmark.yaw);
      const localZ = dx * Math.sin(landmark.yaw) + dz * Math.cos(landmark.yaw);
      bodyBounds.halfX = Math.max(bodyBounds.halfX, Math.abs(localX));
      bodyBounds.halfZ = Math.max(bodyBounds.halfZ, Math.abs(localZ));
      bodyBounds.topY = Math.max(bodyBounds.topY, vertex.y);
    }
    assert.ok(bodyBounds.halfX <= landmark.halfX + 1e-6,
      `${landmark.id} rendered halfX=${bodyBounds.halfX} exceeds OBB=${landmark.halfX}`);
    assert.ok(bodyBounds.halfZ <= landmark.halfZ + 1e-6,
      `${landmark.id} rendered halfZ=${bodyBounds.halfZ} exceeds OBB=${landmark.halfZ}`);
    assert.ok(bodyBounds.topY <= ground + landmark.topOffset + 1e-6,
      `${landmark.id} rendered top=${bodyBounds.topY} exceeds collider=${ground + landmark.topOffset}`);

    for (const [index, [x, y, z, sx, sy, sz]] of OUTER_HERO_ROCKS[landmark.id].entries()) {
      const proxy = heroAdapter.find(({ id }) => id === `outer-hero-${landmark.id}-rock-${index + 1}`);
      assert.ok(proxy && proxy.type === 'circle', `${landmark.id} rock ${index + 1} has circle proxy`);
      assert.equal(proxy.radius, Math.max(sx, sy, sz));
      const rockCenterY = ground + y + sy * 0.43;
      assert.ok(proxy.topY >= rockCenterY + Math.max(sx, sy, sz), `${landmark.id} rock ${index + 1} proxy top`);
      const rockVertices = rockGeometry.getAttribute('position');
      const mesh = new THREE.Object3D();
      mesh.position.set(x, y + sy * 0.43, z);
      mesh.scale.set(sx, sy, sz);
      mesh.rotation.set(0.12 * index, 0.24 * index, 0.08 * index);
      mesh.updateMatrix();
      const world = new THREE.Object3D();
      world.position.set(landmark.position.x, ground, landmark.position.z);
      world.rotation.y = landmark.yaw;
      world.updateMatrix();
      const matrix = world.matrix.clone().multiply(mesh.matrix);
      for (let vertexIndex = 0; vertexIndex < rockVertices.count; vertexIndex += 1) {
        const vertex = new THREE.Vector3().fromBufferAttribute(rockVertices, vertexIndex).applyMatrix4(matrix);
        assert.ok(Math.hypot(vertex.x - proxy.x, vertex.z - proxy.z) <= proxy.radius + 1e-6,
          `${landmark.id} rock ${index + 1} rendered vertex outside circle proxy`);
        assert.ok(vertex.y <= proxy.topY + 1e-6,
          `${landmark.id} rock ${index + 1} rendered vertex above proxy`);
      }
    }
    assert.ok(landmark.position.x - landmark.halfX >= WORLD_BOUNDS.minX);
    assert.ok(landmark.position.x + landmark.halfX <= WORLD_BOUNDS.maxX);
    assert.ok(landmark.position.z - landmark.halfZ >= WORLD_BOUNDS.minZ);
    assert.ok(landmark.position.z + landmark.halfZ <= WORLD_BOUNDS.maxZ);
    assert.ok(Math.hypot(landmark.position.x, landmark.position.z) > PRESERVED_CORE_RADIUS);
    const landmarkRegion = WORLD_REGIONS.find(({ id }) => id === landmark.regionId);
    assert.ok(landmarkRegion);
    assert.ok(distance(landmark.position, landmarkRegion.center) < 32, `${landmark.id} remains within its region`);
    const anchorRoverRoute = ROVER_ROUTES.find(({ regionId }) => regionId === landmark.regionId);
    assert.ok(anchorRoverRoute);
    for (const [index, approach] of [
      { x: landmark.position.x + landmark.halfX + 4.5, z: landmark.position.z },
      { x: landmark.position.x - landmark.halfX - 4.5, z: landmark.position.z },
      { x: landmark.position.x, z: landmark.position.z + landmark.halfZ + 4.5 },
      { x: landmark.position.x, z: landmark.position.z - landmark.halfZ - 4.5 },
    ].entries()) {
      assert.ok(Number.isFinite(sampleWorldGround(approach.x, approach.z)), `${landmark.id} approach ${index}`);
    }
  }
  footprintGeometry.dispose();
});

test('four-meter outer mesh tracks canonical ground on route and regional approaches', () => {
  const grid = createOuterTerrainGrid(4);
  for (const route of ROVER_ROUTES) {
    for (const point of route.points) {
      const triangle = triangleAt(grid, point.x, point.z);
      assert.ok(triangle, `${route.regionId} approach triangle exists`);
      const contactError = Math.abs(triangle.height - (sampleWorldGround(point.x, point.z) - 0.16));
      assert.ok(contactError < 0.25, `${route.regionId} approach mesh/contact error ${contactError}`);
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
