import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useOutpostStore } from '@/modules/store/useOutpostStore';
import { soundEngine } from '@/modules/audio/soundEngine';
import { OpeningStep } from './OpeningSequence3D';

const MAX_TRACKS = 64;

/**
 * Authentic NASA Perseverance/Curiosity Planetary Exploration Rover
 * - 6-Wheel Rocker-Bogie differential suspension with cleated titanium wheels
 * - Mastcam-Z tall camera neck with dual optical stereo lenses & SuperCam laser
 * - Articulated sample acquisition robotic arm with coring drill turret
 * - Rear MMRTG (Multi-Mission Radioisotope Thermoelectric Generator) power source
 * - Dual forward LED searchlights casting illumination cones onto Martian regolith
 * - Smooth planetary driving with forward, reverse gear, and zero-turn 360° on-the-spot rotation
 * - Planetary circumnavigation: wrap-around at 120m exploration perimeter
 */
export const MarsRover: React.FC<{ openingStep: OpeningStep }> = ({ openingStep }) => {
  const groupRef = useRef<THREE.Group>(null);
  const mastHeadRef = useRef<THREE.Group>(null);
  const dishRef = useRef<THREE.Group>(null);
  const armRef = useRef<THREE.Group>(null);
  const wheelsRef = useRef<THREE.Group[]>([]);
  const dustParticlesRef = useRef<THREE.Points>(null);
  const trackMeshRef = useRef<THREE.InstancedMesh>(null);
  const trackDummy = useMemo(() => new THREE.Object3D(), []);
  const tracksData = useRef<{ x: number; y: number; z: number; rot: number; life: number }[]>([]);
  const lastTrackPos = useRef<[number, number]>([0, 0]);
  const [hovered, setHovered] = useState(false);

  const isDrivingRover = useOutpostStore((state) => state.isDrivingRover);
  const toggleDrivingRover = useOutpostStore((state) => state.toggleDrivingRover);
  const roverPos = useOutpostStore((state) => state.roverPos);
  const roverHeadlightMode = useOutpostStore((state) => state.roverHeadlightMode);
  const roverUpgradeLevel = useOutpostStore((state) => state.roverUpgradeLevel);
  const setRoverPos = useOutpostStore((state) => state.setRoverPos);
  const setPlayerPos = useOutpostStore((state) => state.setPlayerPos);
  const joystickVector = useOutpostStore((state) => state.joystickVector);
  const isMouseDriving = useOutpostStore((state) => state.isMouseDriving);

  // Local Object3D targets attached to Rover front so dual headlights steer with chassis
  const [leftHeadlightTarget] = useState(() => {
    const obj = new THREE.Object3D();
    obj.position.set(-0.38, -0.6, 14.0);
    return obj;
  });
  const [rightHeadlightTarget] = useState(() => {
    const obj = new THREE.Object3D();
    obj.position.set(0.38, -0.6, 14.0);
    return obj;
  });

  const keysPressed = useRef<Record<string, boolean>>({});
  const heading = useRef(0.0); // 0 radians points towards +Z
  const currentSpeed = useRef(0);

  // Keyboard controls & U-Turn event for rover
  useEffect(() => {
    const handleUTurn = () => {
      heading.current += Math.PI;
    };
    window.addEventListener('rover:uturn', handleUTurn);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      keysPressed.current[e.code] = true;

      if (e.code === 'KeyR') {
        toggleDrivingRover();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('rover:uturn', handleUTurn);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [toggleDrivingRover]);

  // Dust Particle Buffer
  const dustCount = 45;
  const dustPositions = useRef(new Float32Array(dustCount * 3));
  const dustLifetimes = useRef(new Float32Array(dustCount));

  useEffect(() => {
    for (let i = 0; i < dustCount; i++) {
      dustPositions.current[i * 3 + 1] = -100; // hide initially
      dustLifetimes.current[i] = 1.0;
    }
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const safeDelta = Math.min(delta, 0.1);

    // Mastcam gentle autonomous scan
    if (mastHeadRef.current) {
      mastHeadRef.current.rotation.y = Math.sin(t * 0.8) * 0.45;
      mastHeadRef.current.rotation.x = Math.sin(t * 0.4) * 0.08 - 0.05;
    }

    // High gain antenna tracking
    if (dishRef.current) {
      dishRef.current.rotation.y = Math.sin(t * 0.3) * 0.3 + 0.2;
    }

    // Robotic arm idle breathing
    if (armRef.current) {
      armRef.current.rotation.z = Math.sin(t * 1.2) * 0.03 - 0.2;
    }

    if (!groupRef.current) return;

    // Sync external position changes (e.g. Fast Travel or base switch)
    const storeRoverPos = useOutpostStore.getState().roverPos;
    const diffFromStore = Math.hypot(
      groupRef.current.position.x - storeRoverPos[0],
      groupRef.current.position.z - storeRoverPos[2]
    );
    if (diffFromStore > 3.0) {
      groupRef.current.position.set(storeRoverPos[0], storeRoverPos[1], storeRoverPos[2]);
    }

    if (isDrivingRover) {
      let forwardInput = 0;
      let steerInput = 0;

      if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp'] || isMouseDriving) {
        forwardInput += 1;
      }
      if (keysPressed.current['KeyS'] || keysPressed.current['ArrowDown']) {
        forwardInput -= 1;
      }
      if (keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft']) {
        steerInput += 1; // turn left
      }
      if (keysPressed.current['KeyD'] || keysPressed.current['ArrowRight']) {
        steerInput -= 1; // turn right
      }

      // Add touch joystick input
      forwardInput -= joystickVector.y;
      steerInput -= joystickVector.x;

      // Steering turn rate (supports zero-turn rotation in place)
      const turnRate = forwardInput === 0 ? 2.6 : 1.9;
      if (Math.abs(steerInput) > 0.04) {
        heading.current += steerInput * turnRate * safeDelta;
      }

      // Acceleration & braking
      const maxForwardSpeed = 7.5; // m/s
      const maxReverseSpeed = -3.8; // m/s
      const targetSpeed = forwardInput > 0 
        ? forwardInput * maxForwardSpeed 
        : forwardInput < 0 
        ? forwardInput * Math.abs(maxReverseSpeed) 
        : 0;

      const accelRate = forwardInput !== 0 ? 4.5 : 6.0;
      currentSpeed.current = THREE.MathUtils.lerp(currentSpeed.current, targetSpeed, safeDelta * accelRate);

      // Rover front faces +Z in local space:
      // In world coordinates with rotation.y = heading:
      // Forward vector is (sin(heading), 0, cos(heading))
      const dx = Math.sin(heading.current) * currentSpeed.current * safeDelta;
      const dz = Math.cos(heading.current) * currentSpeed.current * safeDelta;

      let newX = groupRef.current.position.x + dx;
      let newZ = groupRef.current.position.z + dz;

      // 600x600 Martian Grid boundary clamping (Invariant I01)
      newX = Math.max(-295, Math.min(295, newX));
      newZ = Math.max(-295, Math.min(295, newZ));

      // Physical Base Collisions (Prevent rover from driving through base habitat domes)
      const BASES = [
        { x: 0, z: 0 },
        { x: 210, z: -180 },
        { x: 200, z: 170 },
      ];
      for (const b of BASES) {
        const bdx = newX - b.x;
        const bdz = newZ - b.z;
        const bdist = Math.hypot(bdx, bdz);
        if (bdist < 4.4) {
          const bAngle = Math.atan2(bdx, bdz);
          newX = b.x + Math.sin(bAngle) * 4.4;
          newZ = b.z + Math.cos(bAngle) * 4.4;
        }
      }

      groupRef.current.position.x = newX;
      groupRef.current.position.z = newZ;
      groupRef.current.position.y = -0.32;
      groupRef.current.rotation.y = heading.current;

      // Update store positions so Cadet Leo & camera follow the rover
      setRoverPos([newX, -0.32, newZ]);
      setPlayerPos([newX, -0.32, newZ]);

      // Wheel spin animations
      // If moving forward/backward: spin based on speed
      // If turning in place: differential counter-spin!
      const forwardWheelSpeed = currentSpeed.current * safeDelta * 4.5;
      const turnWheelSpeed = steerInput * safeDelta * 2.5;

      wheelsRef.current.forEach((wheelGroup, idx) => {
        if (!wheelGroup) return;
        const isLeftWheel = idx % 2 === 0;
        const spin = forwardWheelSpeed + (isLeftWheel ? turnWheelSpeed : -turnWheelSpeed);
        wheelGroup.rotation.x += spin;
      });

      // Update Martian Tire Tracks stamps
      const distFromLastTrack = Math.hypot(newX - lastTrackPos.current[0], newZ - lastTrackPos.current[1]);
      if (distFromLastTrack > 0.45 && Math.abs(currentSpeed.current) > 0.4) {
        lastTrackPos.current = [newX, newZ];
        const cosH = Math.cos(heading.current);
        const sinH = Math.sin(heading.current);

        // Left wheel imprint
        tracksData.current.push({
          x: newX - cosH * 0.68,
          y: -0.375,
          z: newZ + sinH * 0.68,
          rot: heading.current,
          life: 1.0
        });
        // Right wheel imprint
        tracksData.current.push({
          x: newX + cosH * 0.68,
          y: -0.375,
          z: newZ - sinH * 0.68,
          rot: heading.current,
          life: 1.0
        });

        if (tracksData.current.length > MAX_TRACKS) {
          tracksData.current.splice(0, tracksData.current.length - MAX_TRACKS);
        }
      }

      // Dust kick-up effect behind rear wheels
      if (Math.abs(currentSpeed.current) > 1.2 && dustParticlesRef.current) {
        const geo = dustParticlesRef.current.geometry;
        const pos = geo.attributes.position.array as Float32Array;

        for (let i = 0; i < dustCount; i++) {
          dustLifetimes.current[i] += safeDelta * 2.0;
          if (dustLifetimes.current[i] > 1.0) {
            dustLifetimes.current[i] = Math.random() * 0.3;
            // Spawn at rear wheels (-Z)
            const side = Math.random() > 0.5 ? 0.6 : -0.6;
            pos[i * 3] = (Math.random() - 0.5) * 0.3 + side;
            pos[i * 3 + 1] = 0.08 + Math.random() * 0.1;
            pos[i * 3 + 2] = -0.85 - Math.random() * 0.3;
          } else {
            // Billow upward and backward
            pos[i * 3 + 1] += safeDelta * 0.4;
            pos[i * 3 + 2] -= safeDelta * (currentSpeed.current * 0.3);
          }
        }
        geo.attributes.position.needsUpdate = true;
      }
    } else {
      // Parked mode at store position
      groupRef.current.position.x = roverPos[0];
      groupRef.current.position.y = roverPos[1];
      groupRef.current.position.z = roverPos[2];
    }

    // Update Instanced Martian Tire Tracks Buffer
    if (trackMeshRef.current) {
      for (let i = 0; i < MAX_TRACKS; i++) {
        const item = tracksData.current[i];
        if (item && item.life > 0.05) {
          item.life -= safeDelta * 0.035; // Fades smoothly over ~30s
          trackDummy.position.set(item.x, item.y, item.z);
          trackDummy.rotation.set(-Math.PI / 2, 0, item.rot);
          trackDummy.scale.set(1, item.life, 1);
          trackDummy.updateMatrix();
          trackMeshRef.current.setMatrixAt(i, trackDummy.matrix);
        } else {
          trackDummy.position.set(0, -100, 0);
          trackDummy.updateMatrix();
          trackMeshRef.current.setMatrixAt(i, trackDummy.matrix);
        }
      }
      trackMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  const handleRoverClick = (e: any) => {
    e.stopPropagation();
    soundEngine.playClick(1400);
    toggleDrivingRover();
  };

  return (
    <>
      {/* Dynamic Martian Tire Tracks (Persistent Chevron Tread Marks) */}
      <instancedMesh
        ref={trackMeshRef}
        args={[undefined, undefined, MAX_TRACKS]}
        frustumCulled={false}
      >
        <planeGeometry args={[0.24, 0.44]} />
        <meshStandardMaterial
          color="#3B1204"
          roughness={0.92}
          metalness={0.08}
          transparent
          opacity={0.65}
          depthWrite={false}
        />
      </instancedMesh>

      <group
        ref={groupRef}
        visible={openingStep === 'briefing' || openingStep === 'complete'}
        position={roverPos}
        rotation={[0, heading.current, 0]}
        dispose={null}
        onClick={handleRoverClick}
        onPointerDown={handleRoverClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      {/* ========================================================
          1. MAIN CHASSIS (Perseverance Aerogel WEB Body)
          ======================================================== */}
      {/* Primary Equipment Box */}
      <mesh position={[0, 0.46, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.05, 0.42, 1.7]} />
        <meshStandardMaterial
          color={isDrivingRover ? '#E0F2FE' : hovered ? '#F8FAFC' : '#E2E8F0'}
          emissive={isDrivingRover ? '#00F0FF' : '#000000'}
          emissiveIntensity={isDrivingRover ? 0.15 : 0}
          roughness={0.28}
          metalness={0.45}
        />
      </mesh>

      {/* Gold Multi-Layer Insulation (MLI) Thermal Foil Accents */}
      <mesh position={[0, 0.46, 0.45]} castShadow>
        <boxGeometry args={[1.06, 0.43, 0.45]} />
        <meshStandardMaterial
          color="#D97706"
          roughness={0.22}
          metalness={0.88}
        />
      </mesh>

      {/* Top Deck Sensor Bed */}
      <mesh position={[0, 0.68, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.95, 0.05, 1.55]} />
        <meshStandardMaterial color="#1E293B" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* NASA Meatball Emblem Plaque on Side */}
      <mesh position={[0.54, 0.48, 0]} rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.02, 16]} />
        <meshStandardMaterial color="#0284C7" metalness={0.6} roughness={0.2} />
      </mesh>

      {/* Visual Upgrade Level 2+: Front Magnetic Regolith Scoop */}
      {roverUpgradeLevel >= 2 && (
        <group position={[0, 0.28, 0.95]}>
          <mesh castShadow>
            <boxGeometry args={[0.9, 0.12, 0.25]} />
            <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.04, 0.12]}>
            <boxGeometry args={[0.85, 0.04, 0.08]} />
            <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={0.6} />
          </mesh>
        </group>
      )}

      {/* Visual Upgrade Level 3+: Rear Ultrasonic Permafrost Core Drill Rig */}
      {roverUpgradeLevel >= 3 && (
        <group position={[0, 0.85, -0.7]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.06, 0.08, 0.5, 12]} />
            <meshStandardMaterial color="#0284C7" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, -0.3, 0]}>
            <coneGeometry args={[0.07, 0.18, 12]} />
            <meshStandardMaterial color="#CBD5E1" metalness={0.95} roughness={0.1} />
          </mesh>
        </group>
      )}

      {/* Visual Upgrade Level 4+: Side Atmospheric Booster Pods */}
      {roverUpgradeLevel >= 4 && (
        <>
          <mesh position={[-0.58, 0.46, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.6, 12]} />
            <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0.58, 0.46, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.6, 12]} />
            <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.4} />
          </mesh>
        </>
      )}

      {/* ========================================================
          2. MASTCAM-Z REMOTE SENSING MAST (Front-Left)
          ======================================================== */}
      <group position={[-0.32, 0.7, 0.55]}>
        {/* Mast Base Gimbal */}
        <mesh position={[0, 0.05, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.09, 0.12, 12]} />
          <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.2} />
        </mesh>
        {/* Main Vertical Titanium Tube */}
        <mesh position={[0, 0.65, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.045, 1.15, 12]} />
          <meshStandardMaterial color="#94A3B8" metalness={0.9} roughness={0.15} />
        </mesh>

        {/* Mastcam-Z Rotating Head Unit */}
        <group ref={mastHeadRef} position={[0, 1.25, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.3, 0.16, 0.22]} />
            <meshStandardMaterial color="#0F172A" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Dual Stereo Optical Zoom Camera Lenses (Facing +Z forward) */}
          <mesh position={[-0.08, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.06, 12]} />
            <meshStandardMaterial color="#00F0FF" emissive="#00F0FF" emissiveIntensity={0.8} />
          </mesh>
          <mesh position={[0.08, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.06, 12]} />
            <meshStandardMaterial color="#00F0FF" emissive="#00F0FF" emissiveIntensity={0.8} />
          </mesh>
          {/* SuperCam Infrared Laser Aperture */}
          <mesh position={[0, 0.05, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.05, 8]} />
            <meshStandardMaterial color="#EF4444" emissive="#EF4444" emissiveIntensity={0.9} />
          </mesh>
        </group>
      </group>

      {/* ========================================================
          3. ARTICULATED 5-DOF ROBOTIC ARM & CORING TURRET (Front-Right)
          ======================================================== */}
      <group ref={armRef} position={[0.35, 0.45, 0.85]}>
        {/* Shoulder Joint */}
        <mesh castShadow>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} />
        </mesh>
        {/* Upper Arm Boom */}
        <mesh position={[0, -0.15, 0.22]} rotation={[0.6, 0, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.04, 0.45, 8]} />
          <meshStandardMaterial color="#64748B" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Forearm & Turret Drill (Sample Caching System) */}
        <group position={[0, -0.32, 0.42]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.08, 0.08, 0.22, 10]} />
            <meshStandardMaterial color="#D97706" metalness={0.85} roughness={0.2} />
          </mesh>
          {/* Rotary Percussive Coring Bit */}
          <mesh position={[0, -0.14, 0]} castShadow>
            <coneGeometry args={[0.045, 0.14, 8]} />
            <meshStandardMaterial color="#94A3B8" metalness={0.95} roughness={0.1} />
          </mesh>
        </group>
      </group>

      {/* ========================================================
          4. MMRTG NUCLEAR GENERATOR & RADIATOR FINS (Rear)
          ======================================================== */}
      <group position={[0, 0.58, -0.98]}>
        {/* Generator Main Core */}
        <mesh castShadow rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.48, 12]} />
          <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.7} />
        </mesh>
        {/* Thermal Radiator Cooling Fins */}
        {[0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4].map((rot, idx) => (
          <mesh key={idx} rotation={[0, rot, 0]}>
            <boxGeometry args={[0.62, 0.38, 0.02]} />
            <meshStandardMaterial color="#C1440E" roughness={0.3} metalness={0.8} />
          </mesh>
        ))}
        {/* Heat Glow Ring */}
        <mesh position={[0, 0, 0]}>
          <torusGeometry args={[0.23, 0.02, 8, 16]} />
          <meshStandardMaterial color="#FF7E29" emissive="#FF7E29" emissiveIntensity={0.6} />
        </mesh>
      </group>

      {/* ========================================================
          5. HIGH-GAIN PARABOLIC DISH ANTENNA (Rear-Right Deck)
          ======================================================== */}
      <group ref={dishRef} position={[0.28, 0.72, -0.45]}>
        <mesh position={[0, 0.12, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.04, 0.24, 8]} />
          <meshStandardMaterial color="#64748B" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.26, 0]} rotation={[0.4, 0, 0]} castShadow>
          <cylinderGeometry args={[0.26, 0.06, 0.1, 16]} />
          <meshStandardMaterial color="#F8FAFC" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.34, 0.03]}>
          <cylinderGeometry args={[0.015, 0.015, 0.14, 6]} />
          <meshStandardMaterial color="#00F0FF" emissive="#00F0FF" emissiveIntensity={0.6} />
        </mesh>
      </group>

      {/* ========================================================
          6. FRONT DUAL HEADLIGHTS (LOW BEAM 14m / HIGH BEAM 34m)
          ======================================================== */}
      <group position={[0, 0.42, 0.88]}>
        {/* Local scene targets for forward directional projection */}
        <primitive object={leftHeadlightTarget} />
        <primitive object={rightHeadlightTarget} />

        {/* Left Headlight */}
        <mesh position={[-0.38, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.08, 0.08, 12]} />
          <meshStandardMaterial
            color={roverHeadlightMode === 'high' ? '#E0F2FE' : '#FEF08A'}
            emissive={roverHeadlightMode === 'high' ? '#38BDF8' : '#FEF08A'}
            emissiveIntensity={roverHeadlightMode === 'high' ? 2.2 : 1.6}
          />
        </mesh>
        <spotLight
          target={leftHeadlightTarget}
          color={roverHeadlightMode === 'high' ? '#F0F9FF' : '#FFFDF0'}
          intensity={isDrivingRover ? (roverHeadlightMode === 'high' ? 5.5 : 3.5) : 1.2}
          distance={roverHeadlightMode === 'high' ? 34 : 14}
          angle={roverHeadlightMode === 'high' ? 0.42 : 0.72}
          penumbra={0.5}
          position={[-0.38, 0, 0.1]}
        />

        {/* Right Headlight */}
        <mesh position={[0.38, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.08, 0.08, 12]} />
          <meshStandardMaterial
            color={roverHeadlightMode === 'high' ? '#E0F2FE' : '#FEF08A'}
            emissive={roverHeadlightMode === 'high' ? '#38BDF8' : '#FEF08A'}
            emissiveIntensity={roverHeadlightMode === 'high' ? 2.2 : 1.6}
          />
        </mesh>
        <spotLight
          target={rightHeadlightTarget}
          color={roverHeadlightMode === 'high' ? '#F0F9FF' : '#FFFDF0'}
          intensity={isDrivingRover ? (roverHeadlightMode === 'high' ? 5.5 : 3.5) : 1.2}
          distance={roverHeadlightMode === 'high' ? 34 : 14}
          angle={roverHeadlightMode === 'high' ? 0.42 : 0.72}
          penumbra={0.5}
          position={[0.38, 0, 0.1]}
        />
      </group>

      {/* ========================================================
          7. ROCKER-BOGIE 6-WHEEL SUSPENSION SYSTEM
          ======================================================== */}
      {/* Structural Rocker-Bogie Titanium Tubes (Left & Right) */}
      {[-0.6, 0.6].map((sideX, sIdx) => (
        <group key={`bogie-${sIdx}`}>
          {/* Main Rocker Pivot Bar */}
          <mesh position={[sideX, 0.32, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.08, 0.08, 1.4]} />
            <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Front Strut Link */}
          <mesh position={[sideX, 0.22, 0.62]} rotation={[0.4, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.35, 8]} />
            <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.25} />
          </mesh>
          {/* Rear Strut Link */}
          <mesh position={[sideX, 0.22, -0.62]} rotation={[-0.4, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.35, 8]} />
            <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.25} />
          </mesh>
        </group>
      ))}

      {/* 6 Cleated Anodized Aluminum Wheels */}
      {[
        { x: -0.68, z: 0.68, name: 'FL' },
        { x: 0.68, z: 0.68, name: 'FR' },
        { x: -0.74, z: 0.0, name: 'ML' },
        { x: 0.74, z: 0.0, name: 'MR' },
        { x: -0.68, z: -0.68, name: 'RL' },
        { x: 0.68, z: -0.68, name: 'RR' }
      ].map((wheel, idx) => (
        <group
          key={wheel.name}
          ref={(el) => {
            if (el) wheelsRef.current[idx] = el;
          }}
          position={[wheel.x, 0.18, wheel.z]}
        >
          {/* Wheel Hub & Outer Tire Rim */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
            <cylinderGeometry args={[0.22, 0.22, 0.18, 16]} />
            <meshStandardMaterial color="#1E293B" metalness={0.9} roughness={0.25} />
          </mesh>

          {/* Cleated Tread Grips (Mars Traction Chevron Grips) */}
          {[0, Math.PI / 3, (2 * Math.PI) / 3].map((rot, rIdx) => (
            <mesh key={rIdx} rotation={[rot, 0, 0]}>
              <boxGeometry args={[0.19, 0.46, 0.03]} />
              <meshStandardMaterial color="#334155" metalness={0.95} roughness={0.2} />
            </mesh>
          ))}

          {/* Golden/Orange Hub Center */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.1, 0.1, 0.19, 12]} />
            <meshStandardMaterial color="#D97706" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* ========================================================
          8. DUST SPRAY PARTICLE SYSTEM (Behind Wheels When Driving)
          ======================================================== */}
      <points ref={dustParticlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[dustPositions.current, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.16}
          color="#C1440E"
          transparent
          opacity={isDrivingRover ? 0.6 : 0.0}
          depthWrite={false}
        />
      </points>

      {/* Driver Interaction Indicator Ring (Hovered State) */}
      {hovered && !isDrivingRover && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.5, 1.7, 32]} />
          <meshBasicMaterial color="#00F0FF" transparent opacity={0.6} />
        </mesh>
      )}
    </group>
    </>
  );
};

export default MarsRover;
