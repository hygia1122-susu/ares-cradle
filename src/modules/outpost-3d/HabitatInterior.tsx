import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useOutpostStore } from '@/modules/store/useOutpostStore';

/**
 * NASA Mars Habitat Interior (Ares Cradle v3.0 Multi-Zone Architecture)
 * - Zone 1: Central Command Hologram Table (Rotating Mars 3D Globe with Moons)
 * - Zone 2: Sabatier Oxygen Generator (Bubbling Gas LED Cylinders)
 * - Zone 3: Multi-Tier Vertical Hydroponic Farm (Violet/Green Bio-Grow Lights)
 * - Zone 4: Chemical Specimen Analysis Workbench (Centrifuge & Diagnostic Laser)
 * - Spiral Staircase & 2nd-Story Stargazing Observation Deck with Telescope
 * - Pressurized Airlock Decontamination Mist Effect
 */
export const HabitatInterior: React.FC = () => {
  const marsHoloRef = useRef<THREE.Group>(null);
  const sabatierBubblesRef = useRef<THREE.Mesh>(null);
  const centrifugeRef = useRef<THREE.Mesh>(null);
  const mistParticlesRef = useRef<THREE.Points>(null);

  const oxygen = useOutpostStore((state) => state.oxygen);
  const isInsideHabitat = useOutpostStore((state) => state.isInsideHabitat);
  const domeEvolutionLevel = useOutpostStore((state) => state.domeEvolutionLevel);

  // Decontamination mist particle buffers
  const mistCount = 35;
  const mistPositions = useMemo(() => new Float32Array(mistCount * 3), []);
  const mistLifetimes = useRef(new Float32Array(mistCount));

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const safeDelta = Math.min(delta, 0.1);

    // 1. Central Mars Hologram Globe Rotation
    if (marsHoloRef.current) {
      marsHoloRef.current.rotation.y += safeDelta * 0.35;
      marsHoloRef.current.position.y = 1.15 + Math.sin(t * 1.5) * 0.03;
    }

    // 2. Sabatier Bubble Pulsing Effect
    if (sabatierBubblesRef.current) {
      sabatierBubblesRef.current.rotation.y += safeDelta * 1.5;
      const pulse = Math.sin(t * 4.0) * 0.15 + 0.85;
      sabatierBubblesRef.current.scale.set(pulse, 1.0, pulse);
    }

    // 3. Chemical Analysis Centrifuge Spin
    if (centrifugeRef.current) {
      centrifugeRef.current.rotation.y += safeDelta * 6.0;
    }

    // 4. Airlock Decontamination Mist (Active when player is near airlock / inside)
    if (mistParticlesRef.current && isInsideHabitat) {
      const geo = mistParticlesRef.current.geometry;
      const pos = geo.attributes.position.array as Float32Array;

      for (let i = 0; i < mistCount; i++) {
        mistLifetimes.current[i] += safeDelta * 1.5;
        if (mistLifetimes.current[i] > 1.0) {
          mistLifetimes.current[i] = Math.random() * 0.2;
          pos[i * 3] = (Math.random() - 0.5) * 0.8;
          pos[i * 3 + 1] = 0.55 + Math.random() * 1.2;
          pos[i * 3 + 2] = 3.7 + (Math.random() - 0.5) * 0.4;
        } else {
          pos[i * 3 + 2] -= safeDelta * 0.3; // drift inward into dome
          pos[i * 3 + 1] += safeDelta * 0.12; // rise gently
        }
      }
      geo.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* ========================================================
          ZONE 1: CENTRAL COMMAND TABLE & 3D ROTATING MARS GLOBE
          ======================================================== */}
      <group position={[0, 0.52, 0]}>
        {/* Hexagonal Command Console Base */}
        <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.95, 1.15, 0.45, 6]} />
          <meshStandardMaterial color="#0F172A" roughness={0.3} metalness={0.8} />
        </mesh>

        {/* 3 Angled Mission Telemetry Holographic Displays */}
        {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((angle, idx) => (
          <group key={`terminal-screen-${idx}`} rotation={[0, angle, 0]} position={[0, 0.36, 0]}>
            <mesh position={[0, 0.14, 0.82]} rotation={[-0.45, 0, 0]}>
              <boxGeometry args={[0.46, 0.26, 0.02]} />
              <meshStandardMaterial color="#00D2FF" emissive="#00D2FF" emissiveIntensity={1.2} roughness={0.1} />
            </mesh>
            <mesh position={[0, 0.14, 0.81]} rotation={[-0.45, 0, 0]}>
              <boxGeometry args={[0.50, 0.30, 0.02]} />
              <meshStandardMaterial color="#0F172A" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        ))}

        {/* Holo Projector Ring */}
        <mesh position={[0, 0.36, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.65, 0.88, 24]} />
          <meshStandardMaterial
            color="#00F0FF"
            emissive="#00F0FF"
            emissiveIntensity={1.8}
            roughness={0.2}
          />
        </mesh>

        {/* Floating Rotating 3D Mars Globe Hologram */}
        <group ref={marsHoloRef} position={[0, 1.15, 0]}>
          <mesh>
            <sphereGeometry args={[0.42, 16, 12]} />
            <meshStandardMaterial
              color="#00F0FF"
              emissive="#00F0FF"
              emissiveIntensity={0.9}
              wireframe
              transparent
              opacity={0.8}
            />
          </mesh>
          {/* Equatorial Orbit Ring */}
          <mesh rotation={[0.4, 0, 0]}>
            <ringGeometry args={[0.55, 0.58, 32]} />
            <meshBasicMaterial color="#38BDF8" side={THREE.DoubleSide} transparent opacity={0.6} />
          </mesh>
          {/* Phobos Blip */}
          <mesh position={[0.62, 0.1, 0]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial color="#F59E0B" />
          </mesh>
          {/* Deimos Blip (Unlocked at Evolution Level >= 2) */}
          {domeEvolutionLevel >= 2 && (
            <mesh position={[-0.82, -0.06, 0.15]}>
              <sphereGeometry args={[0.03, 8, 8]} />
              <meshBasicMaterial color="#38BDF8" />
            </mesh>
          )}
        </group>
      </group>

      {/* ========================================================
          ZONE 2: SABATIER OXYGEN ELECTROLYSIS SCRUBBER (West)
          ======================================================== */}
      <group position={[-2.4, 0.52, 0]}>
        {/* Heavy Machine Housing Base */}
        <mesh position={[0, 0.25, 0]} castShadow>
          <boxGeometry args={[1.2, 0.7, 0.9]} />
          <meshStandardMaterial color="#1E293B" metalness={0.85} roughness={0.2} />
        </mesh>

        {/* Dual Transparent Electrolysis Columns */}
        {[-0.32, 0.32].map((cx, cIdx) => (
          <group key={`col-${cIdx}`} position={[cx, 0.95, 0]}>
            {/* Outer Glass Cylinder */}
            <mesh>
              <cylinderGeometry args={[0.16, 0.16, 0.9, 16]} />
              <meshStandardMaterial
                color="#67E8F9"
                transparent
                opacity={0.35}
                roughness={0.1}
                metalness={0.9}
              />
            </mesh>
            {/* Inner Bubbling Fluid Core */}
            <mesh ref={cIdx === 0 ? sabatierBubblesRef : null} position={[0, 0, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.82, 12]} />
              <meshStandardMaterial
                color="#06B6D4"
                emissive="#00F0FF"
                emissiveIntensity={oxygen > 19.5 ? 1.0 : 0.3}
                roughness={0.2}
              />
            </mesh>
          </group>
        ))}

        {/* Digital Telemetry Panel & Pressure Gauges */}
        <mesh position={[0, 0.45, 0.46]}>
          <planeGeometry args={[0.8, 0.25]} />
          <meshStandardMaterial color="#0284C7" emissive="#0284C7" emissiveIntensity={0.6} />
        </mesh>
      </group>

      {/* ========================================================
          ZONE 3: MULTI-TIER VERTICAL HYDROPONIC FARM (North)
          ======================================================== */}
      <group position={[0, 0.52, -2.4]}>
        {/* Hydroponic Rack Frame */}
        <mesh position={[0, 0.9, 0]} castShadow>
          <boxGeometry args={[2.4, 1.8, 0.5]} />
          <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.2} wireframe />
        </mesh>

        {/* 3 Tiered Planter Trays */}
        {[0.3, 0.85, 1.4].map((ty, tIdx) => (
          <group key={`tier-${tIdx}`} position={[0, ty, 0]}>
            {/* Planter Basin */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[2.2, 0.14, 0.45]} />
              <meshStandardMaterial color="#0F172A" roughness={0.6} />
            </mesh>
            {/* Lush Martian Microgreens Foliage */}
            <mesh position={[0, 0.12, 0]}>
              <boxGeometry args={[2.1, 0.1, 0.38]} />
              <meshStandardMaterial
                color={domeEvolutionLevel >= 3 ? '#16A34A' : '#15803D'}
                emissive={domeEvolutionLevel >= 3 ? '#22C55E' : '#15803D'}
                emissiveIntensity={domeEvolutionLevel >= 3 ? 1.0 : 0.5}
                roughness={0.4}
              />
            </mesh>
            {/* Violet/Pink Photonic LED Strip */}
            <mesh position={[0, 0.32, 0]}>
              <boxGeometry args={[2.1, 0.03, 0.06]} />
              <meshBasicMaterial color="#D946EF" />
            </mesh>
          </group>
        ))}
      </group>

      {/* ========================================================
          ZONE 4: CHEMICAL SPECIMEN ANALYZER WORKBENCH (South-West)
          ======================================================== */}
      <group position={[-1.7, 0.52, 1.7]} rotation={[0, Math.PI / 4, 0]}>
        {/* Lab Countertop Desk */}
        <mesh position={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[1.5, 0.6, 0.7]} />
          <meshStandardMaterial color="#1E293B" metalness={0.8} roughness={0.25} />
        </mesh>

        {/* Spinning Centrifuge Unit */}
        <mesh ref={centrifugeRef} position={[-0.4, 0.68, 0]}>
          <cylinderGeometry args={[0.18, 0.22, 0.16, 12]} />
          <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.15} />
        </mesh>

        {/* Specimen Vial Rack */}
        <mesh position={[0.35, 0.65, 0]}>
          <boxGeometry args={[0.4, 0.1, 0.25]} />
          <meshStandardMaterial color="#334155" metalness={0.7} />
        </mesh>
        {[-0.12, 0, 0.12].map((vx, vIdx) => (
          <mesh key={`vial-${vIdx}`} position={[0.35 + vx, 0.75, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.14, 8]} />
            <meshStandardMaterial
              color="#F59E0B"
              emissive="#F59E0B"
              emissiveIntensity={0.9}
              transparent
              opacity={0.8}
            />
          </mesh>
        ))}

        {/* Diagnostic Laser Scan Line */}
        <mesh position={[0, 0.72, 0]}>
          <boxGeometry args={[0.02, 0.01, 0.4]} />
          <meshBasicMaterial color="#00F0FF" />
        </mesh>
      </group>

      {/* ========================================================
          SPIRAL STAIRCASE & 2ND-STORY STARGAZING OBSERVATION DECK
          ======================================================== */}
      <group position={[1.4, 0.52, -1.0]}>
        {/* Central Spiral Mast */}
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 1.8, 12]} />
          <meshStandardMaterial color="#64748B" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* Spiral Step Treads */}
        {[0, 1, 2, 3, 4, 5, 6].map((stepIdx) => {
          const stepAngle = (stepIdx / 7) * Math.PI * 1.3;
          const stepY = 0.15 + stepIdx * 0.18;
          const radius = 0.45;
          return (
            <mesh
              key={`step-${stepIdx}`}
              position={[Math.cos(stepAngle) * radius, stepY, Math.sin(stepAngle) * radius]}
              rotation={[0, -stepAngle, 0]}
            >
              <boxGeometry args={[0.42, 0.04, 0.16]} />
              <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.3} />
            </mesh>
          );
        })}

        {/* Elevated 2nd-Story Observation Deck (y = 1.45) */}
        <group position={[0.6, 1.42, 0.8]}>
          {/* Deck Floor Plate */}
          <mesh>
            <cylinderGeometry args={[1.1, 1.1, 0.08, 20]} />
            <meshStandardMaterial color="#0F172A" metalness={0.85} roughness={0.25} />
          </mesh>

          {/* Transparent Glass Safety Railing */}
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[1.08, 1.08, 0.45, 20, 1, true]} />
            <meshStandardMaterial
              color="#00F0FF"
              transparent
              opacity={0.3}
              roughness={0.1}
              metalness={0.9}
            />
          </mesh>

          {/* Astronomical Stargazing Telescope on Tripod */}
          <group position={[0, 0.35, 0.4]} rotation={[-0.45, 0.3, 0]}>
            {/* Telescope Tube (Pointed Upward Toward Glass Dome Roof) */}
            <mesh>
              <cylinderGeometry args={[0.06, 0.09, 0.75, 16]} />
              <meshStandardMaterial color="#E2E8F0" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Telescope Lens */}
            <mesh position={[0, 0.38, 0]}>
              <cylinderGeometry args={[0.062, 0.062, 0.02, 16]} />
              <meshBasicMaterial color="#38BDF8" />
            </mesh>
            {/* Tripod Legs */}
            <mesh position={[0, -0.3, 0]}>
              <cylinderGeometry args={[0.02, 0.18, 0.4, 3]} />
              <meshStandardMaterial color="#1E293B" metalness={0.8} />
            </mesh>
          </group>
        </group>
      </group>

      {/* ========================================================
          AIRLOCK DECONTAMINATION MIST PARTICLE SYSTEM
          ======================================================== */}
      <points ref={mistParticlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[mistPositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.12}
          color="#38BDF8"
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </points>
    </group>
  );
};

export default HabitatInterior;
