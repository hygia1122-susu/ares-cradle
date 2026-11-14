import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useOutpostStore } from '@/modules/store/useOutpostStore';

/**
 * Task 12.2: Interactive Astronaut Player (Cadet Leo)
 * Architecture 3.1 & 3.2:
 * - Controls: WASD, Arrow keys, VirtualJoystick
 * - Dynamic rotation: Math.atan2(moveX, moveZ)
 * - Walking leg/arm swing & footstep bounce
 * - Dual space airlock proximity detection
 */
export const AstronautPlayer: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Group>(null);

  const keysPressed = useRef<Record<string, boolean>>({});
  const walkCycle = useRef(0);

  const joystickVector = useOutpostStore((state) => state.joystickVector);
  const setPlayerPos = useOutpostStore((state) => state.setPlayerPos);
  const isInsideHabitat = useOutpostStore((state) => state.isInsideHabitat);
  const setIsInsideHabitat = useOutpostStore((state) => state.setIsInsideHabitat);
  const isDrivingRover = useOutpostStore((state) => state.isDrivingRover);
  const cameraYaw = useOutpostStore((state) => state.cameraYaw);
  const isMouseDriving = useOutpostStore((state) => state.isMouseDriving);
  const isFlashlightOn = useOutpostStore((state) => state.isFlashlightOn);
  const toggleFlashlight = useOutpostStore((state) => state.toggleFlashlight);

  // Local Object3D target attached to torch hierarchy so the beam always points forward
  const [flashlightTarget] = React.useState(() => {
    const obj = new THREE.Object3D();
    obj.position.set(0, -0.3, 14);
    return obj;
  });

  // Keyboard Event Listeners for WASD, Arrow Keys and [F] for Flashlight
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      keysPressed.current[e.code] = true;

      if (e.code === 'KeyF') {
        toggleFlashlight();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (isDrivingRover) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;

    // Sync external position change (e.g. Fast Travel or base change)
    const storePlayerPos = useOutpostStore.getState().playerPos;
    const diffFromStore = Math.hypot(
      groupRef.current.position.x - storePlayerPos[0],
      groupRef.current.position.z - storePlayerPos[2]
    );
    if (diffFromStore > 3.0) {
      groupRef.current.position.set(storePlayerPos[0], storePlayerPos[1], storePlayerPos[2]);
    }

    const safeDelta = Math.min(delta, 0.1);
    const speed = 4.2; // m/s comfortable walking speed

    // Camera-relative direction vectors (yaw = 0 points towards -Z)
    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);

    let inputForward = 0;
    let inputRight = 0;

    if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp'] || isMouseDriving) {
      inputForward += 1;
    }
    if (keysPressed.current['KeyS'] || keysPressed.current['ArrowDown']) {
      inputForward -= 1;
    }
    if (keysPressed.current['KeyD'] || keysPressed.current['ArrowRight']) {
      inputRight += 1;
    }
    if (keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft']) {
      inputRight -= 1;
    }

    // Combine with Virtual Joystick
    inputForward -= joystickVector.y;
    inputRight += joystickVector.x;

    let moveX = forwardX * inputForward + rightX * inputRight;
    let moveZ = forwardZ * inputForward + rightZ * inputRight;

    const length = Math.hypot(moveX, moveZ);
    const isMoving = length > 0.05;

    if (isMoving) {
      const normX = moveX / (length > 1 ? length : 1);
      const normZ = moveZ / (length > 1 ? length : 1);

      // Move player position
      let newX = groupRef.current.position.x + normX * speed * safeDelta;
      let newZ = groupRef.current.position.z + normZ * speed * safeDelta;

      // 600x600 Martian Grid boundary clamping (Invariant I01)
      newX = Math.max(-295, Math.min(295, newX));
      newZ = Math.max(-295, Math.min(295, newZ));

      // Physical Base Collisions & Walk-in Entrance Ramp
      const BASES = [
        { x: 0, z: 0 },
        { x: 210, z: -180 },
        { x: 200, z: 170 },
      ];

      let targetFloor = -0.4;

      for (const b of BASES) {
        const dx = newX - b.x;
        const dz = newZ - b.z;
        const dist = Math.hypot(dx, dz);

        // Door corridor in front of base (+Z)
        const inCorridor = Math.abs(dx) <= 1.2 && dz >= 3.2 && dz <= 5.8;

        if (dist < 3.8) {
          if (inCorridor) {
            targetFloor = 0.2;
          } else {
            const oldDx = groupRef.current.position.x - b.x;
            const oldDz = groupRef.current.position.z - b.z;
            const wasInside = Math.hypot(oldDx, oldDz) < 3.7;

            if (wasInside) {
              const angle = Math.atan2(dx, dz);
              newX = b.x + Math.sin(angle) * 3.6;
              newZ = b.z + Math.cos(angle) * 3.6;
              targetFloor = 0.2;
            } else {
              const angle = Math.atan2(dx, dz);
              newX = b.x + Math.sin(angle) * 3.85;
              newZ = b.z + Math.cos(angle) * 3.85;
              targetFloor = -0.4;
            }
          }
        } else if (inCorridor) {
          const rampProgress = Math.max(0, Math.min(1, (5.8 - dz) / (5.8 - 3.4)));
          targetFloor = -0.4 + rampProgress * 0.6;
        }
      }

      groupRef.current.position.x = newX;
      groupRef.current.position.z = newZ;

      // Smooth rotation toward movement vector
      const targetAngle = Math.atan2(normX, normZ);
      // Interpolate angle without winding flip
      let diff = targetAngle - groupRef.current.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      groupRef.current.rotation.y += diff * 12 * safeDelta;

      // Animate walking limbs
      walkCycle.current += safeDelta * 10;
      const swing = Math.sin(walkCycle.current);

      if (leftLegRef.current && rightLegRef.current) {
        leftLegRef.current.rotation.x = swing * 0.45;
        rightLegRef.current.rotation.x = -swing * 0.45;
      }
      if (leftArmRef.current && rightArmRef.current) {
        leftArmRef.current.rotation.x = -swing * 0.4;
        if (isFlashlightOn) {
          rightArmRef.current.rotation.x = -0.35 + Math.sin(walkCycle.current) * 0.05;
        } else {
          rightArmRef.current.rotation.x = swing * 0.4;
        }
      }
      // Bobbing head & body bounce relative to current floor height
      groupRef.current.position.y = targetFloor + Math.abs(Math.sin(walkCycle.current)) * 0.06;
    } else {
      // Re-evaluate target floor in idle pose
      const BASES = [
        { x: 0, z: 0 },
        { x: 210, z: -180 },
        { x: 200, z: 170 },
      ];
      let targetFloor = -0.4;

      for (const b of BASES) {
        const dx = groupRef.current.position.x - b.x;
        const dz = groupRef.current.position.z - b.z;
        const dist = Math.hypot(dx, dz);
        const inCorridor = Math.abs(dx) <= 1.2 && dz >= 3.2 && dz <= 5.8;

        if (dist < 3.8) {
          targetFloor = 0.2;
        } else if (inCorridor) {
          const rampProgress = Math.max(0, Math.min(1, (5.8 - dz) / (5.8 - 3.4)));
          targetFloor = -0.4 + rampProgress * 0.6;
        }
      }

      // Idle pose reset relative to current floor height
      groupRef.current.position.y = targetFloor + Math.sin(walkCycle.current) * 0.02;
      if (leftLegRef.current && rightLegRef.current) {
        leftLegRef.current.rotation.x *= 0.85;
        rightLegRef.current.rotation.x *= 0.85;
      }
      if (leftArmRef.current && rightArmRef.current) {
        leftArmRef.current.rotation.x *= 0.85;
        if (isFlashlightOn) {
          rightArmRef.current.rotation.x = -0.35;
        } else {
          rightArmRef.current.rotation.x *= 0.85;
        }
      }
    }

    // Sync position to store
    setPlayerPos([
      groupRef.current.position.x,
      groupRef.current.position.y,
      groupRef.current.position.z
    ]);

    // Update inside habitat state
    const px = groupRef.current.position.x;
    const pz = groupRef.current.position.z;
    const isInside = Math.hypot(px, pz) < 3.7 || Math.hypot(px - 210, pz + 180) < 3.7 || Math.hypot(px - 200, pz - 170) < 3.7;
    if (isInside !== isInsideHabitat) {
      setIsInsideHabitat(isInside);
    }
  });

  return (
    <group ref={groupRef} position={[1.8, -0.4, 2.5]} dispose={null}>
      {/* Head & Helmet */}
      <group ref={headRef} position={[0, 0.95, 0]}>
        {/* White Spacesuit Helmet Box */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.42, 0.42, 0.42]} />
          <meshStandardMaterial color="#E2E8F0" roughness={0.3} metalness={0.1} flatShading />
        </mesh>

        {/* Reflective Gold Mars Visor */}
        <mesh position={[0, 0.02, 0.18]} castShadow>
          <boxGeometry args={[0.34, 0.22, 0.1]} />
          <meshStandardMaterial
            color="#FFB020"
            metalness={0.92}
            roughness={0.15}
            emissive="#FFB020"
            emissiveIntensity={0.25}
            flatShading
          />
        </mesh>

        {/* Helmet Comm Antenna */}
        <mesh position={[0.22, 0.15, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.25, 6]} />
          <meshStandardMaterial color="#64748B" metalness={0.8} roughness={0.2} flatShading />
        </mesh>
        <mesh position={[0.22, 0.28, 0]}>
          <sphereGeometry args={[0.03, 6, 6]} />
          <meshStandardMaterial color="#00F0FF" emissive="#00F0FF" emissiveIntensity={0.6} flatShading />
        </mesh>
      </group>

      {/* Torso & Mission Suit */}
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.44, 0.5, 0.28]} />
        <meshStandardMaterial color="#F1F5F9" roughness={0.4} metalness={0.1} flatShading />
      </mesh>

      {/* Mission Badge on Chest */}
      <mesh position={[0, 0.62, 0.145]}>
        <boxGeometry args={[0.16, 0.1, 0.02]} />
        <meshStandardMaterial
          color="#C1440E"
          emissive="#C1440E"
          emissiveIntensity={0.3}
          flatShading
        />
      </mesh>

      {/* Primary Life Support System (PLSS Backpack) */}
      <group position={[0, 0.58, -0.22]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.36, 0.46, 0.2]} />
          <meshStandardMaterial color="#CBD5E1" roughness={0.3} metalness={0.4} flatShading />
        </mesh>
        {/* Oxygen Cylinders */}
        <mesh position={[-0.1, 0, -0.08]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.38, 8]} />
          <meshStandardMaterial color="#00F0FF" emissive="#00F0FF" emissiveIntensity={0.3} flatShading />
        </mesh>
        <mesh position={[0.1, 0, -0.08]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.38, 8]} />
          <meshStandardMaterial color="#00F0FF" emissive="#00F0FF" emissiveIntensity={0.3} flatShading />
        </mesh>
      </group>

      {/* Left Arm */}
      <mesh ref={leftArmRef} position={[-0.29, 0.55, 0]} castShadow>
        <boxGeometry args={[0.14, 0.42, 0.16]} />
        <meshStandardMaterial color="#E2E8F0" roughness={0.4} metalness={0.1} flatShading />
      </mesh>

      {/* Right Arm & Handheld Flashlight */}
      <group ref={rightArmRef} position={[0.29, 0.55, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.14, 0.42, 0.16]} />
          <meshStandardMaterial color="#E2E8F0" roughness={0.4} metalness={0.1} flatShading />
        </mesh>
        {/* Handheld Flashlight Torch */}
        {isFlashlightOn && (
          <group position={[0, -0.18, 0.14]} rotation={[0.2, 0, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 0.18, 10]} />
              <meshStandardMaterial color="#1E293B" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0, 0.09]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.038, 0.038, 0.02, 10]} />
              <meshBasicMaterial color="#E0F2FE" />
            </mesh>
            {/* Scene Graph Local Target ensures light beam always points forward as Leo moves & turns */}
            <primitive object={flashlightTarget} />
            <spotLight
              target={flashlightTarget}
              color="#FFFDF0"
              intensity={8.0}
              distance={26}
              angle={0.55}
              penumbra={0.45}
              position={[0, 0, 0.1]}
              castShadow
            />
            {/* Close-range ground ambient illumination */}
            <pointLight
              color="#FFFDF0"
              intensity={1.2}
              distance={3.5}
              position={[0, 0, 0.15]}
            />
          </group>
        )}
      </group>

      {/* Left Leg */}
      <mesh ref={leftLegRef} position={[-0.13, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.16, 0.35, 0.18]} />
        <meshStandardMaterial color="#64748B" roughness={0.5} flatShading />
      </mesh>

      {/* Right Leg */}
      <mesh ref={rightLegRef} position={[0.13, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.16, 0.35, 0.18]} />
        <meshStandardMaterial color="#64748B" roughness={0.5} flatShading />
      </mesh>
    </group>
  );
};

export default AstronautPlayer;
