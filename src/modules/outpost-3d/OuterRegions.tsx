import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useOutpostStore } from '@/modules/store/useOutpostStore';
import {
  getRegionByPosition,
  OUTER_HERO_LANDMARKS,
  sampleWorldGround,
  sampleRegionalLandformHeight,
  WORLD_REGIONS,
  createOuterTerrainGrid,
} from './worldRegions';
import { RegionConsole, RegionHero } from './RegionLandmarks';

const DUNE_BAND = new THREE.Color('#BD8965');
const ICE_SHELF_BAND = new THREE.Color('#C9E1DF');
const BASALT_BAND = new THREE.Color('#25282A');
const SEDIMENT_BENCH_BAND = new THREE.Color('#B18A69');
const CHANNEL_CUT_BAND = new THREE.Color('#81604C');
const EJECTA_BAND = new THREE.Color('#B17952');

const TERRAIN_MATERIAL = new THREE.MeshStandardMaterial({
  vertexColors: true,
  emissive: '#584236',
  emissiveIntensity: 0.06,
  roughness: 0.9,
  metalness: 0.02,
  flatShading: true,
});

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
    const landform = sampleRegionalLandformHeight(x, z);
    if (Math.hypot(x, z + 255) < 78) {
      color.lerp(DUNE_BAND, THREE.MathUtils.smoothstep(landform, 0.8, 3.2) * 0.46);
    }
    if (Math.hypot(x - 260, z + 285) < 66) {
      color.lerp(ICE_SHELF_BAND, THREE.MathUtils.smoothstep(landform, 1.4, 5) * 0.58);
    }
    if (Math.hypot(x + 270, z - 280) < 68) {
      color.lerp(BASALT_BAND, THREE.MathUtils.smoothstep(landform, 1, 4.2) * 0.62);
    }
    if (Math.hypot(x - 265, z - 275) < 72) {
      color.lerp(SEDIMENT_BENCH_BAND, THREE.MathUtils.smoothstep(landform, 0.8, 3.2) * 0.48);
      color.lerp(CHANNEL_CUT_BAND, THREE.MathUtils.smoothstep(-landform, 0.3, 1.6) * 0.5);
    }
    if (Math.hypot(x + 279, z + 278) < 58) {
      color.lerp(EJECTA_BAND, THREE.MathUtils.smoothstep(landform, 0.5, 3) * 0.42);
    }
    const radius = Math.hypot(x, z);
    const transition = THREE.MathUtils.smoothstep(radius, 210, 246);
    color.lerp(home, 1 - transition);

    const impactX = x + 256;
    const impactZ = z + 257;
    const craterRadius = Math.hypot(impactX, impactZ);
    const impactRock = new THREE.Color('#343638');
    if (craterRadius < 14) color.lerp(impactRock, 0.58 * (1 - craterRadius / 14));
    const rimWeight = Math.exp(-((craterRadius - 18) ** 2) / (2 * 3.4 * 3.4));
    color.lerp(new THREE.Color('#AA725A'), rimWeight * 0.42);
    const iceX = x - 256;
    const iceZ = z + 258;
    const iceBand = iceZ + 0.18 * iceX + 3.5;
    const icePatch = Math.exp(-(iceX * iceX + iceZ * iceZ) / (2 * 36 * 36));
    color.lerp(new THREE.Color('#B6C5BE'), Math.exp(-(iceBand * iceBand) / (2 * 3.2 * 3.2)) * icePatch * 0.48);

    const volcanoX = x + 247;
    const volcanoZ = z - 254;
    const terraceRadius = Math.hypot(volcanoX, volcanoZ * 0.78);
    const terraceBand = 0.5 + 0.5 * Math.cos(terraceRadius * Math.PI / 3.6);
    color.lerp(new THREE.Color('#24282A'), terraceBand * Math.exp(-((terraceRadius - 16) ** 2) / (2 * 12 * 12)) * 0.24);
    const lakeX = x - 240;
    const lakeZ = z - 240;
    const lakePatch = Math.exp(-(lakeX * lakeX + lakeZ * lakeZ) / (2 * 42 * 42));
    const braid = Math.sin((lakeX + lakeZ * 0.4) * 0.11) + 0.45 * Math.sin((lakeZ - lakeX * 0.3) * 0.16);
    const sedimentBand = Math.exp(-(braid * braid) / (2 * 0.18 * 0.18)) * lakePatch;
    color.lerp(new THREE.Color('#A27B63'), sedimentBand * 0.22);

    const dustX = x;
    const dustZ = z + 255;
    const dustPatch = Math.exp(-(dustX * dustX / (2 * 49 * 49) + dustZ * dustZ / (2 * 42 * 42)));
    const duneFace = 0.5 + 0.5 * Math.sin((dustZ + 0.24 * dustX) * 0.2);
    color.lerp(new THREE.Color('#B07B58'), dustPatch * duneFace * 0.16);
    color.multiplyScalar(0.97 + 0.035 * Math.sin(x * 0.019) * Math.cos(z * 0.023));
    colors[i] = color.r;
    colors[i + 1] = color.g;
    colors[i + 2] = color.b;
  }
  return colors;
}

