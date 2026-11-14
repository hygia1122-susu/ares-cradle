import React from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { realMaterials } from '../../game/art/realism/materials';
import { OUTER_HERO_ROCKS, sampleWorldGround, WORLD_REGIONS, type OuterHeroLandmark, type OuterRegion, type RegionId } from './worldRegions';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const ROCK = new THREE.DodecahedronGeometry(1, 0);
const DOME = new THREE.SphereGeometry(3.05, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
const DOME_RIM = new THREE.TorusGeometry(3.05, 0.045, 6, 32);
const BARREL = new THREE.CylinderGeometry(0.18, 0.23, 1, 10);
const DUST_DEVIL_CONES = Array.from({ length: 4 }, (_, index) => new THREE.ConeGeometry(0.34 - index * 0.045, 1.1, 7));
const METAL = realMaterials.frame;
const DARK = realMaterials.dark;
const SHELL = realMaterials.shell;
const SHADE = realMaterials.shellShade;
const SEAM = realMaterials.seam;
const AMBER = realMaterials.amber;
const GLASS = realMaterials.glass;
const FOIL = realMaterials.foil;

const ROCK_MATERIALS = Object.fromEntries(WORLD_REGIONS.map(({ id, palette }) => [id, new THREE.MeshStandardMaterial({
  color: palette.rock, roughness: 0.93, metalness: 0.05, flatShading: true,
})])) as Record<RegionId, THREE.MeshStandardMaterial>;
const ACCENT_MATERIALS = Object.fromEntries(WORLD_REGIONS.map(({ id, palette }) => [id, new THREE.MeshStandardMaterial({
  color: palette.accent, roughness: 0.72, metalness: 0.2, flatShading: true,
})])) as Record<RegionId, THREE.MeshStandardMaterial>;
const regionRock = (region: OuterRegion) => ROCK_MATERIALS[region.id];
const regionAccent = (region: OuterRegion) => ACCENT_MATERIALS[region.id];

function Beam({ from, to, radius = 0.045, material = METAL }: {
  from: [number, number, number]; to: [number, number, number]; radius?: number; material?: THREE.Material;
}) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const direction = b.clone().sub(a);
  const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  const geometry = React.useMemo(() => new THREE.CylinderGeometry(radius, radius, direction.length(), 7), [radius, direction.x, direction.y, direction.z]);
  React.useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh position={a.add(b).multiplyScalar(0.5)} quaternion={orientation} geometry={geometry} material={material} castShadow />;
}

function RockCluster({ material, landmark }: { material: THREE.Material; landmark: OuterHeroLandmark }) {
  return <group name="hero-rock-cluster">{OUTER_HERO_ROCKS[landmark.id].map(([x, y, z, sx, sy, sz], index) => <mesh key={index} geometry={ROCK} material={material}
    position={[x, y + sy * 0.43, z]} scale={[sx, sy, sz]} rotation={[0.12 * index, 0.24 * index, 0.08 * index]} castShadow receiveShadow />)}</group>;
}

function PracticalLamp({ position }: { position: [number, number, number] }) {
  return <group name="practical-lamp" position={position}>
    <mesh geometry={BOX} material={METAL} scale={[0.27, 0.045, 0.045]} />
    <mesh geometry={BOX} material={METAL} scale={[0.045, 0.27, 0.045]} />
    <mesh geometry={BOX} material={AMBER} scale={[0.12, 0.12, 0.12]} />
    <pointLight color="#ffd09a" intensity={4} distance={12} decay={2} />
  </group>;
}

