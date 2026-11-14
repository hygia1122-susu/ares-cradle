import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RealRoverCraft } from '../../game/art/realism/RealRoverCraft';
import { getSuspensionAngles, getWheelRotation } from '../../game/art/realism/roverMotion';
import { canRoverOccupy } from '../character/physicsEngine';
import { initialRoverState, stepRoverDynamics, type RoverState } from '../character/roverDynamics';
import { useOutpostStore, PLAYABLE_ROVER_SPEC } from '../store/useOutpostStore';
import { sampleWorldGround, WORLD_BOUNDS, WORLD_REGIONS, type RegionId } from './worldRegions';

const RADIUS = PLAYABLE_ROVER_SPEC.radius;
const SCALE = PLAYABLE_ROVER_SPEC.scale;
const MAX_REGION_RADIUS = 75;
type KeyState = Record<string, boolean>;
type WheelAxle = 'front' | 'middle' | 'rear';
type CachedWheel = {
  regionId: RegionId; knuckle: THREE.Group; rollingWheel: THREE.Group; axle: WheelAxle; side: number;
  restKnuckleY: number; residual: number;
};
type CachedSuspensionSide = {
  regionId: RegionId; side: -1 | 1; group: THREE.Group; bogie: THREE.Group;
  restGroupY: number; restBogieY: number; wheels: Partial<Record<WheelAxle, CachedWheel>>;
};
type RegionalRoverPose = { position: [number, number, number]; heading: number };

function suspensionResidual(raw: number, longitudinal: number, lateral: number, pitch: number, roll: number): number {
  return raw - longitudinal * Math.tan(pitch) - lateral * Math.tan(roll);
}

function suspensionAngles(front: number, middle: number, rear: number) {
  const rockerDelta = front - (middle + rear) / 2;
  const bogieDelta = middle - rear;
  const rocker = rockerDelta === 0 ? 0 : -Math.atan(rockerDelta / 1.5);
  const bogie = bogieDelta === 0 ? 0 : -Math.atan(bogieDelta / 0.9);
  return getSuspensionAngles([rocker, rocker], [bogie, bogie]);
}

function modalBlocksDriving(): boolean {
  const outpost = useOutpostStore.getState();
  return document.hidden || outpost.isManualOpen || outpost.activeScienceEntryId !== null || outpost.isBackpackOpen ||
    outpost.isGameOver || outpost.isVictory || !outpost.isSimulating ||
    Boolean(document.querySelector('[role="dialog"]'));
}

function storedPose(regionId: RegionId, poses: Partial<Record<RegionId, RegionalRoverPose>>): RegionalRoverPose {
  const pose = poses[regionId];
  if (pose && pose.position.every(Number.isFinite) && Number.isFinite(pose.heading)) return pose;
  const region = WORLD_REGIONS.find((candidate) => candidate.id === regionId)!;
  return { position: [region.safeParking.x, sampleWorldGround(region.safeParking.x, region.safeParking.z), region.safeParking.z], heading: 0 };
}

