import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useOutpostStore } from '@/modules/store/useOutpostStore';
import { soundEngine } from '@/modules/audio/soundEngine';
import {
  PHYSICS_CONSTANTS,
  PhysicsState,
  buildWorldColliders,
  stepPlayerPhysics
} from './physicsEngine';

/**
 * Interactive Astronaut Player (Cadet Leo) with Full 3D Obstacle Physics & Space Jumping
 * - Controls: WASD, Arrow keys, Space to Jump, Mobile Touch Joystick/Jump
 * - Rigid-body horizontal obstacle & wall collision blocking with tangent sliding
 * - Martian low-gravity jump kinematics (g = 9.2 m/s²) & platform top landing
 * - Dynamic ground contact shadow ring & squash-and-stretch animation
 */
export const AstronautPlayer: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const bodyScaleRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const shadowMeshRef = useRef<THREE.Mesh>(null);
  const jetPlumeGroupRef = useRef<THREE.Group>(null);
  const pulseRingRef = useRef<THREE.Mesh>(null);

  const keysPressed = useRef<Record<string, boolean>>({});
  const jumpQueued = useRef(false);
  const lastHandledJumpCount = useRef(0);
  const walkCycle = useRef(0);
  const lastBumpSoundTime = useRef(0);
  const lastBlockedUntilTime = useRef(0);
  const lastBlockedObstacleLabel = useRef<string | null>(null);
  const thrusterEnergyRef = useRef(100);
  const wasSprintingRef = useRef(false);
  const pulseRingScaleRef = useRef(0);

  // Persistent physics state
  const physicsRef = useRef<PhysicsState>({
    x: 0,
    y: PHYSICS_CONSTANTS.GROUND_Y,
    z: 1.55,
    vx: 0,
    vy: 0,
    vz: 0,
    isGrounded: true,
    isBlocked: false,
    blockedByLabel: null,
    blockedObstacleJumpable: false,
    standingOnLabel: null,
    airJumpsLeft: PHYSICS_CONSTANTS.MAX_AIR_JUMPS,
    coyoteTimer: PHYSICS_CONSTANTS.COYOTE_TIME,
    jumpBufferTimer: 0
  });

  const playerPos = useOutpostStore((state) => state.playerPos);
  const roverPos = useOutpostStore((state) => state.roverPos);
  const joystickVector = useOutpostStore((state) => state.joystickVector);
  const setPlayerPos = useOutpostStore((state) => state.setPlayerPos);
  const isInsideHabitat = useOutpostStore((state) => state.isInsideHabitat);
  const setIsInsideHabitat = useOutpostStore((state) => state.setIsInsideHabitat);
  const isDrivingRover = useOutpostStore((state) => state.isDrivingRover);
  const cameraYaw = useOutpostStore((state) => state.cameraYaw);
  const isMouseDriving = useOutpostStore((state) => state.isMouseDriving);
  const isFlashlightOn = useOutpostStore((state) => state.isFlashlightOn);
  const toggleFlashlight = useOutpostStore((state) => state.toggleFlashlight);
  const jumpRequestCount = useOutpostStore((state) => state.jumpRequestCount);
  const sprintInputActive = useOutpostStore((state) => state.sprintInputActive);
  const survivalSuppliesAvailable = useOutpostStore((state) =>
    state.exploration.survival.air > 0 && state.exploration.survival.meals > 0 && state.exploration.survival.energyEU > 0
  );
  const setPhysicsStatus = useOutpostStore((state) => state.setPhysicsStatus);

  // Local Object3D target attached to torch hierarchy so the beam always points forward
  const [flashlightTarget] = React.useState(() => {
    const obj = new THREE.Object3D();
    obj.position.set(0, -0.3, 14);
    return obj;
  });

  // Sync external store teleports (e.g. Rover dismount or automated tests)
  useEffect(() => {
    const dist = Math.hypot(
      playerPos[0] - physicsRef.current.x,
      playerPos[2] - physicsRef.current.z
    );
    if (dist > 1.2) {
      physicsRef.current.x = playerPos[0];
      physicsRef.current.y = playerPos[1];
      physicsRef.current.z = playerPos[2];
      physicsRef.current.vx = 0;
      physicsRef.current.vy = 0;
      physicsRef.current.vz = 0;
      if (groupRef.current) {
        groupRef.current.position.set(playerPos[0], playerPos[1], playerPos[2]);
      }
    }
  }, [playerPos]);

  // Listen for UI / Mobile Touch jump requests from store
  useEffect(() => {
    if (jumpRequestCount > lastHandledJumpCount.current) {
      lastHandledJumpCount.current = jumpRequestCount;
      if (useOutpostStore.getState().isDrivingRover) {
        jumpQueued.current = false;
        return;
      }
      jumpQueued.current = true;
    }
  }, [jumpRequestCount]);

  // Helper to check if any modal overlay currently owns input focus
  const isModalBlockingGameplay = () => {
    const s = useOutpostStore.getState();
    if (s.isBackpackOpen || s.isDatapadOpen || s.isClassroomOpen || s.isBrownoutQuizOpen) {
      return true;
    }
    if (typeof document !== 'undefined' && document.querySelector('[role="dialog"]')) {
      return true;
    }
    return false;
  };

  // Keyboard Event Listeners for WASD, Arrow Keys, [Space] Jump/Double-Jump, [Shift] Sprint, and [L] Flashlight
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const liveStoreState = useOutpostStore.getState();
      if (liveStoreState.isDrivingRover) {
        keysPressed.current = {};
        jumpQueued.current = false;
        lastHandledJumpCount.current = liveStoreState.jumpRequestCount;
        return;
      }

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

      // If any modal dialog is open, clear held keys and let dialog buttons handle Space/Enter naturally
      if (isModalBlockingGameplay()) {
        keysPressed.current = {};
        jumpQueued.current = false;
        return;
      }

      if (e.code === 'Space') {
        // If focus is on an interactive HUD button outside a dialog, blur it so Space jumps cleanly in gameplay
        if (
          document.activeElement instanceof HTMLElement &&
          document.activeElement.tagName === 'BUTTON' &&
          !document.activeElement.closest('[role="dialog"]')
        ) {
          document.activeElement.blur();
        }
        e.preventDefault();
        if (!keysPressed.current['Space']) {
          jumpQueued.current = true;
        }
      }

      keysPressed.current[e.code] = true;

      if (e.code === 'KeyL' && !e.repeat) {
        toggleFlashlight();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };

    const handleBlur = () => {
      keysPressed.current = {};
      jumpQueued.current = false;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        keysPressed.current = {};
        jumpQueued.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [toggleFlashlight]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    if (isDrivingRover) {
      keysPressed.current = {};
      jumpQueued.current = false;
      lastHandledJumpCount.current = useOutpostStore.getState().jumpRequestCount;
      groupRef.current.visible = true;
      return;
    }
    groupRef.current.visible = false;

    const safeDelta = Math.min(delta, PHYSICS_CONSTANTS.MAX_DT);

    // Flush held movement keys if a modal took ownership mid-stride
    const modalOpen = isModalBlockingGameplay();
    if (modalOpen) {
      keysPressed.current = {};
      jumpQueued.current = false;
    }

    // Camera-relative direction vectors (yaw = 0 points towards -Z)
    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);

    let inputForward = 0;
    let inputRight = 0;

    if (!modalOpen) {
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

      // Combine with Virtual Joystick (active on mobile/touch)
      inputForward -= joystickVector.y;
      inputRight += joystickVector.x;
    }

    const rawMoveX = forwardX * inputForward + rightX * inputRight;
    const rawMoveZ = forwardZ * inputForward + rightZ * inputRight;

    const length = Math.hypot(rawMoveX, rawMoveZ);
    const isMoving = length > 0.05;

    const normX = isMoving ? rawMoveX / (length > 1 ? length : 1) : 0;
    const normZ = isMoving ? rawMoveZ / (length > 1 ? length : 1) : 0;

    // EVA Thruster Sprint ([Shift] or Mobile Boost button)
    const shiftHeld =
      !!keysPressed.current['ShiftLeft'] ||
      !!keysPressed.current['ShiftRight'] ||
      sprintInputActive;
    const canSprint = shiftHeld && isMoving && thrusterEnergyRef.current > 4 && survivalSuppliesAvailable;

    if (canSprint) {
      thrusterEnergyRef.current = Math.max(0, thrusterEnergyRef.current - 22 * safeDelta);
      if (!wasSprintingRef.current) {
        soundEngine.playThrusterBoost();
      }
    } else {
      thrusterEnergyRef.current = Math.min(100, thrusterEnergyRef.current + 28 * safeDelta);
    }
    wasSprintingRef.current = canSprint;

    const targetMoveSpeed = canSprint
      ? PHYSICS_CONSTANTS.SPRINT_SPEED
      : PHYSICS_CONSTANTS.WALK_SPEED;

    const wasGrounded = physicsRef.current.isGrounded;
    const wantJump = jumpQueued.current;
    jumpQueued.current = false;

    const activeColliders = buildWorldColliders(roverPos, isDrivingRover);

    // Step 3D Rigid-Body Physics & Obstacle Collisions with Smooth Inertia
    const nextPhysics = stepPlayerPhysics(
      physicsRef.current,
      {
        moveX: normX * targetMoveSpeed,
        moveZ: normZ * targetMoveSpeed,
        jumpJustPressed: wantJump,
        dt: safeDelta,
        useSmoothInertia: true
      },
      activeColliders,
      PHYSICS_CONSTANTS.PLAYER_RADIUS
    );

    // Trigger jump / double-jump / land / collision bump audio & squash-stretch
    if (nextPhysics.didDoubleJump) {
      soundEngine.playDoubleJump();
      pulseRingScaleRef.current = 0.25;
      if (bodyScaleRef.current) {
        bodyScaleRef.current.scale.set(0.84, 1.24, 0.84);
      }
    } else if (wasGrounded && !nextPhysics.isGrounded && nextPhysics.vy > 0) {
      soundEngine.playJump();
      pulseRingScaleRef.current = 0.2;
      if (bodyScaleRef.current) {
        bodyScaleRef.current.scale.set(0.86, 1.18, 0.86);
      }
    } else if (!wasGrounded && nextPhysics.isGrounded) {
      soundEngine.playLand();
      if (bodyScaleRef.current) {
        bodyScaleRef.current.scale.set(1.18, 0.82, 1.18);
      }
    } else if (nextPhysics.isBlocked && isMoving) {
      const now = state.clock.getElapsedTime();
      if (now - lastBumpSoundTime.current > 0.45) {
        lastBumpSoundTime.current = now;
        soundEngine.playBump();
      }
    }

    const actualHorizontalSpeed = Math.hypot(nextPhysics.vx ?? 0, nextPhysics.vz ?? 0);

    // Smoothly damp squash-and-stretch + dynamic forward sprint lean & turning bank roll
    if (bodyScaleRef.current) {
      const damp = 1 - Math.exp(-14 * safeDelta);
      bodyScaleRef.current.scale.x = THREE.MathUtils.lerp(bodyScaleRef.current.scale.x, 1, damp);
      bodyScaleRef.current.scale.y = THREE.MathUtils.lerp(bodyScaleRef.current.scale.y, 1, damp);
      bodyScaleRef.current.scale.z = THREE.MathUtils.lerp(bodyScaleRef.current.scale.z, 1, damp);

      const targetForwardLean = canSprint ? 0.16 : isMoving ? 0.06 : 0;
      bodyScaleRef.current.rotation.x = THREE.MathUtils.lerp(
        bodyScaleRef.current.rotation.x,
        targetForwardLean,
        damp
      );
    }

    // Animate PLSS Backpack Ion Thruster Plumes (visible when sprinting or airborne jumping)
    if (jetPlumeGroupRef.current) {
      const jetActive = canSprint || (!nextPhysics.isGrounded && nextPhysics.vy > -1.0);
      jetPlumeGroupRef.current.visible = jetActive;
      if (jetActive) {
        const flicker = 0.85 + Math.sin(state.clock.getElapsedTime() * 45) * 0.22;
        const boostScale = canSprint ? 1.25 : 0.95;
        jetPlumeGroupRef.current.scale.set(1, flicker * boostScale, 1);
      }
    }

    // Animate Takeoff / Double-Jump Shockwave Ring
    if (pulseRingRef.current) {
      if (pulseRingScaleRef.current > 0.01) {
        pulseRingRef.current.visible = true;
        pulseRingScaleRef.current += safeDelta * 5.2;
        const s = pulseRingScaleRef.current;
        pulseRingRef.current.scale.set(s, s, 1);
        const mat = pulseRingRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, 1.0 - s * 0.48);
        if (s > 2.1) {
          pulseRingScaleRef.current = 0;
          pulseRingRef.current.visible = false;
        }
      } else {
        pulseRingRef.current.visible = false;
      }
    }

    physicsRef.current = nextPhysics;

    // Apply position to 3D group
    groupRef.current.position.x = nextPhysics.x;
    groupRef.current.position.z = nextPhysics.z;

    if (actualHorizontalSpeed > 0.15) {
      // Smooth rotation toward velocity vector
      const targetAngle = Math.atan2(nextPhysics.vx ?? normX, nextPhysics.vz ?? normZ);
      let diff = targetAngle - groupRef.current.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      groupRef.current.rotation.y += diff * 14 * safeDelta;

      // Subtle bank roll when turning
      if (bodyScaleRef.current) {
        bodyScaleRef.current.rotation.z = THREE.MathUtils.lerp(
          bodyScaleRef.current.rotation.z,
          -Math.max(-0.18, Math.min(0.18, diff * 0.22)),
          safeDelta * 10
        );
      }
    } else if (bodyScaleRef.current) {
      bodyScaleRef.current.rotation.z = THREE.MathUtils.lerp(
        bodyScaleRef.current.rotation.z,
        0,
        safeDelta * 10
      );
    }

    // Limb & vertical bounce animation based on grounded vs airborne state
    if (!nextPhysics.isGrounded) {
      groupRef.current.position.y = nextPhysics.y;
      if (leftLegRef.current && rightLegRef.current) {
        leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0.55, safeDelta * 12);
        rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, -0.35, safeDelta * 12);
      }
      if (leftArmRef.current && rightArmRef.current) {
        leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, -0.65, safeDelta * 12);
        rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -0.55, safeDelta * 12);
      }
    } else if (actualHorizontalSpeed > 0.2) {
      const gaitFreq = canSprint ? 15 : 10;
      walkCycle.current += safeDelta * gaitFreq;
      const swing = Math.sin(walkCycle.current);
      const strideAmp = canSprint ? 0.62 : 0.45;

      if (leftLegRef.current && rightLegRef.current) {
        leftLegRef.current.rotation.x = swing * strideAmp;
        rightLegRef.current.rotation.x = -swing * strideAmp;
      }
      if (leftArmRef.current && rightArmRef.current) {
        leftArmRef.current.rotation.x = -swing * (strideAmp * 0.9);
        if (isFlashlightOn) {
          rightArmRef.current.rotation.x = -0.35 + Math.sin(walkCycle.current) * 0.05;
        } else {
          rightArmRef.current.rotation.x = swing * (strideAmp * 0.9);
        }
      }
      groupRef.current.position.y =
        nextPhysics.y + Math.abs(Math.sin(walkCycle.current)) * (canSprint ? 0.075 : 0.05);
    } else {
      groupRef.current.position.y = nextPhysics.y + Math.sin(state.clock.getElapsedTime() * 2.5) * 0.015;
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

    // Update Ground Contact Shadow (stays on ground beneath player so jump height is visually clear)
    if (shadowMeshRef.current) {
      const heightAboveGround = Math.max(0, groupRef.current.position.y - PHYSICS_CONSTANTS.GROUND_Y);
      shadowMeshRef.current.position.y = -(groupRef.current.position.y - PHYSICS_CONSTANTS.GROUND_Y) + 0.02;
      const shadowScale = Math.max(0.45, 1.0 - heightAboveGround * 0.28);
      shadowMeshRef.current.scale.set(shadowScale, shadowScale, 1);
    }

    // Hold collision banner for 1.2s after bumping into an obstacle (clear immediately on jump)
    const nowTime = state.clock.getElapsedTime();
    if (!nextPhysics.isGrounded) {
      lastBlockedUntilTime.current = 0;
      lastBlockedObstacleLabel.current = null;
    } else if (nextPhysics.isBlocked && nextPhysics.blockedByLabel) {
      lastBlockedUntilTime.current = nowTime + 1.2;
      lastBlockedObstacleLabel.current = nextPhysics.blockedByLabel;
    }

    const showBlocked =
      nextPhysics.isGrounded &&
      (nextPhysics.isBlocked || nowTime < lastBlockedUntilTime.current) &&
      !!lastBlockedObstacleLabel.current;

    // Sync position & physics telemetry to store
    setPlayerPos([
      groupRef.current.position.x,
      groupRef.current.position.y,
      groupRef.current.position.z
    ]);

    setPhysicsStatus({
      isGrounded: nextPhysics.isGrounded,
      isBlocked: showBlocked,
      blockedByLabel: showBlocked ? lastBlockedObstacleLabel.current : null,
      standingOnLabel: nextPhysics.standingOnLabel,
      isSprinting: canSprint,
      thrusterEnergy: thrusterEnergyRef.current,
      playerSpeedMps: actualHorizontalSpeed,
      airJumpsLeft: nextPhysics.airJumpsLeft ?? 1
    });

    // Habitat Dome Interior Check (Dome inner radius ~ 3.60m)
    const px = groupRef.current.position.x;
    const pz = groupRef.current.position.z;
    const rad = Math.hypot(px, pz);
    const isInside = rad < 3.55;
    if (isInside !== isInsideHabitat) {
      setIsInsideHabitat(isInside);
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.4, 1.55]} dispose={null}>
      {/* Ground Contact Shadow Disc (Visualizes jump elevation above Martian surface) */}
      <mesh
        ref={shadowMeshRef}
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.36, 20]} />
        <meshBasicMaterial
          color="#000000"
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </mesh>

      {/* Expanding EVA Jetpack Shockwave Ring on Jump / Double-Jump */}
      <mesh
        ref={pulseRingRef}
        visible={false}
        position={[0, 0.06, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.24, 0.38, 28]} />
        <meshBasicMaterial
          color="#00F0FF"
          transparent
          opacity={0.85}
          side={2}
          depthWrite={false}
        />
      </mesh>

      <group ref={bodyScaleRef}>
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

        {/* Primary Life Support System (PLSS Backpack + Ion Jetpack Nozzles) */}
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

          {/* Dual Ion Thruster Flame Plumes (Visible during Shift Sprint & Airborne Jetpack Jumps) */}
          <group ref={jetPlumeGroupRef} visible={false} position={[0, -0.24, -0.08]}>
            <mesh position={[-0.1, -0.14, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.055, 0.28, 8]} />
              <meshBasicMaterial color="#00F0FF" transparent opacity={0.88} />
            </mesh>
            <mesh position={[0.1, -0.14, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.055, 0.28, 8]} />
              <meshBasicMaterial color="#00F0FF" transparent opacity={0.88} />
            </mesh>
            <pointLight color="#00F0FF" intensity={2.2} distance={2.5} position={[0, -0.15, 0]} />
          </group>
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
    </group>
  );
};

export default AstronautPlayer;
