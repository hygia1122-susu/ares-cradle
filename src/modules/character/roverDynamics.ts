/** Deterministic ground-vehicle model. Heading 0 faces +Z; positive steering means screen-right. */
export interface RoverPose {
  x: number;
  y: number;
  z: number;
  heading: number;
}
export interface RoverSuspensionTravel {
  frontLeft: number; frontRight: number;
  middleLeft: number; middleRight: number;
  rearLeft: number; rearRight: number;
}
export interface RoverState extends RoverPose {
  longitudinalVelocity: number;
  lateralVelocity: number;
  /** Front-wheel angle in radians; positive steering is right relative to the watch camera. */
  steeringAngle: number;
  /** Cumulative signed forward wheel distance accepted by collision/bounds checks. */
  acceptedWheelTravel: number;
  groundPitch: number;
  groundRoll: number;
  /** Six-wheel support offsets from the chassis ground pivot, clamped to suspension travel. */
  suspensionTravel: RoverSuspensionTravel;
}
export interface RoverInput {
  throttle: number;
  /** Positive steers to the watch-camera's screen right. */
  steer: number;
  dt: number;
  paused?: boolean;
}
export interface RoverEnvironment {
  sampleGround?: (x: number, z: number) => number;
  canOccupy?: (x: number, z: number, radius: number) => boolean;
  bounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
  radius?: number;
  wheelbase?: number;
  trackWidth?: number;
  regionCenter?: { x: number; z: number };
  regionRadius?: number;
}
const GROUND_Y = -0.4;
const MAX_STEERING = 0.42;
const MAX_FORWARD_SPEED = 5;
const MAX_REVERSE_SPEED = 3;
const ACCELERATION = 45;
const BRAKING = 35;
const DEFAULT_WHEELBASE = 1.7;
const DEFAULT_TRACK_WIDTH = 1.4;
const DEFAULT_RADIUS = 0.92;
const MAX_DT = 0.1;
const SUBSTEP = 1 / 120;
const BOUNDS = { minX: -300, maxX: 300, minZ: -300, maxZ: 300 };
const ZERO_SUSPENSION: RoverSuspensionTravel = {
  frontLeft: 0, frontRight: 0,
  middleLeft: 0, middleRight: 0,
  rearLeft: 0, rearRight: 0
};
const finite = (value: number, fallback: number): number => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const moveToward = (value: number, target: number, amount: number): number =>
  Math.abs(target - value) <= amount ? target : value + Math.sign(target - value) * amount;