function makeTerrainGeometry(): THREE.BufferGeometry {
  const grid = createOuterTerrainGrid(4);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(grid.positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colorTerrain(grid.positions), 3));
  geometry.setIndex(new THREE.BufferAttribute(grid.indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export const OUTER_REGION_FILL_LIGHTS = [
  { radial: 18, lateral: 14, height: 22, color: '#FFE6C7', intensity: 1600 },
  { radial: 30, lateral: -18, height: 12, color: '#C8D3D5', intensity: 600 },
] as const;
export const OUTER_REGION_FILL_START = 90;
export const OUTER_REGION_FILL_FULL = 65;
export const OUTER_REGION_FILL_RANGE = 60;

export function getOuterRegionFillActor(
  playerPos: readonly [number, number, number],
  isDrivingRover: boolean,
  remoteRegionId: string | null,
  roverPos: readonly [number, number, number],
): readonly [number, number, number] {
  return isDrivingRover && remoteRegionId ? roverPos : playerPos;
}

export function getOuterRegionFillState(x: number, z: number) {
  const nearest = getRegionByPosition(x, z);
  const region = WORLD_REGIONS.find(({ id }) => id === nearest.id) ?? null;
  if (!region) return { region, distance: Infinity, weight: 0 };

  const distance = Math.hypot(x - region.center.x, z - region.center.z);
  const weight = 1 - THREE.MathUtils.smoothstep(distance, OUTER_REGION_FILL_FULL, OUTER_REGION_FILL_START);
  return { region, distance, weight };
}

export function getOuterRegionFillPositions(region: (typeof WORLD_REGIONS)[number]) {
  const radius = Math.hypot(region.center.x, region.center.z);
  const radial = [region.center.x / radius, region.center.z / radius] as const;
  const lateral = [-radial[1], radial[0]] as const;
  return OUTER_REGION_FILL_LIGHTS.map((light) => {
    const x = region.center.x + radial[0] * light.radial + lateral[0] * light.lateral;
    const z = region.center.z + radial[1] * light.radial + lateral[1] * light.lateral;
    return [x, sampleWorldGround(x, z) + light.height, z] as const;
  });
}

/** Two non-shadowing, region-ranged sky-fill sources; never active over the preserved core. */
export function OuterRegionFill() {
  const keyLight = useRef<THREE.PointLight>(null);
  const fillLight = useRef<THREE.PointLight>(null);

  useFrame(() => {
    const state = useOutpostStore.getState();
    const [x, , z] = getOuterRegionFillActor(
      state.playerPos,
      state.isDrivingRover,
      state.remoteRegionId,
      state.roverPos,
    );
    const { region, weight } = getOuterRegionFillState(x, z);
    const positions = region ? getOuterRegionFillPositions(region) : null;
    for (const [index, light] of [keyLight.current, fillLight.current].entries()) {
      if (!light) continue;
      if (!region || !positions) {
        light.intensity = 0;
        continue;
      }
      light.position.set(...positions[index]);
      light.intensity = OUTER_REGION_FILL_LIGHTS[index].intensity * weight;
    }
  });

  return <>
    {OUTER_REGION_FILL_LIGHTS.map((light, index) => <pointLight
      key={index}
      ref={index === 0 ? keyLight : fillLight}
      color={light.color}
      intensity={0}
      distance={OUTER_REGION_FILL_RANGE}
      decay={2}
      castShadow={false}
    />)}
  </>;
}

/** Additive outer sectors; existing MarsTerrain and its radius-210 ring remain untouched. */
export const OuterRegions: React.FC = () => {
  const terrainGeometry = useMemo(makeTerrainGeometry, []);
  useEffect(() => () => terrainGeometry.dispose(), [terrainGeometry]);

  return <group>
    <OuterRegionFill />
    <mesh geometry={terrainGeometry} material={TERRAIN_MATERIAL} receiveShadow dispose={null} />
    {WORLD_REGIONS.map((region) => <React.Fragment key={region.id}>
      {OUTER_HERO_LANDMARKS.filter((landmark) => landmark.regionId === region.id).map((landmark) => (
        <RegionHero key={landmark.id} landmark={landmark} region={region} />
      ))}
      <RegionConsole region={region} />
    </React.Fragment>)}
  </group>;
};

export default OuterRegions;
