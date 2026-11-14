/**
 * Ares Cradle - 3D Rigid-Body Obstacle Collision & Martian Gravity Physics Engine
 * Pure, deterministic kinematics and collision resolution module (testable via node:test).
 *
 * Features:
 * - Martian gravity (g = 9.2 m/s²) and vertical jump impulse ([Space] / Touch Jump)
 * - 3D Circle, Oriented Box (OBB), and Hollow Ring (with doorway cutouts) colliders
 * - Smooth tangent wall-sliding when blocked horizontally (prevents walking through walls)
 * - Vertical clearance & platform top landing (jump over or onto obstacles with [Space])
 */

import {
  ADDITIVE_OUTER_COLLIDERS,
  OUTER_HERO_LANDMARKS,
  OUTER_HERO_ROCKS,
  WORLD_BOUNDS,
  WORLD_REGIONS,
  getOuterHeroVerticalPlacement,
  sampleWorldGround,
} from '../outpost-3d/worldRegions';

const PARKED_ROVER_COLLIDER_RADIUS = 1.55;
const PARKED_ROVER_COLLIDER_TOP_OFFSET = 1.6;

/** The renderer uses a unit dodecahedron, whose vertices fit within its circumradius. */
export function buildOuterPhysicsAdapter(): ObstacleCollider[] {
  return OUTER_HERO_LANDMARKS.flatMap((landmark) => {
    const groundY = sampleWorldGround(landmark.position.x, landmark.position.z);
    const hero = {
      id: `outer-hero-${landmark.id}`,
      label: `${landmark.regionId} ${landmark.id}`,
      type: 'box' as const,
      x: landmark.position.x,
      z: landmark.position.z,
      halfX: landmark.halfX,
      halfZ: landmark.halfZ,
      rotationY: -landmark.yaw,
      topY: getOuterHeroVerticalPlacement(landmark, groundY).topY,
      jumpable: true,
    };
    const rocks = OUTER_HERO_ROCKS[landmark.id].map(([x, y, z, sx, sy, sz], index) => {
      const cos = Math.cos(landmark.yaw);
      const sin = Math.sin(landmark.yaw);
      const localY = y + sy * 0.43;
      return {
        id: `outer-hero-${landmark.id}-rock-${index + 1}`,
        label: `${landmark.regionId} ${landmark.id} rock ${index + 1}`,
        type: 'circle' as const,
        x: landmark.position.x + cos * x + sin * z,
        z: landmark.position.z - sin * x + cos * z,
        radius: Math.max(sx, sy, sz),
        topY: groundY + localY + Math.max(sx, sy, sz),
        jumpable: true,
      };
    });
    return [hero, ...rocks];
  });
}

export const PHYSICS_CONSTANTS = {
  GROUND_Y: -0.4,
  MARS_GRAVITY: 9.2,          // m/s² (Low Martian gravity for responsive jumps)
  JUMP_VELOCITY: 5.6,         // m/s (Peak jump height ~1.70m above ground -> y = +1.30m)
  DOUBLE_JUMP_VELOCITY: 5.2,  // m/s (Secondary mid-air EVA jetpack boost)
  MAX_AIR_JUMPS: 1,           // 1 mid-air jetpack burst per jump cycle
  COYOTE_TIME: 0.14,          // s (Grace window to jump after stepping off a ledge)
  JUMP_BUFFER_TIME: 0.14,     // s (Input buffer window before touching ground)
  WALK_SPEED: 4.2,            // m/s (Standard EVA walk speed)
  SPRINT_SPEED: 6.6,          // m/s (Shift EVA Thruster Sprint speed)
  PLAYER_RADIUS: 0.34,        // m
  ROVER_RADIUS: 0.92,         // m
  STEP_UP_TOLERANCE: 0.08,    // m (Ledges taller than 8cm block walking and require jumping)
  MAX_DT: 0.05                // s (Clamped frame delta to prevent wall tunneling)
} as const;

export interface CircleCollider {
  id: string;
  label: string;
  type: 'circle';
  x: number;
  z: number;
  radius: number;
  topY: number;
  jumpable: boolean;
}

