import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMissionStore } from '../state/store';
import { RegionId } from '../contract';

const REGIONS = [
  {
    id: 'dust' as RegionId,
    name: 'Wind Basin',
    coords: [0, 0, 0] as [number, number, number],
    color: '#FFB800',
    landmark: 'Wind Tower',
    focalPoints: [
      { id: 'D1', title: 'Sand Streaks Wake', offset: [15, 0, -10] as [number, number, number] },
      { id: 'D2', title: 'Dusted Solar Mast', offset: [-8, 0, 12] as [number, number, number] },
      { id: 'D3', title: 'Dust Devil Tracks', offset: [22, 0, 18] as [number, number, number] },
    ],
    branches: [
      { id: 'D_opt1', title: 'Dune Crest Post', perkId: 'perk_dust_arrows', offset: [-25, 0, -20] as [number, number, number] },
      { id: 'D_opt2', title: 'Space Weather Lab', perkId: 'perk_dust_preview', offset: [28, 0, -22] as [number, number, number] },
    ]
  },
  {
    id: 'ice' as RegionId,
    name: 'Sealed Ice Cliff',
    coords: [210, 0, -180] as [number, number, number],
    color: '#00D2FF',
    landmark: 'Glacier Core Rig',
    focalPoints: [
      { id: 'I1', title: 'Protective Debris Mantle', offset: [-15, 0, 15] as [number, number, number] },
      { id: 'I2', title: 'SHARAD Radar Reflection', offset: [15, 0, -15] as [number, number, number] },
      { id: 'I3', title: 'Water Ice vs CO2 Frost', offset: [0, 0, 10] as [number, number, number] },
    ],
    branches: [
      { id: 'I_opt1', title: 'Water Reclamation Station', perkId: 'perk_ice_band', offset: [25, 0, 20] as [number, number, number] },
      { id: 'I_opt2', title: 'Rehydration Nutrition Lab', perkId: 'perk_ice_mnemonic', offset: [-20, 0, -20] as [number, number, number] },
    ]
  },
  {
    id: 'lake' as RegionId,
    name: 'Ancient Lake Shore',
    coords: [200, 0, 170] as [number, number, number],
    color: '#2A9D8F',
    landmark: 'Telemetry Arch',
    focalPoints: [
      { id: 'L1', title: 'Delta Mudstone Cross-Bedding', offset: [-15, 0, -15] as [number, number, number] },
      { id: 'L2', title: 'Robotic Arm Diagnostics', offset: [15, 0, 15] as [number, number, number] },
      { id: 'L3', title: 'Witness Tube Audit', offset: [5, 0, 0] as [number, number, number] },
    ],
    branches: [
      { id: 'L_opt1', title: 'Dry Meander Overlook', perkId: 'perk_lake_filter', offset: [30, 0, 20] as [number, number, number] },
      { id: 'L_opt2', title: 'Sample Caching Protocols', perkId: 'perk_lake_check', offset: [-30, 0, 5] as [number, number, number] },
    ]
  }
];

/**
 * Sol Robot Companion - Floating autonomous AI sphere accompanying Cadet Leo
 */
function SolRobotCompanion() {
  const solRef = useRef<THREE.Group>(null);
  const activeControl = useMissionStore((s) => s.activeControl);
  const currentRegion = useMissionStore((s) => s.currentRegion);
  const leoPose = useMissionStore((s) => s.leoPose);
  const roverPoses = useMissionStore((s) => s.roverPoses);

  useFrame((state) => {
    if (!solRef.current) return;
    const t = state.clock.getElapsedTime();

    // Target position depends on whether Leo is on foot or driving rover
    const targetPose = activeControl === 'rover'
      ? roverPoses[currentRegion] || [0, 0, 0]
      : leoPose;

    // Smooth hover alongside with sinusoidal bobbing
    const hoverY = 1.4 + Math.sin(t * 2.5) * 0.15;
    const targetX = targetPose[0] + 1.2 + Math.cos(t * 1.2) * 0.2;
    const targetZ = targetPose[2] + 0.8 + Math.sin(t * 1.2) * 0.2;

    solRef.current.position.lerp(new THREE.Vector3(targetX, hoverY, targetZ), 0.08);
    solRef.current.rotation.y = t * 0.8;
  });

  return (
    <group ref={solRef}>
      {/* Sol Body - Matte white sphere with orange trim */}
      <mesh castShadow>
        <sphereGeometry args={[0.24, 16, 16]} />
        <meshStandardMaterial color="#F4F1EA" roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Blue sensor lens eye */}
      <mesh position={[0, 0.05, 0.2]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color="#00D2FF" />
      </mesh>

      {/* Soft blue luminescent glow point light */}
      <pointLight color="#00D2FF" intensity={0.4} distance={4} />

      {/* Hover propulsion ring */}
      <mesh position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.02, 8, 24]} />
        <meshStandardMaterial color="#FF5A1F" />
      </mesh>
    </group>
  );
}