export function PlayableWatchRover() {
  const dynamics = useRef<RoverState | null>(null);
  const previousRemoteRegion = useRef<RegionId | null>(null);
  const keys = useRef<KeyState>({});
  const focused = useRef(true);
  const steeringWheels = useRef<CachedWheel[]>([]);
  const rollingWheels = useRef<CachedWheel[]>([]);
  const suspensionSides = useRef<CachedSuspensionSide[]>([]);
  const pausedLastFrame = useRef(false);
  const regionalRoots = useMemo(() => new Map<RegionId, { current: THREE.Group | null }>(
    WORLD_REGIONS.map(({ id }) => [id, { current: null }] as const)
  ), []);
  const regionalModels = useMemo(() => new Map<RegionId, { current: THREE.Group | null }>(
    WORLD_REGIONS.map(({ id }) => [id, { current: null }] as const)
  ), []);
  const lightTargets = useMemo(() => new Map<RegionId, [THREE.Object3D, THREE.Object3D]>(
    WORLD_REGIONS.map(({ id }) => [id, [new THREE.Object3D(), new THREE.Object3D()]] as const)
  ), []);
  const roverHeadlightMode = useOutpostStore((state) => state.roverHeadlightMode);

  useEffect(() => {
    const clearInput = () => {
      keys.current = {};
      focused.current = false;
      const current = useOutpostStore.getState();
      if (current.isMouseDriving) current.setIsMouseDriving(false);
      if (current.joystickVector.x || current.joystickVector.y) current.setJoystickVector({ x: 0, y: 0 });
      if (dynamics.current) {
        dynamics.current.longitudinalVelocity = 0;
        dynamics.current.lateralVelocity = 0;
        dynamics.current.steeringAngle = 0;
      }
    };
    const onFocus = () => { focused.current = true; };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('input,textarea,select,button,[role="dialog"]')) return;
      const store = useOutpostStore.getState();
      if (event.code === 'KeyR' && !event.repeat && !modalBlocksDriving()) {
        store.toggleDrivingRover();
        return;
      }
      if (!store.isDrivingRover) return;
      if (event.code === 'Space') { event.preventDefault(); return; }
      if (modalBlocksDriving()) { keys.current = {}; return; }
      if (['KeyW', 'ArrowUp', 'KeyS', 'ArrowDown', 'KeyA', 'ArrowLeft', 'KeyD', 'ArrowRight'].includes(event.code)) {
        keys.current[event.code] = true;
        if (event.code.startsWith('Arrow')) event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => { keys.current[event.code] = false; };
    const onVisibility = () => { if (document.hidden) clearInput(); else onFocus(); };
    window.addEventListener('blur', clearInput);
    window.addEventListener('focus', onFocus);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', clearInput);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useLayoutEffect(() => {
    const steering: CachedWheel[] = [];
    const rolling: CachedWheel[] = [];
    const sides: CachedSuspensionSide[] = [];
    const scratch = new THREE.Vector3();
    for (const region of WORLD_REGIONS) {
      const model = regionalModels.get(region.id)?.current;
      if (!model) continue;
      model.updateWorldMatrix(true, true);
      const front: Array<{ z: number; knuckle: THREE.Group }> = [];
      const regionWheels: CachedWheel[] = [];
      const regionSides: CachedSuspensionSide[] = [];
      model.traverse((object) => {
        if (!(object instanceof THREE.Group)) return;
        if (object.name === 'suspension-minus-x' || object.name === 'suspension-plus-x') {
          const bogie = object.getObjectByName('bogie-pivot');
          if (bogie instanceof THREE.Group) regionSides.push({
            regionId: region.id, side: object.name === 'suspension-minus-x' ? -1 : 1,
            group: object, bogie, restGroupY: object.position.y, restBogieY: bogie.position.y, wheels: {},
          });
        }
        if (object.name !== 'steering-knuckle') return;
        const wheel = object.getObjectByName('rolling-wheel');
        if (!(wheel instanceof THREE.Group)) return;
        object.getWorldPosition(scratch);
        model.worldToLocal(scratch);
        const axle: WheelAxle = scratch.z > 0.6 ? 'front' : scratch.z > -0.15 ? 'middle' : 'rear';
        const side = scratch.x < 0 ? -1 : 1;
        const cached: CachedWheel = { regionId: region.id, knuckle: object, rollingWheel: wheel, axle, side, restKnuckleY: object.position.y, residual: 0 };
        regionWheels.push(cached);
        regionSides.find((entry) => entry.side === side)!.wheels[axle] = cached;
        if (axle === 'front') front.push({ z: scratch.z, knuckle: object });
      });
      front.sort((a, b) => b.z - a.z);
      steering.push(...front.map(({ knuckle }) => regionWheels.find((wheel) => wheel.knuckle === knuckle)!));
      rolling.push(...regionWheels);
      sides.push(...regionSides);
    }
    steeringWheels.current = steering;
    rollingWheels.current = rolling;
    suspensionSides.current = sides;
  }, [regionalModels]);

  useFrame((_, delta) => {
    const store = useOutpostStore.getState();
    const remoteRegionId = (store.remoteRegionId ?? null) as RegionId | null;
    if (remoteRegionId !== previousRemoteRegion.current) {
      previousRemoteRegion.current = remoteRegionId;
      keys.current = {};
      const pose = remoteRegionId ? storedPose(remoteRegionId, store.regionalRoverPoses ?? {}) : null;
      dynamics.current = remoteRegionId ? initialRoverState({
        x: store.roverPos?.[0] ?? pose!.position[0],
        y: store.roverPos?.[1] ?? pose!.position[1],
        z: store.roverPos?.[2] ?? pose!.position[2],
        heading: store.roverHeading ?? pose!.heading,
      }) : null;
      pausedLastFrame.current = false;
    }
    for (const region of WORLD_REGIONS) {
      const group = regionalRoots.get(region.id)?.current;
      if (!group) continue;
      if (remoteRegionId === region.id && dynamics.current) continue;
      const pose = storedPose(region.id, store.regionalRoverPoses ?? {});
      group.position.set(...pose.position);
      group.rotation.set(0, pose.heading, 0);
    }

    if (!remoteRegionId || !store.isDrivingRover || !dynamics.current) return;
    const current = dynamics.current;
    const modalPaused = modalBlocksDriving() || !focused.current || document.hidden;
    if (modalPaused) {
      keys.current = {};
      if (store.isMouseDriving) store.setIsMouseDriving(false);
      if (store.joystickVector.x || store.joystickVector.y) store.setJoystickVector({ x: 0, y: 0 });
      current.longitudinalVelocity = 0;
      current.lateralVelocity = 0;
      current.steeringAngle = 0;
      dynamics.current = stepRoverDynamics(current, { throttle: 0, steer: 0, dt: 0, paused: true }, {});
      if (!pausedLastFrame.current && store.roverSpeed !== 0) store.publishRoverState(current, 0);
      pausedLastFrame.current = true;
    } else {
      pausedLastFrame.current = false;
      const held = keys.current;
      const throttle = Number(Boolean(held.KeyW || held.ArrowUp)) + Number(store.isMouseDriving) -
        Number(Boolean(held.KeyS || held.ArrowDown)) - store.joystickVector.y;
      const steer = Number(Boolean(held.KeyD || held.ArrowRight)) - Number(Boolean(held.KeyA || held.ArrowLeft)) +
        store.joystickVector.x;
      const region = WORLD_REGIONS.find((candidate) => candidate.id === remoteRegionId)!;
      const dt = Number.isFinite(delta) ? Math.max(0, Math.min(delta, 0.1)) : 0;
      dynamics.current = stepRoverDynamics(current, {
        throttle: Math.max(-1, Math.min(1, throttle)),
        steer: Math.max(-1, Math.min(1, steer)),
        dt,
      }, {
        sampleGround: sampleWorldGround,
        canOccupy: (x, z, radius) => canRoverOccupy(x, z, radius) &&
          Math.hypot(x - region.center.x, z - region.center.z) <= MAX_REGION_RADIUS,
        bounds: WORLD_BOUNDS,
        radius: RADIUS,
        wheelbase: PLAYABLE_ROVER_SPEC.wheelbase,
        trackWidth: PLAYABLE_ROVER_SPEC.trackWidth,
        regionCenter: region.center,
        regionRadius: MAX_REGION_RADIUS,
      });
      store.publishRoverState(dynamics.current, dynamics.current.longitudinalVelocity);
    }

    const state = dynamics.current;
    const activeGroup = regionalRoots.get(remoteRegionId)?.current;
    activeGroup?.position.set(state.x, state.y + PLAYABLE_ROVER_SPEC.groundOffset, state.z);
    if (activeGroup) activeGroup.rotation.set(0, state.heading, 0);
    const activeModel = regionalModels.get(remoteRegionId)?.current;
    if (!activeModel) return;
    activeModel.updateMatrixWorld();
    const tilt = activeModel.children[0];
    if (tilt) tilt.rotation.set(-state.groundPitch, 0, state.groundRoll, 'YXZ');
    const halfWheelbase = PLAYABLE_ROVER_SPEC.wheelbase / 2;
    const halfTrack = PLAYABLE_ROVER_SPEC.trackWidth / 2;
    for (const side of suspensionSides.current.filter((candidate) => candidate.regionId === remoteRegionId)) {
      const { frontLeft, frontRight, middleLeft, middleRight, rearLeft, rearRight } = state.suspensionTravel;
      for (const wheel of Object.values(side.wheels)) {
        if (!wheel) continue;
        const raw = wheel.axle === 'front' ? (wheel.side < 0 ? frontLeft : frontRight) :
          wheel.axle === 'middle' ? (wheel.side < 0 ? middleLeft : middleRight) : (wheel.side < 0 ? rearLeft : rearRight);
        const longitudinal = wheel.axle === 'front' ? halfWheelbase : wheel.axle === 'rear' ? -halfWheelbase : 0;
        const lateral = wheel.side * halfTrack;
        wheel.residual = suspensionResidual(raw, longitudinal, lateral, state.groundPitch, state.groundRoll);
        wheel.knuckle.position.y = wheel.restKnuckleY + wheel.residual / SCALE;
      }
      const front = side.wheels.front?.residual ?? 0;
      const middle = side.wheels.middle?.residual ?? 0;
      const rear = side.wheels.rear?.residual ?? 0;
      const angles = suspensionAngles(front, middle, rear);
      const index = side.side < 0 ? 0 : 1;
      side.group.rotation.x = angles.rocker[index];
      side.group.position.y = side.restGroupY + ((front + middle + rear) / 3) / SCALE;
      side.bogie.rotation.x = angles.bogie[index];
      side.bogie.position.y = side.restBogieY + (middle + rear) / 2 / SCALE;
    }
    for (const wheel of steeringWheels.current.filter((candidate) => candidate.regionId === remoteRegionId)) {
      wheel.knuckle.rotation.y = -state.steeringAngle;
    }
    const roll = getWheelRotation(state.acceptedWheelTravel / SCALE);
    for (const wheel of rollingWheels.current.filter((candidate) => candidate.regionId === remoteRegionId)) {
      wheel.rollingWheel.rotation.x = roll;
    }
  });

  return (
    <group dispose={null}>
      {WORLD_REGIONS.map((region) => {
        const targets = lightTargets.get(region.id)!;
        const parked = storedPose(region.id, useOutpostStore.getState().regionalRoverPoses ?? {});
        return <group key={region.id} name={`regional-rover-${region.id}`} ref={regionalRoots.get(region.id)!} position={parked.position} rotation={[0, parked.heading, 0]} dispose={null}>
          <group ref={regionalModels.get(region.id)!} scale={SCALE}>
            <RealRoverCraft />
            {targets.map((target, index) => <primitive
              key={`target-${index}`}
              object={target}
              position={[-0.54 + index * 1.08, 0.8, 1.08 + (roverHeadlightMode === 'high' ? 34 : 14) / SCALE]}
            />)}
            {targets.map((target, index) => <spotLight
              key={index}
              position={[-0.54 + index * 1.08, 0.8, 1.08]}
              target={target}
              color={roverHeadlightMode === 'high' ? '#F0F9FF' : '#FFFDF0'}
              intensity={roverHeadlightMode === 'high' ? 5.5 : 3.5}
              distance={roverHeadlightMode === 'high' ? 34 : 14}
              angle={roverHeadlightMode === 'high' ? 0.42 : 0.72}
              penumbra={0.3}
              castShadow={false}
            />)}
          </group>
        </group>;
      })}
    </group>
  );
}

export default PlayableWatchRover;
