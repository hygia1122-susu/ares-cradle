import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useOutpostStore } from '@/modules/store/useOutpostStore';
import { soundEngine } from '@/modules/audio/soundEngine';

/**
 * NASA Mars Habitat Camp (Ares Cradle v3.0 Expanded 3.85m Base)
 * - Spacious 3.85m Geodesic Aerogel Observation Dome
 * - 3D-Printed Bio-Regolith Foundation Wall with Anti-Radiation Sintering
 * - Rotating Deep-Space Satellite Dish Comms Array
 * - 4-Petal Interlocking Storm Shutter Shield Mode
 * - Rover Charging Ramp with Magnetic Induction Lock
 * - Perimeter Safety Floodlights & Reactive Atmospheric Corona
 */
export const HabitatDome: React.FC = () => {
  const outerDomeRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.MeshBasicMaterial>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const dishRef = useRef<THREE.Group>(null);
  const shutterAngle = useRef(0);
  const shuttersRef = useRef<THREE.Group[]>([]);
  const pointLightRef = useRef<THREE.PointLight>(null);
  const dockPadRef = useRef<THREE.Mesh>(null);
  const leftDoorRef = useRef<THREE.Mesh>(null);
  const rightDoorRef = useRef<THREE.Mesh>(null);
  const hadDockedAlert = useRef(false);

  const emergencySaver = useOutpostStore((state) => state.emergencyPowerSaver);
  const oxygen = useOutpostStore((state) => state.oxygen);
  const temperature = useOutpostStore((state) => state.temperature);
  const isStormShutterClosed = useOutpostStore((state) => state.isStormShutterClosed);
  const roverPos = useOutpostStore((state) => state.roverPos);
  const playerPos = useOutpostStore((state) => state.playerPos);
  const isRoverDocked = useOutpostStore((state) => state.isRoverDocked);
  const setIsRoverDocked = useOutpostStore((state) => state.setIsRoverDocked);
  const domeEvolutionLevel = useOutpostStore((state) => state.domeEvolutionLevel);

  // Ramp Dock Position on Mars terrain (in front of base at +Z)
  const dockTargetX = 0;
  const dockTargetZ = 5.2;

  useFrame((state, delta) => {
    const elapsed = state.clock.getElapsedTime();
    const safeDelta = Math.min(delta, 0.1);

    // 1. Deep Space Satellite Dish continuous celestial tracking
    if (dishRef.current) {
      dishRef.current.rotation.y = elapsed * 0.18;
      dishRef.current.rotation.x = Math.sin(elapsed * 0.3) * 0.12 + 0.35;
    }

    // 2. Telemetry Beacon Strobe
    if (beaconRef.current && (beaconRef.current.material as THREE.MeshStandardMaterial)) {
      const beaconMat = beaconRef.current.material as THREE.MeshStandardMaterial;
      const strobe = Math.sin(elapsed * 5.0) > 0.3 ? 1.4 : 0.05;
      beaconMat.emissiveIntensity = strobe;
    }

    // 3. Rover Docking Proximity Sensor (at top of ramp)
    const distToDock = Math.hypot(roverPos[0] - dockTargetX, roverPos[2] - dockTargetZ);
    const inDockZone = distToDock < 1.6;

    if (inDockZone !== isRoverDocked) {
      setIsRoverDocked(inDockZone);
      if (inDockZone && !hadDockedAlert.current) {
        hadDockedAlert.current = true;
        soundEngine.playSuccessChime();
      } else if (!inDockZone) {
        hadDockedAlert.current = false;
      }
    }

    // Dock coil glowing animation
    if (dockPadRef.current && (dockPadRef.current.material as THREE.MeshStandardMaterial)) {
      const mat = dockPadRef.current.material as THREE.MeshStandardMaterial;
      if (inDockZone) {
        const pulse = Math.sin(elapsed * 6.0) * 0.4 + 0.8;
        mat.emissive.set('#10B981');
        mat.emissiveIntensity = pulse;
      } else {
        const breathe = Math.sin(elapsed * 2.0) * 0.2 + 0.4;
        mat.emissive.set('#00F0FF');
        mat.emissiveIntensity = breathe;
      }
    }

    // 3b. Automated Sliding Airlock Doors for Cadet Leo
    const distToAirlock = Math.hypot(playerPos[0] - 0, playerPos[2] - 4.5);
    const doorOpen = distToAirlock < 3.6;
    const targetDoorOffset = doorOpen ? 0.95 : 0.45;
    if (leftDoorRef.current) {
      leftDoorRef.current.position.x = THREE.MathUtils.lerp(leftDoorRef.current.position.x, -targetDoorOffset, safeDelta * 6);
    }
    if (rightDoorRef.current) {
      rightDoorRef.current.position.x = THREE.MathUtils.lerp(rightDoorRef.current.position.x, targetDoorOffset, safeDelta * 6);
    }

    // 4. Storm Shutter Servo Actuation
    const targetAngle = isStormShutterClosed ? 0.92 : 0.0;
    shutterAngle.current = THREE.MathUtils.lerp(shutterAngle.current, targetAngle, safeDelta * 2.8);

    shuttersRef.current.forEach((shutter) => {
      if (!shutter) return;
      shutter.rotation.x = shutterAngle.current;
    });

    // 5. Reactive Atmospheric Color
    let targetColor = '#00F0FF';
    let pulseFrequency = 1.8;
    let baseOpacity = 0.16;

    if (oxygen < 19.5) {
      targetColor = '#EF4444';
      pulseFrequency = 6.0;
      baseOpacity = 0.25;
    } else if (temperature < 5.0) {
      targetColor = '#4FD0E3';
      pulseFrequency = 2.0;
      baseOpacity = 0.18;
    } else if (isStormShutterClosed || emergencySaver) {
      targetColor = '#FFB020';
      pulseFrequency = 2.5;
    }

    const pulseFactor = 0.5 + Math.sin(elapsed * pulseFrequency) * 0.25;

    if (atmosphereRef.current) {
      atmosphereRef.current.color.lerp(new THREE.Color(targetColor), safeDelta * 4.0);
      atmosphereRef.current.opacity = baseOpacity + (oxygen < 19.5 ? Math.sin(elapsed * 6.0) * 0.08 : 0);
    }

    if (pointLightRef.current) {
      pointLightRef.current.color.lerp(new THREE.Color(targetColor), safeDelta * 4.0);
      pointLightRef.current.intensity = pulseFactor * 2.2;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* ========================================================
          1. 3D-PRINTED SINTERED FOUNDATION WALLS & INTERIOR FLOOR
          ======================================================== */}
      {/* Heavy Sintered Composite Foundation Ring */}
      <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[3.92, 4.10, 0.55, 32]} />
        <meshStandardMaterial
          color="#1E293B"
          roughness={0.7}
          metalness={0.4}
        />
      </mesh>

      {/* Perimeter Cyan Glowing Accent Strip */}
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[3.94, 3.94, 0.06, 32]} />
        <meshStandardMaterial color="#00D2FF" emissive="#00D2FF" emissiveIntensity={0.8} />
      </mesh>

      {/* Solid Pressurized Interior Floor Deck (Cadet Leo walks on this at y=0.2) */}
      <mesh position={[0, 0.18, 0]} receiveShadow>
        <cylinderGeometry args={[3.80, 3.80, 0.08, 32]} />
        <meshStandardMaterial color="#0F172A" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Interior Deck Guidance Rings */}
      <mesh position={[0, 0.23, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.6, 1.65, 32]} />
        <meshBasicMaterial color="#00D2FF" transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, 0.23, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.8, 2.85, 32]} />
        <meshBasicMaterial color="#00D2FF" transparent opacity={0.3} />
      </mesh>

      {/* Walk-in Entrance Ramp (From dirt y=-0.4 to interior floor y=0.2) */}
      <group position={[0, -0.1, 4.6]}>
        <mesh rotation={[0.26, 0, 0]} receiveShadow>
          <boxGeometry args={[1.8, 0.12, 2.2]} />
          <meshStandardMaterial color="#1E293B" roughness={0.6} metalness={0.5} />
        </mesh>
        {/* Safety Edge LED Strips */}
        {[-0.92, 0.92].map((rx, rIdx) => (
          <mesh key={`ramp-led-${rIdx}`} position={[rx, 0.08, 0]} rotation={[0.26, 0, 0]}>
            <boxGeometry args={[0.08, 0.05, 2.2]} />
            <meshStandardMaterial color="#00D2FF" emissive="#00D2FF" emissiveIntensity={1.2} />
          </mesh>
        ))}
      </group>

      {/* Automated Sliding Airlock Doors */}
      <group position={[0, 0.2, 3.75]}>
        {/* Glowing Airlock Portal Arch Frame */}
        <mesh position={[0, 0.9, 0]}>
          <boxGeometry args={[2.2, 2.0, 0.15]} />
          <meshStandardMaterial color="#0F172A" roughness={0.4} metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.9, 0.08]}>
          <boxGeometry args={[1.8, 1.8, 0.02]} />
          <meshStandardMaterial color="#00D2FF" emissive="#00D2FF" emissiveIntensity={0.6} />
        </mesh>

        {/* Left Sliding Door */}
        <mesh ref={leftDoorRef} position={[-0.45, 0.9, 0.04]} castShadow>
          <boxGeometry args={[0.85, 1.7, 0.08]} />
          <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.2} />
        </mesh>

        {/* Right Sliding Door */}
        <mesh ref={rightDoorRef} position={[0.45, 0.9, 0.04]} castShadow>
          <boxGeometry args={[0.85, 1.7, 0.08]} />
          <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.2} />
        </mesh>
      </group>

      {/* ========================================================
          2. SPACIOUS AEROGEL GEODESIC DOME & CORONA GLOW
          ======================================================== */}
      {/* Outer Pressurized Aerogel Observation Glass */}
      <mesh ref={outerDomeRef} position={[0, 0.58, 0]} castShadow receiveShadow>
        <sphereGeometry args={[3.85, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color="#94A3B8"
          metalness={0.88}
          roughness={0.1}
          transparent
          opacity={0.32}
          flatShading
        />
      </mesh>

      {/* Atmospheric Interior BackSide Corona Glow */}
      <mesh position={[0, 0.58, 0]}>
        <sphereGeometry args={[3.82, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial
          ref={atmosphereRef}
          side={THREE.BackSide}
          color="#00F0FF"
          transparent
          opacity={0.16}
          depthWrite={false}
        />
      </mesh>

      {/* Geodesic Structural Lattice Frame */}
      <mesh position={[0, 0.58, 0]}>
        <sphereGeometry args={[3.86, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color="#334155"
          metalness={0.92}
          roughness={0.2}
          wireframe
        />
      </mesh>

      {/* ========================================================
          3. STORM SHUTTER SHIELD SYSTEM (4 Interlocking Petals)
          ======================================================== */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((baseRot, idx) => (
        <group key={`shutter-pivot-${idx}`} rotation={[0, baseRot, 0]}>
          <group
            ref={(el) => {
              if (el) shuttersRef.current[idx] = el;
            }}
            position={[0, 0.6, 3.86]}
          >
            {/* Curved Armored Titanium Shield Petal */}
            <mesh position={[0, 1.1, 0]} castShadow>
              <boxGeometry args={[2.7, 2.1, 0.12]} />
              <meshStandardMaterial
                color="#334155"
                metalness={0.9}
                roughness={0.25}
              />
            </mesh>
            {/* Safety Amber Hazard Strip */}
            <mesh position={[0, 1.1, 0.07]}>
              <boxGeometry args={[2.55, 0.2, 0.01]} />
              <meshStandardMaterial
                color="#F59E0B"
                emissive="#F59E0B"
                emissiveIntensity={isStormShutterClosed ? 1.0 : 0.2}
              />
            </mesh>
          </group>
        </group>
      ))}

      {/* ========================================================
          4. ROVER CHARGING RAMP WITH INDUCTION DOCK (Toward +Z)
          ======================================================== */}
      <group position={[dockTargetX, -0.15, dockTargetZ - 0.4]}>
        {/* Sloped Ramp Platform */}
        <mesh position={[0, -0.05, 0]} rotation={[0.18, 0, 0]} receiveShadow>
          <boxGeometry args={[2.2, 0.16, 2.8]} />
          <meshStandardMaterial color="#1E293B" roughness={0.8} metalness={0.3} />
        </mesh>

        {/* Safety Guide Rails */}
        {[-1.12, 1.12].map((rx, rIdx) => (
          <mesh key={`rail-${rIdx}`} position={[rx, 0.14, 0]} rotation={[0.18, 0, 0]}>
            <boxGeometry args={[0.08, 0.22, 2.8]} />
            <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.2} />
          </mesh>
        ))}

        {/* Magnetic Induction Charging Pad */}
        <mesh
          ref={dockPadRef}
          position={[0, 0.18, -0.7]}
          rotation={[-Math.PI / 2 + 0.18, 0, 0]}
        >
          <ringGeometry args={[0.4, 0.85, 20]} />
          <meshStandardMaterial
            color="#0F172A"
            emissive="#00F0FF"
            emissiveIntensity={0.6}
            metalness={0.8}
          />
        </mesh>

        {/* Chevron Guide Strips */}
        {[-0.4, 0, 0.4].map((cz, cIdx) => (
          <mesh key={`chev-${cIdx}`} position={[0, 0.07, cz]} rotation={[-Math.PI / 2 + 0.18, 0, 0]}>
            <planeGeometry args={[0.8, 0.1]} />
            <meshBasicMaterial
              color={isRoverDocked ? '#10B981' : '#F59E0B'}
              transparent
              opacity={0.8}
            />
          </mesh>
        ))}
      </group>

      {/* ========================================================
          5. ROTATING SATELLITE DISH & COMMS MAST
          ======================================================== */}
      <group position={[-2.8, 0.45, -2.8]}>
        {/* Truss Mast */}
        <mesh position={[0, 1.5, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.12, 3.0, 8]} />
          <meshStandardMaterial color="#64748B" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Turret Box */}
        <mesh position={[0, 3.05, 0]}>
          <boxGeometry args={[0.36, 0.3, 0.36]} />
          <meshStandardMaterial color="#1E293B" metalness={0.85} roughness={0.2} />
        </mesh>
        {/* Rotating Dish */}
        <group ref={dishRef} position={[0, 3.25, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.85, 0.14, 0.22, 24]} />
            <meshStandardMaterial color="#E2E8F0" metalness={0.8} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0, 0.55]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.5, 8]} />
            <meshStandardMaterial color="#D97706" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh ref={beaconRef} position={[0, 0.55, 0]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color="#EF4444" emissive="#EF4444" emissiveIntensity={1.2} />
          </mesh>
        </group>
      </group>

      {/* ========================================================
          6. PRESSURIZED AIRLOCK ACCESS MODULE (Toward +X)
          ======================================================== */}
      <group position={[3.85, 0.55, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.65, 0.65, 1.6, 16]} />
          <meshStandardMaterial color="#64748B" metalness={0.8} roughness={0.25} />
        </mesh>
        {/* Hatch */}
        <mesh position={[0, -0.81, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.08, 16]} />
          <meshStandardMaterial color="#0F172A" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* LED Indicator */}
        <mesh position={[0.35, -0.83, 0]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={1.0} />
        </mesh>
      </group>

      {/* ========================================================
          7. PERIMETER SAFETY FLOODLIGHTS
          ======================================================== */}
      {[
        { x: 4.6, z: -3.8 },
        { x: -4.6, z: -3.8 },
        { x: -4.8, z: 3.6 },
        { x: 4.8, z: 3.6 }
      ].map((pos, pIdx) => (
        <group key={`flood-${pIdx}`} position={[pos.x, -0.4, pos.z]}>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 1.0, 8]} />
            <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.3} />
          </mesh>
          <mesh position={[0, 1.02, 0]}>
            <boxGeometry args={[0.18, 0.1, 0.18]} />
            <meshStandardMaterial color="#E2E8F0" emissive="#FEF08A" emissiveIntensity={1.2} />
          </mesh>
          <pointLight
            color="#FFFBEB"
            intensity={0.7}
            distance={7.0}
            decay={2}
            position={[0, 1.02, 0]}
          />
        </group>
      ))}

      {/* Main Internal Life Support Point Light */}
      <pointLight
        ref={pointLightRef}
        color="#00F0FF"
        intensity={1.4}
        distance={9}
        decay={2}
        position={[0, 1.6, 0]}
      />

      {/* Visual Evolution Level 3+: Circulating Glowing Water Conduits Ring */}
      {domeEvolutionLevel >= 3 && (
        <group position={[0, 0.45, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[3.82, 0.04, 8, 32]} />
            <meshStandardMaterial
              color="#00F0FF"
              emissive="#00F0FF"
              emissiveIntensity={1.8}
              roughness={0.1}
            />
          </mesh>
        </group>
      )}

      {/* Visual Evolution Level 5: Ares-1 Sky Laser Landing Beacon Column */}
      {domeEvolutionLevel >= 5 && (
        <group position={[0, 4.3, 0]}>
          <mesh position={[0, 15, 0]}>
            <cylinderGeometry args={[0.08, 0.25, 30, 12]} />
            <meshBasicMaterial color="#00F0FF" transparent opacity={0.65} />
          </mesh>
          <pointLight color="#00F0FF" intensity={3.5} distance={15} decay={2} />
        </group>
      )}
    </group>
  );
};

export default HabitatDome;