export interface BoxCollider {
  id: string;
  label: string;
  type: 'box';
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
  rotationY?: number;
  topY: number;
  jumpable: boolean;
}

export interface RingOpening {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface RingCollider {
  id: string;
  label: string;
  type: 'ring';
  x: number;
  z: number;
  innerRadius: number;
  outerRadius: number;
  topY: number;
  jumpable: boolean;
  openings?: RingOpening[];
}

export type ObstacleCollider = CircleCollider | BoxCollider | RingCollider;

export interface PhysicsState {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy: number;
  vz?: number;
  isGrounded: boolean;
  isBlocked: boolean;
  blockedByLabel: string | null;
  blockedObstacleJumpable: boolean;
  standingOnLabel: string | null;
  airJumpsLeft?: number;
  coyoteTimer?: number;
  jumpBufferTimer?: number;
  didDoubleJump?: boolean;
}

export interface PhysicsInput {
  moveX: number; // Desired world X velocity (m/s)
  moveZ: number; // Desired world Z velocity (m/s)
  jumpJustPressed: boolean;
  dt: number;
  useSmoothInertia?: boolean;
}

/**
 * Static colliders matching the exact 3D scene geometry in HabitatDome, HabitatInterior,
 * SolarArray, BatteryBank, and MarsTerrain.
 */
export const STATIC_WORLD_COLLIDERS: ObstacleCollider[] = [
  // 1. Habitat Dome 3D-Printed Regolith Perimeter Wall (Radius ~3.85m)
  // Blocks walking through the dome walls; open at South Ramp (+Z) and East Airlock (+X)
  {
    id: 'habitat-dome-wall',
    label: 'Habitat Perimeter Wall',
    type: 'ring',
    x: 0,
    z: 0,
    innerRadius: 3.60,
    outerRadius: 4.18,
    topY: 0.55,
    jumpable: true,
    openings: [
      // South Rover Charging Ramp Entry (+Z)
      { minX: -1.15, maxX: 1.15, minZ: 2.5, maxZ: 5.0 },
      // East Pressurized Airlock Access Tunnel (+X)
      { minX: 2.5, maxX: 5.2, minZ: -0.65, maxZ: 0.65 }
    ]
  },

  // 2. Habitat Interior Zones
  {
    id: 'central-command-table',
    label: 'Central Command Table',
    type: 'circle',
    x: 0,
    z: 0,
    radius: 1.05,
    topY: 0.42,
    jumpable: true
  },
  {
    id: 'sabatier-scrubber',
    label: 'Sabatier O₂ Scrubber',
    type: 'box',
    x: -2.4,
    z: 0,
    halfX: 0.64,
    halfZ: 0.48,
    topY: 0.62,
    jumpable: true
  },
  {
    id: 'hydroponic-farm',
    label: 'Hydroponic Farm Rack',
    type: 'box',
    x: 0,
    z: -2.4,
    halfX: 1.22,
    halfZ: 0.32,
    topY: 0.72,
    jumpable: true
  },
  {
    id: 'chemical-workbench',
    label: 'Specimen Workbench',
    type: 'box',
    x: -1.7,
    z: 1.7,
    halfX: 0.76,
    halfZ: 0.38,
    rotationY: Math.PI / 4,
    topY: 0.45,
    jumpable: true
  },
  {
    id: 'spiral-staircase',
    label: 'Observation Staircase',
    type: 'circle',
    x: 1.4,
    z: -1.0,
    radius: 0.48,
    topY: 0.68,
    jumpable: true
  },

  // 3. Exterior Outpost Infrastructure
  {
    id: 'solar-array',
    label: 'Photovoltaic Solar Array',
    type: 'box',
    x: -4.5,
    z: 1.4,
    halfX: 1.82,
    halfZ: 0.92,
    rotationY: 0.3,
    topY: 0.62,
    jumpable: true
  },
  {
    id: 'battery-bank',
    label: 'Battery Substation Vault',
    type: 'box',
    x: 3.8,
    z: -1.6,
    halfX: 0.84,
    halfZ: 1.12,
    rotationY: -0.4,
    topY: 0.68,
    jumpable: true
  },
  {
    id: 'comms-mast',
    label: 'Deep-Space Comms Mast',
    type: 'circle',
    x: -2.8,
    z: -2.8,
    radius: 0.42,
    topY: 0.65,
    jumpable: true
  },
  {
    id: 'ramp-rail-left',
    label: 'Ramp Safety Rail',
    type: 'box',
    x: -1.12,
    z: 4.8,
    halfX: 0.12,
    halfZ: 1.38,
    topY: 0.12,
    jumpable: true
  },
  {
    id: 'ramp-rail-right',
    label: 'Ramp Safety Rail',
    type: 'box',
    x: 1.12,
    z: 4.8,
    halfX: 0.12,
    halfZ: 1.38,
    topY: 0.12,
    jumpable: true
  },
  {
    id: 'airlock-wall-north',
    label: 'Airlock Bulkhead',
    type: 'box',
    x: 3.85,
    z: -0.72,
    halfX: 0.78,
    halfZ: 0.16,
    topY: 0.58,
    jumpable: true
  },
  {
    id: 'airlock-wall-south',
    label: 'Airlock Bulkhead',
    type: 'box',
    x: 3.85,
    z: 0.72,
    halfX: 0.78,
    halfZ: 0.16,
    topY: 0.58,
    jumpable: true
  },

  // Perimeter Floodlight Towers
  {
    id: 'floodlight-ne',
    label: 'Perimeter Floodlight',
    type: 'circle',
    x: 4.6,
    z: -3.8,
    radius: 0.25,
    topY: 0.55,
    jumpable: true
  },
  {
    id: 'floodlight-nw',
    label: 'Perimeter Floodlight',
    type: 'circle',
    x: -4.6,
    z: -3.8,
    radius: 0.25,
    topY: 0.55,
    jumpable: true
  },
  {
    id: 'floodlight-sw',
    label: 'Perimeter Floodlight',
    type: 'circle',
    x: -4.8,
    z: 3.6,
    radius: 0.25,
    topY: 0.55,
    jumpable: true
  },
  {
    id: 'floodlight-se',
    label: 'Perimeter Floodlight',
    type: 'circle',
    x: 4.8,
    z: 3.6,
    radius: 0.25,
    topY: 0.55,
    jumpable: true
  },

  // 4. Central Outpost Geological Boulders & Crater Rims
  {
    id: 'boulder-1',
    label: 'Martian Basalt Boulder',
    type: 'circle',
    x: -7.5,
    z: -3.2,
    radius: 0.68,
    topY: 0.18,
    jumpable: true
  },
  {
    id: 'boulder-2',
    label: 'Martian Basalt Boulder',
    type: 'circle',
    x: -6.8,
    z: -2.1,
    radius: 0.48,
    topY: 0.05,
    jumpable: true
  },
  {
    id: 'boulder-3',
    label: 'Iron-Rich Outcrop',
    type: 'circle',
    x: [6.2][0],
    z: -4.5,
    radius: 0.88,
    topY: 0.35,
    jumpable: true
  },
  {
    id: 'boulder-4',
    label: 'Martian Basalt Boulder',
    type: 'circle',
    x: 8.1,
    z: -1.8,
    radius: 0.56,
    topY: 0.08,
    jumpable: true
  },
  {
    id: 'boulder-5',
    label: 'Regolith Rock Formation',
    type: 'circle',
    x: -4.2,
    z: 6.5,
    radius: 0.76,
    topY: 0.22,
    jumpable: true
  },
  {
    id: 'boulder-6',
    label: 'Regolith Rock Formation',
    type: 'circle',
    x: 3.5,
    z: 7.2,
    radius: 0.58,
    topY: 0.12,
    jumpable: true
  },
  {
    id: 'crater-rim-ne',
    label: 'Impact Crater Rim',
    type: 'ring',
    x: 6.5,
    z: -4.8,
    innerRadius: 1.95,
    outerRadius: 2.45,
    topY: -0.08,
    jumpable: true
  },
  {
    id: 'crater-rim-sw',
    label: 'Impact Crater Rim',
    type: 'ring',
    x: -6.2,
    z: 5.0,
    innerRadius: 1.32,
    outerRadius: 1.68,
    topY: -0.12,
    jumpable: true
  },

  // 5. Biome Radar Beacons & Monoliths
  {
    id: 'beacon-north',
    label: 'Jezero Radar Beacon',
    type: 'circle',
    x: 0,
    z: -65,
    radius: 1.35,
    topY: 0.35,
    jumpable: true
  },
  {
    id: 'beacon-east',
    label: 'Valles Mineral Beacon',
    type: 'circle',
    x: 70,
    z: 0,
    radius: 1.35,
    topY: 0.35,
    jumpable: true
  },
  {
    id: 'beacon-south',
    label: 'Dune Sea Relay Beacon',
    type: 'circle',
    x: 0,
    z: 70,
    radius: 1.35,
    topY: 0.35,
    jumpable: true
  },
  {
    id: 'mesa-west',
    label: 'Observation Lookout Mesa',
    type: 'circle',
    x: -70,
    z: 0,
    radius: 15.2,
    topY: 0.82,
    jumpable: true
  },
  ...ADDITIVE_OUTER_COLLIDERS.map((collider) => ({
    id: collider.id,
    label: `${collider.regionId} ${collider.kind}`,
    type: 'circle' as const,
    x: collider.x,
    z: collider.z,
    radius: collider.radius,
    topY: sampleWorldGround(collider.x, collider.z) + 3.4,
    jumpable: false
  })),
  // The authored legacy rover remains parked at this original scene location.
  {
    id: 'legacy-mars-rover-exhibit',
    label: 'Mars Exploration Rover Exhibit',
    type: 'circle',
    x: 3.8,
    z: -2.2,
    radius: 0.95,
    topY: 0.38,
    jumpable: true
  },
  ...buildOuterPhysicsAdapter(),
  ...WORLD_REGIONS.map((region) => ({
    id: `${region.id}-base-console`,
    label: `${region.name} Console`,
    type: 'box' as const,
    x: region.baseConsole.x,
    z: region.baseConsole.z,
    halfX: 0.96,
    halfZ: 0.96,
    topY: sampleWorldGround(region.baseConsole.x, region.baseConsole.z) + 1.72,
    jumpable: true
  }))
];

/**
 * Returns full list of active colliders, including dynamic parked Rover when player is on foot.
 */
export function buildWorldColliders(
  roverPos?: [number, number, number],
  isDrivingRover = false
): ObstacleCollider[] {
  if (!roverPos || isDrivingRover) {
    return STATIC_WORLD_COLLIDERS;
  }
  return [
    ...STATIC_WORLD_COLLIDERS,
    {
      id: 'parked-mars-rover',
      label: 'Mars Exploration Rover',
      type: 'circle',
      x: roverPos[0],
      z: roverPos[2],
      radius: PARKED_ROVER_COLLIDER_RADIUS,
      topY: roverPos[1] + PARKED_ROVER_COLLIDER_TOP_OFFSET,
      jumpable: true
    }
  ];
}

export function canRoverOccupy(
  x: number,
  z: number,
  radius: number = PHYSICS_CONSTANTS.ROVER_RADIUS
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(radius) || radius < 0) return false;
  if (x < WORLD_BOUNDS.minX + radius || x > WORLD_BOUNDS.maxX - radius ||
      z < WORLD_BOUNDS.minZ + radius || z > WORLD_BOUNDS.maxZ - radius) return false;
  const groundY = sampleWorldGround(x, z);
  return STATIC_WORLD_COLLIDERS.every((collider) =>
    !resolveHorizontalCollider(x, z, x, z, groundY, radius, collider).collided
  );
}

