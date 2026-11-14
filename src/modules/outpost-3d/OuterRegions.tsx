import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import {
  ROUTE_CLEARANCE,
  ROVER_ROUTES,
  WORLD_REGIONS,
  createOuterTerrainGrid,
  sampleWorldGround,
  type OuterRegion,
  type RegionId,
  type WorldPoint,
} from './worldRegions';

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_ROCK = new THREE.DodecahedronGeometry(1, 0);
const UNIT_CRYSTAL = new THREE.OctahedronGeometry(1, 0);
const UNIT_CYLINDER = new THREE.CylinderGeometry(1, 1, 1, 8);
const UNIT_SPHERE = new THREE.SphereGeometry(1, 10, 8);

const TERRAIN_MATERIAL = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.96,
  metalness: 0.04,
  flatShading: true,
});
const HARDWARE_MATERIAL = new THREE.MeshStandardMaterial({ color: '#1E293B', roughness: 0.62, metalness: 0.58 });
const DARK_MATERIAL = new THREE.MeshStandardMaterial({ color: '#202326', roughness: 0.9, metalness: 0.18 });
const PANEL_MATERIAL = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.48, metalness: 0.55 });
const ROCK_MATERIALS = Object.fromEntries(WORLD_REGIONS.map(({ id, palette }) => [
  id,
  new THREE.MeshStandardMaterial({ color: palette.rock, roughness: 0.94, metalness: 0.06, flatShading: true }),
])) as Record<RegionId, THREE.MeshStandardMaterial>;
const ACCENT_MATERIALS = Object.fromEntries(WORLD_REGIONS.map(({ id, palette }) => [
  id,
  new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.72, metalness: 0.18, flatShading: true }),
])) as Record<RegionId, THREE.MeshStandardMaterial>;

interface FormationPiece {
  dx: number;
  dz: number;
  scale: [number, number, number];
  yaw: number;
  kind: 'rock' | 'crystal' | 'shelf' | 'channel' | 'ridge';
  accent?: boolean;
}

interface FormationLayout {
  offset: WorldPoint;
  pieces: FormationPiece[];
}

const FORMATIONS: Record<RegionId, FormationLayout> = {
  impact: {
    offset: { x: 0, z: 18 },
    pieces: [
      { dx: -3, dz: -1, scale: [3.8, 0.8, 1.1], yaw: 0.25, kind: 'rock' },
      { dx: 1, dz: -3, scale: [2.5, 0.95, 1], yaw: -0.35, kind: 'rock', accent: true },
      { dx: 3, dz: 1, scale: [3.4, 0.75, 1.2], yaw: 0.7, kind: 'rock' },
      { dx: -1, dz: 3, scale: [2.4, 0.65, 1], yaw: -0.7, kind: 'rock' },
    ],
  },
  ice: {
    offset: { x: -18, z: 0 },
    pieces: [
      { dx: -2, dz: -1, scale: [1.1, 2.5, 0.9], yaw: 0.1, kind: 'crystal', accent: true },
      { dx: 0, dz: 0, scale: [1.25, 3.6, 1], yaw: -0.2, kind: 'crystal' },
      { dx: 2, dz: 1, scale: [1, 2.4, 0.85], yaw: 0.45, kind: 'crystal', accent: true },
      { dx: 1, dz: -2, scale: [2.6, 0.55, 1], yaw: 0.25, kind: 'rock' },
    ],
  },
  volcano: {
    offset: { x: 0, z: 18 },
    pieces: [
      { dx: -3, dz: -1, scale: [4, 0.55, 1.6], yaw: 0.12, kind: 'shelf' },
      { dx: 1, dz: -2, scale: [3.2, 0.48, 1.4], yaw: -0.2, kind: 'shelf', accent: true },
      { dx: 3, dz: 1, scale: [3.6, 0.62, 1.7], yaw: 0.28, kind: 'shelf' },
      { dx: -1, dz: 2, scale: [2.8, 0.42, 1.35], yaw: -0.28, kind: 'shelf' },
    ],
  },
  lake: {
    offset: { x: 0, z: -18 },
    pieces: [
      { dx: -3, dz: -1, scale: [6, 0.045, 0.72], yaw: -0.2, kind: 'channel' },
      { dx: 2, dz: 0, scale: [5.2, 0.045, 0.62], yaw: 0.15, kind: 'channel', accent: true },
      { dx: -1, dz: 2, scale: [3.6, 0.045, 0.55], yaw: -0.5, kind: 'channel' },
      { dx: 3, dz: -2, scale: [2.6, 0.6, 1.1], yaw: 0.4, kind: 'rock' },
    ],
  },
  dust: {
    offset: { x: 18, z: 0 },
    pieces: [
      { dx: -2, dz: -3, scale: [5, 0.55, 1.3], yaw: -0.28, kind: 'ridge' },
      { dx: 2, dz: 0, scale: [5.8, 0.62, 1.4], yaw: 0.2, kind: 'ridge', accent: true },
      { dx: -1, dz: 3, scale: [4.6, 0.48, 1.2], yaw: -0.12, kind: 'ridge' },
      { dx: 4, dz: -3, scale: [2.2, 0.45, 1], yaw: 0.55, kind: 'rock' },
    ],
  },
};

