/**
 * Canonical game-unit data for the additive world beyond MarsTerrain's radius-210 ring.
 * Ground height is the actor/rover contact height; render vertices offset it to meet the
 * existing -0.56 horizon ring without changing that original geometry.
 */
export const WORLD_BOUNDS = { minX: -300, maxX: 300, minZ: -300, maxZ: 300 } as const;
export const PRESERVED_CORE_RADIUS = 210;
export const WORLD_GROUND_Y = -0.4;
export const OUTER_TERRAIN_RENDER_OFFSET = -0.16;
export const ROUTE_CLEARANCE = 8;
const OUTER_RELIEF_START_RADIUS = 224;

export type WorldPoint = Readonly<{ x: number; z: number }>;
export type RegionId = 'impact' | 'ice' | 'volcano' | 'lake' | 'dust';
export type RegionPalette = Readonly<{ terrain: string; rock: string; accent: string }>;

export interface OuterRegion {
  readonly id: RegionId;
  readonly name: string;
  readonly center: WorldPoint;
  readonly palette: RegionPalette;
  readonly relief: number;
  readonly discoveries: readonly [WorldPoint, WorldPoint, WorldPoint];
  readonly branches: readonly [WorldPoint, WorldPoint];
  readonly baseConsole: WorldPoint;
  readonly safeParking: WorldPoint;
}

export const HOME_REGION = {
  id: 'home',
  name: 'Ares Cradle',
  center: { x: 0, z: 0 },
  palette: { terrain: '#943109', rock: '#752405', accent: '#1E293B' },
} as const;

const point = (x: number, z: number): WorldPoint => ({ x, z });

/** Five additive outer sectors; the original radius-210 world remains untouched. */
export const WORLD_REGIONS: readonly OuterRegion[] = [
  {
    id: 'impact', name: 'Impact Basin', center: point(-240, -240),
    palette: { terrain: '#744033', rock: '#303337', accent: '#A86B54' }, relief: 1.8,
    discoveries: [point(-272, -240), point(-240, -276), point(-218, -255)],
    branches: [point(-270, -229), point(-225, -275)],
    baseConsole: point(-240, -240), safeParking: point(-223, -246),
  },
  {
    id: 'ice', name: 'Sheltered Ice Shelf', center: point(240, -240),
    palette: { terrain: '#59696D', rock: '#788B8E', accent: '#83AEB5' }, relief: 1.55,
    discoveries: [point(272, -240), point(240, -276), point(218, -255)],
    branches: [point(270, -229), point(225, -275)],
    baseConsole: point(240, -240), safeParking: point(223, -246),
  },
  {
    id: 'volcano', name: 'Basalt Ridges', center: point(-240, 240),
    palette: { terrain: '#35383A', rock: '#202326', accent: '#8A5944' }, relief: 2.5,
    discoveries: [point(-272, 240), point(-240, 276), point(-218, 255)],
    branches: [point(-270, 229), point(-225, 275)],
    baseConsole: point(-240, 240), safeParking: point(-223, 246),
  },
  {
    id: 'lake', name: 'Ancient Lake Margin', center: point(240, 240),
    palette: { terrain: '#755346', rock: '#423B38', accent: '#829A9B' }, relief: 1.5,
    discoveries: [point(272, 240), point(240, 276), point(218, 255)],
    branches: [point(270, 229), point(225, 275)],
    baseConsole: point(240, 240), safeParking: point(223, 246),
  },
  {
    id: 'dust', name: 'Wind-Swept Basin', center: point(0, -255),
    palette: { terrain: '#81503B', rock: '#514039', accent: '#9B725D' }, relief: 1.25,
    discoveries: [point(30, -255), point(-32, -263), point(22, -285)],
    branches: [point(-38, -245), point(39, -273)],
    baseConsole: point(0, -255), safeParking: point(18, -242),
  },
];

export interface RoverRoute {
  readonly regionId: RegionId;
  readonly entryPoint: WorldPoint;
  /** Ordered game-unit waypoints from the existing ring to the region center. */
  readonly points: readonly WorldPoint[];
}

/** All five routes begin just beyond the preserved ring and end at their region center. */
export const ROVER_ROUTES: readonly RoverRoute[] = [
  { regionId: 'impact', entryPoint: point(-150, -150), points: [point(-150, -150), point(-180, -180), point(-210, -210), point(-240, -240)] },
  { regionId: 'ice', entryPoint: point(150, -150), points: [point(150, -150), point(180, -180), point(210, -210), point(240, -240)] },
  { regionId: 'volcano', entryPoint: point(-150, 150), points: [point(-150, 150), point(-180, 180), point(-210, 210), point(-240, 240)] },
  { regionId: 'lake', entryPoint: point(150, 150), points: [point(150, 150), point(180, 180), point(210, 210), point(240, 240)] },
  { regionId: 'dust', entryPoint: point(0, -212), points: [point(0, -212), point(0, -232), point(0, -255)] },
];

export interface OuterCircleCollider {
  readonly id: string;
  readonly regionId: RegionId;
  readonly kind: 'discovery' | 'branch';
  readonly x: number;
  readonly z: number;
  readonly radius: number;
}