function isPointInOpening(x: number, z: number, openings?: RingOpening[]): boolean {
  if (!openings || openings.length === 0) return false;
  for (let i = 0; i < openings.length; i++) {
    const op = openings[i];
    if (x >= op.minX && x <= op.maxX && z >= op.minZ && z <= op.maxZ) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if horizontal point (x, z) is on top of a collider's surface footprint.
 */
export function isOverColliderFootprint(
  x: number,
  z: number,
  collider: ObstacleCollider,
  margin = 0.18
): boolean {
  if (collider.type === 'circle') {
    const dist = Math.hypot(x - collider.x, z - collider.z);
    return dist <= collider.radius + margin;
  }

  if (collider.type === 'box') {
    const dx = x - collider.x;
    const dz = z - collider.z;
    const rot = collider.rotationY || 0;
    const cos = Math.cos(-rot);
    const sin = Math.sin(-rot);
    const localX = dx * cos - dz * sin;
    const localZ = dx * sin + dz * cos;
    return (
      Math.abs(localX) <= collider.halfX + margin &&
      Math.abs(localZ) <= collider.halfZ + margin
    );
  }

  if (collider.type === 'ring') {
    if (isPointInOpening(x, z, collider.openings)) return false;
    const dist = Math.hypot(x - collider.x, z - collider.z);
    return (
      dist >= collider.innerRadius - margin &&
      dist <= collider.outerRadius + margin
    );
  }

  return false;
}

/**
 * Resolves 2D horizontal penetration (X, Z) against a single collider with smooth tangent sliding.
 */
function resolveHorizontalCollider(
  prevX: number,
  prevZ: number,
  targetX: number,
  targetZ: number,
  playerY: number,
  playerRadius: number,
  collider: ObstacleCollider
): { x: number; z: number; collided: boolean } {
  // If the player has jumped high enough to clear the obstacle's top surface, no horizontal block!
  if (playerY >= collider.topY - PHYSICS_CONSTANTS.STEP_UP_TOLERANCE) {
    return { x: targetX, z: targetZ, collided: false };
  }

  if (collider.type === 'circle') {
    const dx = targetX - collider.x;
    const dz = targetZ - collider.z;
    const dist = Math.hypot(dx, dz);
    const minDist = collider.radius + playerRadius;

    if (dist < minDist) {
      const nx = dist > 0.0001 ? dx / dist : 1;
      const nz = dist > 0.0001 ? dz / dist : 0;
      return {
        x: collider.x + nx * minDist,
        z: collider.z + nz * minDist,
        collided: true
      };
    }
    return { x: targetX, z: targetZ, collided: false };
  }

  if (collider.type === 'box') {
    const dx = targetX - collider.x;
    const dz = targetZ - collider.z;
    const rot = collider.rotationY || 0;
    const cos = Math.cos(-rot);
    const sin = Math.sin(-rot);

    // Transform into box local coordinates
    let lx = dx * cos - dz * sin;
    let lz = dx * sin + dz * cos;

    const clampedX = Math.max(-collider.halfX, Math.min(collider.halfX, lx));
    const clampedZ = Math.max(-collider.halfZ, Math.min(collider.halfZ, lz));

    const diffX = lx - clampedX;
    const diffZ = lz - clampedZ;
    const dist = Math.hypot(diffX, diffZ);

    if (dist < playerRadius) {
      if (dist > 0.0001) {
        const nx = diffX / dist;
        const nz = diffZ / dist;
        lx = clampedX + nx * playerRadius;
        lz = clampedZ + nz * playerRadius;
      } else {
        // Center is inside box: push out toward nearest edge
        const penX = collider.halfX + playerRadius - Math.abs(lx);
        const penZ = collider.halfZ + playerRadius - Math.abs(lz);
        if (penX < penZ) {
          lx = lx >= 0 ? collider.halfX + playerRadius : -(collider.halfX + playerRadius);
        } else {
          lz = lz >= 0 ? collider.halfZ + playerRadius : -(collider.halfZ + playerRadius);
        }
      }

      // Rotate back to world coordinates
      const cosBack = Math.cos(rot);
      const sinBack = Math.sin(rot);
      return {
        x: collider.x + (lx * cosBack - lz * sinBack),
        z: collider.z + (lx * sinBack + lz * cosBack),
        collided: true
      };
    }
    return { x: targetX, z: targetZ, collided: false };
  }

  if (collider.type === 'ring') {
    if (isPointInOpening(targetX, targetZ, collider.openings)) {
      return { x: targetX, z: targetZ, collided: false };
    }

    const dx = targetX - collider.x;
    const dz = targetZ - collider.z;
    const dist = Math.hypot(dx, dz);
    const minBand = collider.innerRadius - playerRadius;
    const maxBand = collider.outerRadius + playerRadius;

    if (dist > minBand && dist < maxBand) {
      const prevDist = Math.hypot(prevX - collider.x, prevZ - collider.z);
      const midRadius = (collider.innerRadius + collider.outerRadius) * 0.5;
      const nx = dist > 0.0001 ? dx / dist : 1;
      const nz = dist > 0.0001 ? dz / dist : 0;

      // Push back toward whichever side of the ring wall the player came from
      const resolvedRadius = prevDist <= midRadius ? minBand : maxBand;
      return {
        x: collider.x + nx * resolvedRadius,
        z: collider.z + nz * resolvedRadius,
        collided: true
      };
    }
    return { x: targetX, z: targetZ, collided: false };
  }

  return { x: targetX, z: targetZ, collided: false };
}

/**
 * Advances player physics by one frame step (`dt`).
 * Handles jump initiation, Martian gravity integration, horizontal collision blocking + sliding,
 * and landing on top of jumpable obstacles or the Martian ground.
 */
export function stepPlayerPhysics(
  state: PhysicsState,
  input: PhysicsInput,
  colliders: ObstacleCollider[] = STATIC_WORLD_COLLIDERS,
  playerRadius: number = PHYSICS_CONSTANTS.PLAYER_RADIUS
): PhysicsState {
  const dt = Math.min(Math.max(input.dt, 0), PHYSICS_CONSTANTS.MAX_DT);

  let y = state.y;
  let vy = state.vy;
  let isGrounded = state.isGrounded;
  let airJumpsLeft = state.airJumpsLeft ?? PHYSICS_CONSTANTS.MAX_AIR_JUMPS;
  let coyoteTimer = state.coyoteTimer ?? (isGrounded ? PHYSICS_CONSTANTS.COYOTE_TIME : 0);
  let jumpBufferTimer = state.jumpBufferTimer ?? 0;
  let didDoubleJump = false;

  if (isGrounded) {
    coyoteTimer = PHYSICS_CONSTANTS.COYOTE_TIME;
    airJumpsLeft = PHYSICS_CONSTANTS.MAX_AIR_JUMPS;
  } else {
    coyoteTimer = Math.max(0, coyoteTimer - dt);
  }

  if (input.jumpJustPressed) {
    jumpBufferTimer = PHYSICS_CONSTANTS.JUMP_BUFFER_TIME;
  } else {
    jumpBufferTimer = Math.max(0, jumpBufferTimer - dt);
  }

  // 1. Trigger Ground Jump (with Coyote Time & Jump Buffer) OR Mid-Air EVA Jetpack Double-Jump
  if (jumpBufferTimer > 0 && (isGrounded || coyoteTimer > 0)) {
    vy = PHYSICS_CONSTANTS.JUMP_VELOCITY;
    isGrounded = false;
    coyoteTimer = 0;
    jumpBufferTimer = 0;
  } else if (input.jumpJustPressed && !isGrounded && airJumpsLeft > 0) {
    vy = PHYSICS_CONSTANTS.DOUBLE_JUMP_VELOCITY;
    airJumpsLeft -= 1;
    jumpBufferTimer = 0;
    didDoubleJump = true;
  }

  // 2. Integrate Vertical Kinematics (Martian Gravity)
  const prevY = y;
  if (!isGrounded || vy > 0) {
    y += vy * dt;
    vy -= PHYSICS_CONSTANTS.MARS_GRAVITY * dt;
  }

  // 3. Horizontal Velocity & Smooth Inertia (when enabled) + Multi-Pass Obstacle Collision Resolution
  let vx = state.vx ?? input.moveX;
  let vz = state.vz ?? input.moveZ;

  if (input.useSmoothInertia) {
    const hasInput = Math.hypot(input.moveX, input.moveZ) > 0.05;
    const accelRate = isGrounded ? (hasInput ? 22.0 : 16.0) : hasInput ? 13.0 : 5.0;
    const blend = Math.min(1, accelRate * dt);
    vx = vx + (input.moveX - vx) * blend;
    vz = vz + (input.moveZ - vz) * blend;
    if (!hasInput && Math.hypot(vx, vz) < 0.04) {
      vx = 0;
      vz = 0;
    }
  } else {
    vx = input.moveX;
    vz = input.moveZ;
  }

  let targetX = state.x + vx * dt;
  let targetZ = state.z + vz * dt;

  let isBlocked = false;
  let blockedByLabel: string | null = null;
  let blockedObstacleJumpable = false;

  // Run 2 solver passes to cleanly handle corners between multiple obstacles
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < colliders.length; i++) {
      const col = colliders[i];
      const res = resolveHorizontalCollider(
        state.x,
        state.z,
        targetX,
        targetZ,
        y,
        playerRadius,
        col
      );
      if (res.collided) {
        targetX = res.x;
        targetZ = res.z;
        isBlocked = true;
        blockedByLabel = col.label;
        blockedObstacleJumpable = col.jumpable;
      }
    }
  }

  // Recompute actual horizontal velocity after collision sliding
  if (dt > 0.0001 && isBlocked) {
    vx = (targetX - state.x) / dt;
    vz = (targetZ - state.z) / dt;
  }

  // 4. Clamp to finite world bounds without wrapping or teleporting.
  const boundedX = Math.max(WORLD_BOUNDS.minX + playerRadius, Math.min(WORLD_BOUNDS.maxX - playerRadius, targetX));
  const boundedZ = Math.max(WORLD_BOUNDS.minZ + playerRadius, Math.min(WORLD_BOUNDS.maxZ - playerRadius, targetZ));
  const hitXBoundary = boundedX !== targetX;
  const hitZBoundary = boundedZ !== targetZ;
  if (hitXBoundary || hitZBoundary) {
    targetX = boundedX;
    targetZ = boundedZ;
    isBlocked = true;
    blockedByLabel = 'World Boundary';
    blockedObstacleJumpable = false;
    if (hitXBoundary) vx = 0;
    if (hitZBoundary) vz = 0;
  }

  // 5. Support Surface / Platform Landing Check
  let supportY: number = sampleWorldGround(targetX, targetZ);
  let supportLabel: string | null = null;

  for (let i = 0; i < colliders.length; i++) {
    const col = colliders[i];
    if (isOverColliderFootprint(targetX, targetZ, col, playerRadius * 0.6)) {
      const wasAboveTop =
        prevY >= col.topY - PHYSICS_CONSTANTS.STEP_UP_TOLERANCE ||
        y >= col.topY - PHYSICS_CONSTANTS.STEP_UP_TOLERANCE;
      if (wasAboveTop && col.topY > supportY) {
        supportY = col.topY;
        supportLabel = col.label;
      }
    }
  }

  // Land on support surface when descending onto it, or fall when walking off a ledge
  if (y <= supportY && vy <= 0) {
    y = supportY;
    vy = 0;
    isGrounded = true;
    airJumpsLeft = PHYSICS_CONSTANTS.MAX_AIR_JUMPS;
    coyoteTimer = PHYSICS_CONSTANTS.COYOTE_TIME;
  } else if (y > supportY) {
    isGrounded = false;
    supportLabel = null;
  }

  return {
    x: targetX,
    y,
    z: targetZ,
    vx,
    vy,
    vz,
    isGrounded,
    isBlocked,
    blockedByLabel,
    blockedObstacleJumpable,
    standingOnLabel: isGrounded ? supportLabel : null,
    airJumpsLeft,
    coyoteTimer,
    jumpBufferTimer,
    didDoubleJump
  };
}