function routeDistance(x: number, z: number): number {
  let nearest = Infinity;
  for (const route of ROVER_ROUTES) {
    for (let i = 1; i < route.points.length; i += 1) {
      const a = route.points[i - 1];
      const b = route.points[i];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const t = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
      nearest = Math.min(nearest, Math.hypot(x - (a.x + t * dx), z - (a.z + t * dz)));
    }
  }
  return nearest;
}

function colorTerrain(positions: Float32Array): Float32Array {
  const colors = new Float32Array(positions.length);
  const palette = WORLD_REGIONS.map((region) => ({
    x: region.center.x,
    z: region.center.z,
    terrain: new THREE.Color(region.palette.terrain),
    rock: new THREE.Color(region.palette.rock),
  }));
  const home = new THREE.Color('#752405');
  const color = new THREE.Color();

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const z = positions[i + 2];
    let red = 0;
    let green = 0;
    let blue = 0;
    let total = 0;
    for (const region of palette) {
      const dx = x - region.x;
      const dz = z - region.z;
      const weight = Math.exp(-(dx * dx + dz * dz) / (2 * 112 * 112));
      red += region.terrain.r * weight;
      green += region.terrain.g * weight;
      blue += region.terrain.b * weight;
      total += weight;
    }
    color.setRGB(red / total, green / total, blue / total);
    const nearestRock = palette.reduce((best, region) =>
      Math.hypot(x - region.x, z - region.z) < Math.hypot(x - best.x, z - best.z) ? region : best, palette[0]);
    const strata = 0.14 + 0.1 * (0.5 + 0.5 * Math.sin(x * 0.026 + z * 0.018));
    color.lerp(nearestRock.rock, strata);
    const radius = Math.hypot(x, z);
    const transition = THREE.MathUtils.smoothstep(radius, 210, 246);
    color.lerp(home, 1 - transition);
    color.multiplyScalar(0.97 + 0.035 * Math.sin(x * 0.019) * Math.cos(z * 0.023));
    colors[i] = color.r;
    colors[i + 1] = color.g;
    colors[i + 2] = color.b;
  }
  return colors;
}