/** Additive, engine-neutral landmark footprints; Y is always sampled from the ground. */
export const ADDITIVE_OUTER_COLLIDERS: readonly OuterCircleCollider[] = WORLD_REGIONS.flatMap((region) => [
  ...region.discoveries.map((position, index) => ({
    id: `${region.id}.discovery-${index + 1}`, regionId: region.id, kind: 'discovery' as const,
    x: position.x, z: position.z, radius: 2.5,
  })),
  ...region.branches.map((position, index) => ({
    id: `${region.id}.branch-${index + 1}`, regionId: region.id, kind: 'branch' as const,
    x: position.x, z: position.z, radius: 2.5,
  })),
]);

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const smoothstep = (value: number): number => value * value * (3 - 2 * value);
const boundedPoint = (x: number, z: number): WorldPoint => ({
  x: clamp(x, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX),
  z: clamp(z, WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ),
});

/**
 * Single contact-height authority for render adapters, Leo, and rover movement.
 * Returns the exact legacy contact plane through the radius-210 core and flat apron,
 * then blends into broad, deterministic relief with a zero-slope seam. Out-of-bounds samples clamp;
 * invalid coordinates safely resolve to the legacy plane (never wrap or teleport).
 */
export function sampleWorldGround(x: number, z: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return WORLD_GROUND_Y;
  const bounded = boundedPoint(x, z);
  const radius = Math.hypot(bounded.x, bounded.z);
  if (radius <= PRESERVED_CORE_RADIUS) return WORLD_GROUND_Y;

  const fade = smoothstep(clamp((radius - OUTER_RELIEF_START_RADIUS) / 36, 0, 1));
  let relief = 0.72
    + 0.18 * Math.sin(bounded.x * 0.022) * Math.cos(bounded.z * 0.021)
    + 0.12 * Math.sin((bounded.x - bounded.z) * 0.028);
  for (const region of WORLD_REGIONS) {
    const dx = bounded.x - region.center.x;
    const dz = bounded.z - region.center.z;
    relief += region.relief * Math.exp(-(dx * dx + dz * dz) / (2 * 55 * 55));
  }
  return WORLD_GROUND_Y + fade * relief;
}

/** Unit upward normal (Y-up) from the same canonical contact-height sampler. */
export function sampleWorldNormal(x: number, z: number): readonly [number, number, number] {
  const step = 0.5;
  const dx = (sampleWorldGround(x + step, z) - sampleWorldGround(x - step, z)) / (2 * step);
  const dz = (sampleWorldGround(x, z + step) - sampleWorldGround(x, z - step)) / (2 * step);
  const length = Math.hypot(dx, 1, dz);
  return [-dx / length, 1 / length, -dz / length];
}

/** Home owns the preserved disc/ring; outer points classify to their nearest sector. */
export function getRegionByPosition(x: number, z: number): typeof HOME_REGION | OuterRegion {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return HOME_REGION;
  const bounded = boundedPoint(x, z);
  if (Math.hypot(bounded.x, bounded.z) <= PRESERVED_CORE_RADIUS) return HOME_REGION;
  return WORLD_REGIONS.reduce((nearest, region) => {
    const distance = Math.hypot(bounded.x - region.center.x, bounded.z - region.center.z);
    const nearestDistance = Math.hypot(bounded.x - nearest.center.x, bounded.z - nearest.center.z);
    return distance < nearestDistance ? region : nearest;
  }, WORLD_REGIONS[0]);
}

export interface OuterTerrainGrid {
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly segments: number;
  readonly spacing: number;
}

/** Deterministic, bounded regular grid with an overlapping flat apron at the legacy seam. */
export function createOuterTerrainGrid(requestedStep = 8): OuterTerrainGrid {
  const step = Number.isFinite(requestedStep) ? clamp(requestedStep, 4, 24) : 8;
  const segments = Math.ceil((WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) / step);
  const spacing = (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) / segments;
  const width = segments + 1;
  const positions = new Float32Array(width * width * 3);
  for (let row = 0; row < width; row += 1) {
    const z = WORLD_BOUNDS.minZ + row * spacing;
    for (let column = 0; column < width; column += 1) {
      const x = WORLD_BOUNDS.minX + column * spacing;
      const offset = (row * width + column) * 3;
      positions[offset] = x;
      const radius = Math.hypot(x, z);
      positions[offset + 1] = radius <= PRESERVED_CORE_RADIUS
        ? -0.57
        : sampleWorldGround(x, z) + OUTER_TERRAIN_RENDER_OFFSET;
      positions[offset + 2] = z;
    }
  }

  const indices: number[] = [];
  const outsideCore = (vertex: number): boolean => {
    const offset = vertex * 3;
    return Math.hypot(positions[offset], positions[offset + 2]) > PRESERVED_CORE_RADIUS;
  };
  for (let row = 0; row < segments; row += 1) {
    for (let column = 0; column < segments; column += 1) {
      const a = row * width + column;
      const b = a + 1;
      const d = a + width;
      const c = d + 1;
      if (outsideCore(a) || outsideCore(d) || outsideCore(b)) indices.push(a, d, b);
      if (outsideCore(b) || outsideCore(d) || outsideCore(c)) indices.push(b, d, c);
    }
  }
  return { positions, indices: new Uint32Array(indices), segments, spacing };
}