function ImpactRadome({ landmark, region }: { landmark: OuterHeroLandmark; region: OuterRegion }) {
  const rock = regionRock(region);
  const accent = regionAccent(region);
  const meridians = Array.from({ length: 10 }, (_, index) => index * Math.PI / 5);
  return <group name="impact-radome-and-instrument-bay" position={[landmark.position.x, sampleWorldGround(landmark.position.x, landmark.position.z), landmark.position.z]} rotation={[0, landmark.yaw, 0]}>
    <RockCluster material={rock} landmark={landmark} />
    <PracticalLamp position={[0, 2.95, 0]} />
    <mesh geometry={DOME} material={SHELL} position={[0, 0.13, 0]} castShadow receiveShadow />
    <mesh geometry={DOME_RIM} material={METAL} position={[0, 0.13, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow />
    {meridians.map((angle) => Array.from({ length: 6 }, (_, segment) => {
      const arcPoint = (t: number): [number, number, number] => [
        3.04 * Math.cos(angle) * Math.cos(t), 0.14 + 2.96 * Math.sin(t),
        3.04 * Math.sin(angle) * Math.cos(t),
      ];
      return <Beam key={`${angle}-${segment}`} from={arcPoint(segment * Math.PI / 12)}
        to={arcPoint((segment + 1) * Math.PI / 12)} radius={0.032} />;
    }))}
    {Array.from({ length: 8 }, (_, index) => <mesh key={index} geometry={BOX} material={SEAM}
      position={[0, 0.085, 2.82]} rotation={[0, index * Math.PI / 4, 0]} scale={[0.16, 0.11, 0.52]} />)}
    <group name="instrument-bay" position={[3.12, 0, 0.28]}>
      <mesh geometry={BOX} material={DARK} position={[0, 0.75, 0]} scale={[1.36, 1.42, 1.18]} castShadow />
      <mesh geometry={BOX} material={SHADE} position={[0, 1.5, 0]} scale={[1.5, 0.11, 1.28]} castShadow />
      <mesh geometry={BOX} material={GLASS} position={[0, 0.89, 0.605]} scale={[0.83, 0.72, 0.035]} />
      <mesh geometry={BOX} material={accent} position={[0, 1.43, 0.61]} scale={[0.92, 0.055, 0.045]} />
      <Beam from={[-0.62, 0.12, -0.45]} to={[-0.62, 0.48, -0.45]} radius={0.036} material={METAL} />
      <Beam from={[0.62, 0.12, -0.45]} to={[0.62, 0.48, -0.45]} radius={0.036} material={METAL} />
    </group>
    <mesh geometry={BOX} material={FOIL} position={[-3.82, 0.92, -0.02]} rotation={[0, 0, -0.16]} scale={[0.18, 1.48, 1.68]} castShadow />
    <group name="ejecta-fan-strata">
      {[-2.1, -0.7, 0.7, 2.1].map((z, index) => <mesh key={index} geometry={BOX} material={index % 2 ? rock : SEAM}
        position={[-3.62, 0.11, z]} rotation={[0, -0.14, 0]} scale={[1.4, 0.13, 0.14]} />)}
    </group>
    <mesh geometry={BOX} material={DARK} position={[0, 0.06, 0]} scale={[2.1, 0.13, 2.15]} />
  </group>;
}

function WeatherTruss({ landmark, region }: { landmark: OuterHeroLandmark; region: OuterRegion }) {
  const accent = regionAccent(region);
  const dustDevil = React.useRef<THREE.Group>(null);
  const dustDevilBase = new THREE.Vector3(6.6, 0, -4.4);
  useFrame(({ clock }) => {
    if (!dustDevil.current) return;
    const phase = clock.elapsedTime * 0.22;
    dustDevil.current.position.set(dustDevilBase.x + Math.sin(phase) * 1.1, 0, dustDevilBase.z + Math.cos(phase * 0.7) * 0.8);
    dustDevil.current.rotation.y = phase * 0.5;
  });
  return <group name="wind-weather-truss" position={[landmark.position.x, sampleWorldGround(landmark.position.x, landmark.position.z), landmark.position.z]} rotation={[0, landmark.yaw, 0]}>
    <RockCluster material={regionRock(region)} landmark={landmark} />
    {[-3.25, 3.25].map((x) => <React.Fragment key={x}>
      <mesh geometry={BOX} material={METAL} position={[x, 1.28, 0]} scale={[0.2, 2.56, 0.2]} castShadow />
      <mesh geometry={BOX} material={DARK} position={[x, 0.12, 0]} scale={[0.78, 0.18, 0.68]} />
      <Beam from={[x, 0.25, 0]} to={[0, 3.15, 0]} radius={0.037} material={METAL} />
    </React.Fragment>)}
    <Beam from={[-3.34, 3.15, 0]} to={[3.34, 3.15, 0]} radius={0.065} material={METAL} />
    <Beam from={[-3.25, 2.82, -0.22]} to={[3.25, 2.82, -0.22]} radius={0.025} material={SEAM} />
    {[-1.52, 1.52].map((x) => <group key={x} position={[x, 2.48, 0.68]} rotation={[0, 0, -0.24]}>
      <mesh geometry={BOX} material={FOIL} scale={[1.56, 0.065, 1.32]} castShadow />
      <mesh geometry={BOX} material={accent} position={[0, 0.046, 0]} scale={[1.34, 0.018, 1.1]} />
      {[-0.68, 0.68].map((side) => <Beam key={side} from={[side, -0.34, -0.35]} to={[side, 0.03, -0.35]} radius={0.025} />)}
    </group>)}
    <group position={[0, 3.25, 0.28]}>
      <Beam from={[0, 0, 0]} to={[0, 0.45, 0]} radius={0.033} />
      <Beam from={[0, 0.4, 0]} to={[0, 0.4, 0.62]} radius={0.027} material={accent} />
      {[0, 1, 2].map((index) => <mesh key={index} geometry={BOX} material={METAL}
        position={[0, 0.4, 0.62]} rotation={[0, 0, index * Math.PI * 2 / 3]} scale={[0.36, 0.025, 0.045]} />)}
      <mesh geometry={BOX} material={AMBER} position={[0, 0.4, 0.62]} scale={[0.09, 0.09, 0.09]} />
      <pointLight position={[0, 0.4, 0.62]} color="#ffd09a" intensity={4} distance={12} decay={2} />
    </group>
    <mesh geometry={BOX} material={DARK} position={[0, 0.065, 0]} scale={[1.05, 0.13, 0.88]} />
    <group ref={dustDevil} name="slow-bounded-dust-devil" position={[6.6, 0, -4.4]}>
      {DUST_DEVIL_CONES.map((geometry, index) => <mesh key={index} geometry={geometry}
        material={index % 2 ? SEAM : regionRock(region)} position={[0, 0.62 + index * 0.58, 0]} rotation={[0, index * 0.4, 0]} />)}
    </group>
  </group>;
}

function DrillGantry({ landmark, region }: { landmark: OuterHeroLandmark; region: OuterRegion }) {
  const accent = regionAccent(region);
  return <group name="ice-core-drill-gantry" position={[landmark.position.x, sampleWorldGround(landmark.position.x, landmark.position.z), landmark.position.z]} rotation={[0, landmark.yaw, 0]}>
    <RockCluster material={regionRock(region)} landmark={landmark} />
    <PracticalLamp position={[2.4, 2.65, 0.85]} />
    <mesh geometry={BOX} material={SHELL} position={[-2.1, 0.72, 0.38]} scale={[1.65, 1.44, 1.56]} castShadow receiveShadow />
    <mesh geometry={BOX} material={SHADE} position={[-2.1, 1.48, 0.38]} scale={[1.78, 0.12, 1.68]} castShadow />
    <mesh geometry={BOX} material={DARK} position={[-2.1, 0.8, 1.18]} scale={[0.92, 0.76, 0.035]} />
    <mesh geometry={BOX} material={AMBER} position={[-2.1, 1.12, 1.205]} scale={[0.54, 0.055, 0.025]} />
    <Beam from={[-0.55, 0.22, -0.72]} to={[-0.55, 2.95, -0.72]} radius={0.07} />
    <Beam from={[2.72, 0.22, -0.72]} to={[2.72, 2.95, -0.72]} radius={0.07} />
    <Beam from={[-0.55, 2.95, -0.72]} to={[2.72, 2.95, -0.72]} radius={0.085} material={SHELL} />
    <Beam from={[-0.55, 2.72, 0.98]} to={[2.72, 2.72, 0.98]} radius={0.048} material={METAL} />
    <Beam from={[0.12, 2.72, -0.72]} to={[0.12, 1.42, -0.72]} radius={0.032} material={accent} />
    <mesh geometry={BARREL} material={DARK} position={[0.12, 0.78, -0.72]} scale={[1, 1.25, 1]} castShadow />
    <mesh geometry={BARREL} material={SEAM} position={[0.12, 0.44, -0.72]} scale={[1.35, 0.13, 1.35]} />
    <Beam from={[0.46, 1.3, -0.57]} to={[1.16, 0.35, 0.58]} radius={0.023} material={accent} />
    <mesh geometry={BOX} material={DARK} position={[1.3, 0.075, 0.72]} scale={[2, 0.15, 0.48]} />
    {[0.52, 1.35, 2.18].map((x) => <mesh key={x} geometry={BOX} material={SHELL}
      position={[x, 0.2, 0.72]} scale={[0.22, 0.24, 0.36]} />)}
    <mesh geometry={BOX} material={accent} position={[1.3, 0.31, 0.72]} scale={[1.65, 0.035, 0.035]} />
  </group>;
}

function SurveyTruss({ landmark, region }: { landmark: OuterHeroLandmark; region: OuterRegion }) {
  const accent = regionAccent(region);
  return <group name="basalt-survey-truss" position={[landmark.position.x, sampleWorldGround(landmark.position.x, landmark.position.z), landmark.position.z]} rotation={[0, landmark.yaw, 0]}>
    <RockCluster material={regionRock(region)} landmark={landmark} />
    <PracticalLamp position={[0, 1.78, 0.62]} />
    {[-3.05, 3.05].map((x) => <React.Fragment key={x}>
      <mesh geometry={BOX} material={DARK} position={[x, 0.12, 0]} scale={[0.92, 0.22, 0.72]} />
      <Beam from={[x, 0.18, 0]} to={[x, 2.45, 0]} radius={0.065} material={METAL} />
      <Beam from={[x, 0.62, -0.05]} to={[x + (x < 0 ? 0.55 : -0.55), 1.65, 0.02]} radius={0.033} material={accent} />
    </React.Fragment>)}
    <Beam from={[-3.15, 2.45, 0]} to={[3.15, 2.45, 0]} radius={0.075} material={SHELL} />
    <Beam from={[-3.05, 2.22, -0.1]} to={[3.05, 2.22, -0.1]} radius={0.026} material={METAL} />
    <mesh geometry={BOX} material={DARK} position={[0, 2.22, 0.15]} scale={[0.82, 0.62, 0.56]} castShadow />
    <mesh geometry={BOX} material={GLASS} position={[0, 2.22, 0.44]} scale={[0.56, 0.37, 0.025]} />
    <mesh geometry={BOX} material={AMBER} position={[0, 1.86, 0.45]} scale={[0.28, 0.055, 0.03]} />
    {[-2.05, 2.05].map((x) => <group key={x} position={[x, 2.42, 0.1]}>
      <mesh geometry={BOX} material={FOIL} position={[0, 0, 0]} scale={[0.86, 0.035, 0.8]} />
      <Beam from={[0, -0.7, 0]} to={[0, -0.03, 0]} radius={0.022} />
    </group>)}
    <mesh geometry={BOX} material={accent} position={[3.5, 0.32, 0.1]} scale={[0.52, 0.58, 0.42]} />
    {[0, 1, 2].map((index) => <mesh key={index} geometry={BARREL} material={DARK}
      position={[3.5 + (index - 1) * 0.16, 0.14, 0.43]} rotation={[Math.PI / 2, 0, 0]} scale={[0.35, 0.22, 0.35]} />)}
  </group>;
}

function StrataArch({ landmark, region }: { landmark: OuterHeroLandmark; region: OuterRegion }) {
  const accent = regionAccent(region);
  return <group name="ancient-lake-sediment-arch" position={[landmark.position.x, sampleWorldGround(landmark.position.x, landmark.position.z), landmark.position.z]} rotation={[0, landmark.yaw, 0]}>
    <RockCluster material={regionRock(region)} landmark={landmark} />
    <PracticalLamp position={[2.65, 2.15, 0.78]} />
    <mesh geometry={BOX} material={DARK} position={[-1.55, 0.95, 0]} scale={[0.38, 1.9, 2.38]} castShadow />
    <group name="exposed-lake-strata-face">
      {[0, 1, 2, 3, 4].map((index) => <mesh key={index} geometry={BOX}
        material={[regionRock(region), SHADE, FOIL, SHELL, accent][index]}
        position={[-1.78, 0.22 + index * 0.33, 0]} scale={[0.055, 0.13, 2.05 - index * 0.1]} castShadow receiveShadow />)}
    </group>
    <Beam from={[0.2, 0.16, -1.05]} to={[0.2, 2.55, -1.05]} radius={0.075} material={METAL} />
    <Beam from={[3.15, 0.16, 1.05]} to={[3.15, 2.55, 1.05]} radius={0.075} material={METAL} />
    <Beam from={[0.2, 2.55, -1.05]} to={[3.15, 2.55, 1.05]} radius={0.085} material={SHELL} />
    <mesh geometry={BOX} material={DARK} position={[2.75, 1.84, 0.65]} scale={[0.56, 0.72, 0.33]} castShadow />
    <mesh geometry={BOX} material={GLASS} position={[2.75, 1.86, 0.83]} scale={[0.38, 0.38, 0.025]} />
    <mesh geometry={BOX} material={AMBER} position={[2.75, 1.57, 0.84]} scale={[0.17, 0.04, 0.025]} />
    <mesh geometry={BOX} material={DARK} position={[3.45, 0.1, -0.05]} scale={[1.2, 0.2, 0.85]} />
    {[-0.38, 0.38].map((x) => <React.Fragment key={x}>
      <mesh geometry={BARREL} material={FOIL} position={[3.45 + x, 0.48, -0.05]} scale={[0.72, 0.68, 0.72]} />
      <mesh geometry={BOX} material={SEAM} position={[3.45 + x, 0.82, -0.05]} scale={[0.49, 0.1, 0.49]} />
    </React.Fragment>)}
  </group>;
}

export const RegionHero: React.FC<{ landmark: OuterHeroLandmark; region: OuterRegion }> = ({ landmark, region }) => {
  switch (landmark.id) {
    case 'impact-radome': return <ImpactRadome landmark={landmark} region={region} />;
    case 'dust-weather-truss': return <WeatherTruss landmark={landmark} region={region} />;
    case 'ice-drill-gantry': return <DrillGantry landmark={landmark} region={region} />;
    case 'volcano-survey-truss': return <SurveyTruss landmark={landmark} region={region} />;
    case 'lake-strata-arch': return <StrataArch landmark={landmark} region={region} />;
  }
};

export const RegionConsole: React.FC<{ region: OuterRegion }> = ({ region }) => {
  const { x, z } = region.baseConsole;
  const accent = regionAccent(region);
  const y = sampleWorldGround(x, z);
  return <group name={`${region.id}-standing-field-console`} position={[x, y, z]}>
    <PracticalLamp position={[0.75, 1.35, -0.2]} />
    <mesh geometry={BOX} material={DARK} position={[0, 0.09, 0]} scale={[1.92, 0.18, 1.44]} />
    {[-0.68, 0.68].map((side) => <React.Fragment key={side}>
      <mesh geometry={BOX} material={METAL} position={[side, 0.65, -0.2]} scale={[0.11, 1.1, 0.12]} castShadow />
      <mesh geometry={BOX} material={SHELL} position={[side, 1.18, -0.2]} scale={[0.2, 0.14, 0.19]} />
    </React.Fragment>)}
    <Beam from={[-0.7, 1.1, -0.2]} to={[0.7, 1.1, -0.2]} radius={0.035} />
    <mesh geometry={BOX} material={DARK} position={[0, 1.21, -0.19]} rotation={[-0.2, 0, 0]} scale={[1.16, 0.94, 0.22]} castShadow />
    <mesh geometry={BOX} material={GLASS} position={[0, 1.24, -0.06]} rotation={[-0.2, 0, 0]} scale={[0.92, 0.64, 0.025]} />
    <mesh geometry={BOX} material={accent} position={[0, 0.86, -0.05]} scale={[0.42, 0.055, 0.035]} />
    <mesh geometry={BOX} material={AMBER} position={[0.48, 1.67, -0.2]} scale={[0.1, 0.1, 0.1]} />
    <mesh geometry={BOX} material={METAL} position={[0, 0.2, 0.53]} scale={[1.32, 0.12, 0.25]} />
    {[-0.52, 0, 0.52].map((side) => <mesh key={side} geometry={BOX} material={SEAM}
      position={[side, 0.23, 0.65]} scale={[0.07, 0.15, 0.56]} />)}
    <mesh geometry={BOX} material={SHELL} position={[-0.43, 0.46, -0.49]} scale={[0.42, 0.52, 0.38]} castShadow />
    <mesh geometry={BOX} material={accent} position={[-0.43, 0.74, -0.49]} scale={[0.44, 0.065, 0.4]} />
    <Beam from={[-0.22, 0.38, -0.32]} to={[-0.05, 0.49, -0.08]} radius={0.026} material={METAL} />
  </group>;
};