/**
 * FiveFrontiersWorld - Manages 3D landmarks, outposts, and interactive points
 */
export const FiveFrontiersWorld: React.FC = () => {
  const currentRegion = useMissionStore((s) => s.currentRegion);
  const bases = useMissionStore((s) => s.bases);
  const surveys = useMissionStore((s) => s.surveys);
  const discoverBase = useMissionStore((s) => s.discoverBase);
  const recordObservation = useMissionStore((s) => s.recordObservation);
  const recordBranch = useMissionStore((s) => s.recordBranch);
  const setNotification = useMissionStore((s) => s.setNotification);
  const activeControl = useMissionStore((s) => s.activeControl);
  const leoPose = useMissionStore((s) => s.leoPose);
  const roverPoses = useMissionStore((s) => s.roverPoses);

  // Proximity polling in frame loop
  useFrame(() => {
    const playerPos = activeControl === 'rover'
      ? roverPoses[currentRegion] || [0, 0, 0]
      : leoPose;

    // Check distance to outposts for discovery
    for (const reg of REGIONS) {
      const dx = playerPos[0] - reg.coords[0];
      const dz = playerPos[2] - reg.coords[2];
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 45 && !bases[reg.id]?.isDiscovered) {
        discoverBase(reg.id);
      }
    }
  });

  return (
    <group name="FiveFrontiersWorld">
      {/* Sol AI Companion */}
      <SolRobotCompanion />

      {/* 5 Regional Outposts and Landmarks */}
      {REGIONS.map((reg) => {
        const isCurrent = currentRegion === reg.id;
        const survey = surveys[reg.id];

        return (
          <group key={reg.id} position={reg.coords}>
            {/* Outpost Habitat Module (Rendered for outer bases; dust at [0,0,0] uses main HabitatDome) */}
            {reg.id !== 'dust' && (
              <group position={[0, 0, 0]}>
                {/* Modern Glowing Outpost Dome Shell */}
                <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
                  <sphereGeometry args={[4.2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.7} />
                </mesh>
                {/* Bioluminescent Aerogel Ring */}
                <mesh position={[0, 1.8, 0]}>
                  <sphereGeometry args={[4.25, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  <meshBasicMaterial color={reg.color} transparent opacity={0.25} wireframe />
                </mesh>

                {/* Airlock Vestibule with Glowing Frame */}
                <mesh position={[0, 0.9, 4.2]} castShadow>
                  <boxGeometry args={[2.2, 1.8, 1.8]} />
                  <meshStandardMaterial color="#0F172A" roughness={0.3} metalness={0.8} />
                </mesh>
                <mesh position={[0, 0.9, 5.11]}>
                  <boxGeometry args={[1.6, 1.6, 0.05]} />
                  <meshStandardMaterial color={reg.color} emissive={reg.color} emissiveIntensity={0.8} />
                </mesh>

                {/* Base Identification Terminal Beacon */}
                <mesh position={[0, 0.6, 5.8]}>
                  <cylinderGeometry args={[0.15, 0.2, 1.2, 12]} />
                  <meshStandardMaterial color="#1E293B" metalness={0.8} />
                </mesh>
                <mesh position={[0, 1.3, 5.8]}>
                  <sphereGeometry args={[0.22, 12, 12]} />
                  <meshStandardMaterial color={reg.color} emissive={reg.color} emissiveIntensity={1.2} />
                </mesh>
                <pointLight position={[0, 2, 5.8]} color={reg.color} intensity={1.2} distance={12} />
                {isCurrent && <pointLight position={[0, 6, 0]} color="#00D2FF" intensity={1.5} distance={20} />}
              </group>
            )}

            {/* Region Landmark Silhouette */}
            {reg.id === 'dust' && (
              /* Wind Anemometer Tower */
              <group position={[20, 0, -20]}>
                <mesh position={[0, 6, 0]}>
                  <cylinderGeometry args={[0.15, 0.5, 12, 6]} />
                  <meshStandardMaterial color="#E2E8F0" metalness={0.5} />
                </mesh>
                {/* Spinning Anemometer Cups */}
                <mesh position={[0, 12.2, 0]}>
                  <sphereGeometry args={[0.6, 8, 8]} />
                  <meshStandardMaterial color="#FFB800" />
                </mesh>
              </group>
            )}

            {reg.id === 'ice' && (
              /* Glacial Core Drill Rig */
              <group position={[-20, 0, 20]}>
                <mesh position={[0, 4, 0]}>
                  <boxGeometry args={[1.5, 8, 1.5]} />
                  <meshStandardMaterial color="#00D2FF" metalness={0.4} />
                </mesh>
                <mesh position={[0, 8.2, 0]}>
                  <cylinderGeometry args={[0.8, 0.8, 1, 12]} />
                  <meshStandardMaterial color="#F4F1EA" />
                </mesh>
              </group>
            )}

            {reg.id === 'lake' && (
              /* Telemetry Transceiver Arch */
              <group position={[-25, 0, -20]}>
                <mesh position={[0, 4, 0]} rotation={[0, Math.PI / 4, 0]}>
                  <torusGeometry args={[4, 0.35, 8, 24, Math.PI]} />
                  <meshStandardMaterial color="#2A9D8F" metalness={0.6} />
                </mesh>
              </group>
            )}

            {/* Focal Points Beacons */}
            {reg.focalPoints.map((fp) => {
              const isLogged = survey?.focalPointsDone.includes(fp.id);
              return (
                <group
                  key={fp.id}
                  position={fp.offset}
                  onClick={(e) => {
                    e.stopPropagation();
                    const playerPos = activeControl === 'rover'
                      ? roverPoses[currentRegion] || [0, 0, 0]
                      : leoPose;
                    const beaconX = reg.coords[0] + fp.offset[0];
                    const beaconZ = reg.coords[2] + fp.offset[2];
                    const dist = Math.hypot(playerPos[0] - beaconX, playerPos[2] - beaconZ);
                    if (dist > 28) {
                      setNotification(`Target [${fp.title}] is out of sensor range (${Math.round(dist)}m away). Navigate closer to survey.`);
                      return;
                    }
                    recordObservation(reg.id, fp.id);
                  }}
                >
                  <mesh position={[0, 0.5, 0]}>
                    <cylinderGeometry args={[0.15, 0.25, 1, 8]} />
                    <meshStandardMaterial color="#1C2026" />
                  </mesh>
                  <mesh position={[0, 1.2, 0]}>
                    <octahedronGeometry args={[0.35]} />
                    <meshBasicMaterial color={isLogged ? '#48BB78' : reg.color} />
                  </mesh>
                  <pointLight position={[0, 1.5, 0]} color={reg.color} intensity={0.4} distance={6} />
                </group>
              );
            })}

            {/* Optional Branches Beacons */}
            {reg.branches.map((br) => {
              const isDone = survey?.optionalBranchesDone.includes(br.id);
              return (
                <group
                  key={br.id}
                  position={br.offset}
                  onClick={(e) => {
                    e.stopPropagation();
                    const playerPos = activeControl === 'rover'
                      ? roverPoses[currentRegion] || [0, 0, 0]
                      : leoPose;
                    const branchX = reg.coords[0] + br.offset[0];
                    const branchZ = reg.coords[2] + br.offset[2];
                    const dist = Math.hypot(playerPos[0] - branchX, playerPos[2] - branchZ);
                    if (dist > 28) {
                      setNotification(`Branch site [${br.title}] is out of range (${Math.round(dist)}m away). Approach site to map advantage.`);
                      return;
                    }
                    recordBranch(reg.id, br.id, br.perkId);
                  }}
                >
                  <mesh position={[0, 0.4, 0]}>
                    <cylinderGeometry args={[0.1, 0.2, 0.8, 8]} />
                    <meshStandardMaterial color="#1C2026" />
                  </mesh>
                  <mesh position={[0, 1.0, 0]}>
                    <dodecahedronGeometry args={[0.25]} />
                    <meshBasicMaterial color={isDone ? '#38B2AC' : '#ECC94B'} />
                  </mesh>
                </group>
              );
            })}
          </group>
        );
      })}
    </group>
  );
};