const wrapHeading = (heading: number): number => Math.atan2(Math.sin(heading), Math.cos(heading));
export function initialRoverState(pose: RoverPose): RoverState {
  return {
    x: clamp(finite(pose.x, 0), BOUNDS.minX + DEFAULT_RADIUS, BOUNDS.maxX - DEFAULT_RADIUS),
    y: clamp(finite(pose.y, GROUND_Y), -100, 100),
    z: clamp(finite(pose.z, 0), BOUNDS.minZ + DEFAULT_RADIUS, BOUNDS.maxZ - DEFAULT_RADIUS),
    heading: wrapHeading(finite(pose.heading, 0)),
    longitudinalVelocity: 0,
    lateralVelocity: 0,
    steeringAngle: 0,
    acceptedWheelTravel: 0,
    groundPitch: 0,
    groundRoll: 0,
    suspensionTravel: { ...ZERO_SUSPENSION }
  };
}
function supportState(state: RoverState, environment: RoverEnvironment, wheelbase: number, trackWidth: number): RoverState {
  const sample = environment.sampleGround ?? (() => GROUND_Y);
  const forwardX = Math.sin(state.heading);
  const forwardZ = Math.cos(state.heading);
  const rightX = Math.cos(state.heading);
  const rightZ = -Math.sin(state.heading);
  const at = (longitudinal: number, lateral: number): number => {
    const y = sample(state.x + forwardX * longitudinal + rightX * lateral,
      state.z + forwardZ * longitudinal + rightZ * lateral);
    return clamp(finite(y, GROUND_Y), -100, 100);
  };
  const halfWheelbase = wheelbase / 2;
  const halfTrack = trackWidth / 2;
  const heights: RoverSuspensionTravel = {
    frontLeft: at(halfWheelbase, -halfTrack),
    frontRight: at(halfWheelbase, halfTrack),
    middleLeft: at(0, -halfTrack),
    middleRight: at(0, halfTrack),
    rearLeft: at(-halfWheelbase, -halfTrack),
    rearRight: at(-halfWheelbase, halfTrack)
  };
  const left = (heights.frontLeft + heights.middleLeft + heights.rearLeft) / 3;
  const right = (heights.frontRight + heights.middleRight + heights.rearRight) / 3;
  const front = (heights.frontLeft + heights.frontRight) / 2;
  const rear = (heights.rearLeft + heights.rearRight) / 2;
  const y = (front + rear + heights.middleLeft + heights.middleRight) / 4;
  const flatAtAuthoredRest = state.longitudinalVelocity === 0 && Math.abs(y - GROUND_Y) < 1e-9 &&
    Math.abs(heights.frontLeft - y) < 1e-9 && Math.abs(heights.frontRight - y) < 1e-9 &&
    Math.abs(heights.middleLeft - y) < 1e-9 && Math.abs(heights.middleRight - y) < 1e-9 &&
    Math.abs(heights.rearLeft - y) < 1e-9 && Math.abs(heights.rearRight - y) < 1e-9;
  const adjustedY = flatAtAuthoredRest ? state.y : y;
  const suspensionTravel = { ...ZERO_SUSPENSION };
  for (const wheel of Object.keys(heights) as (keyof RoverSuspensionTravel)[]) {
    suspensionTravel[wheel] = clamp(heights[wheel] - y, -0.25, 0.25);
  }
  return {
    ...state,
    y: adjustedY,
    groundPitch: clamp(Math.atan2(front - rear, wheelbase), -0.6, 0.6),
    groundRoll: clamp(Math.atan2(right - left, trackWidth), -0.6, 0.6),
    suspensionTravel
  };
}
/** Advance one bounded substep frame with immediate opposing throttle and strong release braking. */
export function stepRoverDynamics(
  state: RoverState,
  input: RoverInput,
  environment: RoverEnvironment = {}
): RoverState {
  const suspensionTravel = { ...ZERO_SUSPENSION };
  for (const wheel of Object.keys(suspensionTravel) as (keyof RoverSuspensionTravel)[]) {
    suspensionTravel[wheel] = clamp(finite(state.suspensionTravel?.[wheel], 0), -0.25, 0.25);
  }
  const current: RoverState = {
    ...state,
    x: clamp(finite(state.x, 0), BOUNDS.minX, BOUNDS.maxX),
    y: clamp(finite(state.y, GROUND_Y), -100, 100),
    z: clamp(finite(state.z, 0), BOUNDS.minZ, BOUNDS.maxZ),
    heading: wrapHeading(finite(state.heading, 0)),
    longitudinalVelocity: clamp(finite(state.longitudinalVelocity, 0), -MAX_REVERSE_SPEED, MAX_FORWARD_SPEED),
    lateralVelocity: 0,
    steeringAngle: clamp(finite(state.steeringAngle, 0), -MAX_STEERING, MAX_STEERING),
    acceptedWheelTravel: clamp(finite(state.acceptedWheelTravel, 0), -1e12, 1e12),
    groundPitch: clamp(finite(state.groundPitch, 0), -0.6, 0.6),
    groundRoll: clamp(finite(state.groundRoll, 0), -0.6, 0.6),
    suspensionTravel
  };
  const rawDt = finite(input.dt, 0);
  const dt = clamp(rawDt, 0, MAX_DT);
  if (input.paused || dt === 0) return current;
  const throttle = clamp(finite(input.throttle, 0), -1, 1);
  const steer = clamp(finite(input.steer, 0), -1, 1);
  const wheelbase = Math.max(0.5, finite(environment.wheelbase ?? DEFAULT_WHEELBASE, DEFAULT_WHEELBASE));
  const trackWidth = Math.max(0.5, finite(environment.trackWidth ?? DEFAULT_TRACK_WIDTH, DEFAULT_TRACK_WIDTH));
  const radius = Math.max(0, finite(environment.radius ?? DEFAULT_RADIUS, DEFAULT_RADIUS));
  const bounds = environment.bounds ?? BOUNDS;
  const minX = finite(bounds.minX, BOUNDS.minX);
  const maxX = finite(bounds.maxX, BOUNDS.maxX);
  const minZ = finite(bounds.minZ, BOUNDS.minZ);
  const maxZ = finite(bounds.maxZ, BOUNDS.maxZ);
  const regionCenter = environment.regionCenter;
  const regionRadius = Math.max(0, environment.regionRadius ?? Infinity);
  const insideRegion = (x: number, z: number): boolean => !regionCenter ||
    Math.hypot(x - regionCenter.x, z - regionCenter.z) <= regionRadius;
  let x = current.x;
  let z = current.z;
  let heading = current.heading;
  let longitudinalVelocity = current.longitudinalVelocity;
  let acceptedWheelTravel = current.acceptedWheelTravel;
  let steeringAngle = current.steeringAngle;
  const steps = Math.ceil(dt / SUBSTEP);
  const stepDt = dt / steps;
  for (let i = 0; i < steps; i++) {
    const oldHeading = heading;
    steeringAngle = moveToward(steeringAngle, steer * MAX_STEERING, 12 * stepDt);
    const targetSpeed = throttle > 0 ? throttle * MAX_FORWARD_SPEED : throttle * MAX_REVERSE_SPEED;
    if (throttle === 0) {
      longitudinalVelocity = moveToward(longitudinalVelocity, 0, BRAKING * stepDt);
    } else if (longitudinalVelocity === 0 || Math.sign(targetSpeed) !== Math.sign(longitudinalVelocity)) {
      longitudinalVelocity = targetSpeed;
    } else {
      longitudinalVelocity = moveToward(longitudinalVelocity, targetSpeed, ACCELERATION * stepDt);
    }
    longitudinalVelocity = clamp(longitudinalVelocity, -MAX_REVERSE_SPEED, MAX_FORWARD_SPEED);
    const yawRate = -longitudinalVelocity * Math.tan(steeringAngle) / wheelbase;
    heading = wrapHeading(heading + yawRate * stepDt);
    const averageHeading = wrapHeading(oldHeading + wrapHeading(heading - oldHeading) / 2);
    const forwardX = Math.sin(averageHeading);
    const forwardZ = Math.cos(averageHeading);
    const nextX = x + forwardX * longitudinalVelocity * stepDt;
    const nextZ = z + forwardZ * longitudinalVelocity * stepDt;
    const insideBounds = nextX >= minX + radius && nextX <= maxX - radius &&
      nextZ >= minZ + radius && nextZ <= maxZ - radius && insideRegion(nextX, nextZ);
    const occupiable = insideBounds && (environment.canOccupy?.(nextX, nextZ, radius) ?? true);
    if (!occupiable) {
      longitudinalVelocity = 0;
      heading = oldHeading;
      break;
    }
    acceptedWheelTravel = clamp(
      acceptedWheelTravel + Math.hypot(nextX - x, nextZ - z) * Math.sign(longitudinalVelocity),
      -1e12, 1e12
    );
    x = nextX;
    z = nextZ;
  }
  return supportState({
    ...current, x, z, heading, longitudinalVelocity, lateralVelocity: 0, steeringAngle, acceptedWheelTravel
  }, environment, wheelbase, trackWidth);
}