function makeTerrainGeometry(): THREE.BufferGeometry {
  const grid = createOuterTerrainGrid(8);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(grid.positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colorTerrain(grid.positions), 3));
  geometry.setIndex(new THREE.BufferAttribute(grid.indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

const Formation: React.FC<{ region: OuterRegion }> = ({ region }) => {
  const layout = FORMATIONS[region.id];
  return <>
    {layout.pieces.map((piece, index) => {
      const x = region.center.x + layout.offset.x + piece.dx;
      const z = region.center.z + layout.offset.z + piece.dz;
      if (routeDistance(x, z) < ROUTE_CLEARANCE + piece.scale[0] * 0.2) return null;
      const ground = sampleWorldGround(x, z);
      const isFlatSlab = piece.kind === 'shelf' || piece.kind === 'channel';
      const y = ground + (piece.kind === 'channel' ? 0.012 : isFlatSlab ? piece.scale[1] * 0.51 : piece.scale[1] * 0.91);
      const geometry = piece.kind === 'crystal' ? UNIT_CRYSTAL
        : piece.kind === 'shelf' || piece.kind === 'channel' ? UNIT_BOX
          : UNIT_ROCK;
      const material = piece.accent ? ACCENT_MATERIALS[region.id] : ROCK_MATERIALS[region.id];
      return <mesh
        key={`${region.id}-formation-${index}`}
        geometry={geometry}
        material={material}
        position={[x, y, z]}
        scale={piece.scale}
        rotation={[0, piece.yaw, 0]}
        castShadow
        receiveShadow
      />;
    })}
  </>;
};

const FieldSite: React.FC<{
  region: OuterRegion;
  point: WorldPoint;
  kind: 'discovery' | 'branch';
  index: number;
}> = ({ region, point, kind, index }) => {
  const heading = (index % 2) * Math.PI / 2;
  const siteY = sampleWorldGround(point.x, point.z);
  return <group position={[point.x, siteY, point.z]} rotation={[0, heading, 0]}>
    {/* Skids and a service deck make each activity station a usable work area. */}
    <mesh geometry={UNIT_BOX} material={HARDWARE_MATERIAL} position={[0, 0.1, 0]} scale={[1.72, 0.18, 1.38]} />
    <mesh geometry={UNIT_BOX} material={PANEL_MATERIAL} position={[0, 0.22, -0.58]} scale={[1.72, 0.12, 0.14]} />
    <mesh geometry={UNIT_BOX} material={PANEL_MATERIAL} position={[0, 0.22, 0.58]} scale={[1.72, 0.12, 0.14]} />
    {kind === 'discovery' ? <>
      <mesh geometry={UNIT_BOX} material={HARDWARE_MATERIAL} position={[0, 0.62, 0]} scale={[0.76, 0.66, 0.66]} />
      <mesh geometry={UNIT_CYLINDER} material={ACCENT_MATERIALS[region.id]} position={[0.34, 0.68, 0.42]} scale={[0.12, 0.82, 0.12]} />
      <mesh geometry={UNIT_SPHERE} material={ROCK_MATERIALS[region.id]} position={[-0.52, 0.46, 0.3]} scale={[0.24, 0.24, 0.24]} />
    </> : <>
      <mesh geometry={UNIT_BOX} material={HARDWARE_MATERIAL} position={[0, 0.56, 0]} scale={[0.76, 0.58, 0.7]} />
      <mesh geometry={UNIT_CYLINDER} material={ACCENT_MATERIALS[region.id]} position={[0.52, 0.94, 0.22]} scale={[0.045, 0.82, 0.045]} />
      <mesh geometry={UNIT_BOX} material={PANEL_MATERIAL} position={[-0.52, 0.78, 0]} scale={[0.54, 0.055, 0.72]} rotation={[0.18, 0, 0]} />
      <mesh geometry={UNIT_BOX} material={PANEL_MATERIAL} position={[0.52, 0.78, 0]} scale={[0.54, 0.055, 0.72]} rotation={[-0.18, 0, 0]} />
    </>}
  </group>;
};

const RegionConsole: React.FC<{ region: OuterRegion }> = ({ region }) => {
  // Keep the service deck off the approach line ending at the region center.
  const { x, z } = region.safeParking;
  return <group position={[x, sampleWorldGround(x, z), z]}>
    <mesh geometry={UNIT_BOX} material={HARDWARE_MATERIAL} position={[0, 0.12, 0]} scale={[2.1, 0.22, 1.8]} />
    <mesh geometry={UNIT_CYLINDER} material={PANEL_MATERIAL} position={[-0.72, 0.38, -0.58]} scale={[0.08, 0.48, 0.08]} />
    <mesh geometry={UNIT_CYLINDER} material={PANEL_MATERIAL} position={[0.72, 0.38, 0.58]} scale={[0.08, 0.48, 0.08]} />
    <mesh geometry={UNIT_BOX} material={DARK_MATERIAL} position={[0, 0.78, 0]} scale={[0.92, 0.92, 0.7]} castShadow />
    <mesh geometry={UNIT_BOX} material={ACCENT_MATERIALS[region.id]} position={[0, 1.24, -0.32]} scale={[1.05, 0.12, 0.12]} />
  </group>;
};

/** Additive outer sectors; existing MarsTerrain and its radius-210 ring remain untouched. */
export const OuterRegions: React.FC = () => {
  const terrainGeometry = useMemo(makeTerrainGeometry, []);
  useEffect(() => () => terrainGeometry.dispose(), [terrainGeometry]);

  return <group>
    <mesh geometry={terrainGeometry} material={TERRAIN_MATERIAL} receiveShadow dispose={null} />
    {WORLD_REGIONS.map((region) => <React.Fragment key={region.id}>
      <Formation region={region} />
      <RegionConsole region={region} />
      {region.discoveries.map((point, index) => routeDistance(point.x, point.z) >= ROUTE_CLEARANCE && (
        <FieldSite key={`${region.id}-discovery-${index}`} region={region} point={point} kind="discovery" index={index} />
      ))}
      {region.branches.map((point, index) => routeDistance(point.x, point.z) >= ROUTE_CLEARANCE && (
        <FieldSite key={`${region.id}-branch-${index}`} region={region} point={point} kind="branch" index={index} />
      ))}
    </React.Fragment>)}
  </group>;
};

export default OuterRegions;
