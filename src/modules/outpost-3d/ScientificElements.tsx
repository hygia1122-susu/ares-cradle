import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useOutpostStore } from '@/modules/store/useOutpostStore';
import { SCIENTIFIC_ELEMENTS, type ScientificElement } from './scienceCatalog';
import { sampleWorldGround } from './worldRegions';

const MAT = {
  rock: '#55433a',
  dark: '#27292a',
  dust: '#ad7857',
  paleDust: '#c29c7b',
  ice: '#a9c5c7',
  frost: '#d6e0dc',
  hardware: '#3c4547',
  brass: '#a98250',
  lamp: '#e7bd76',
};

const ROCK = { color: MAT.rock, roughness: 0.96, flatShading: true };
const DARK_ROCK = { color: MAT.dark, roughness: 0.94, flatShading: true };
const DUST = { color: MAT.dust, roughness: 1, flatShading: true };
const HARDWARE = { color: MAT.hardware, metalness: 0.58, roughness: 0.62 };

function Feature({ element }: { element: ScientificElement }) {
  switch (element.kind) {
    case 'impact-rock': return <group name="impact-shocked-outcrop">
      <mesh position={[-0.42, 0.28, 0.02]} rotation={[0.12, 0.25, -0.12]} scale={[0.66, 0.48, 0.52]} castShadow receiveShadow><dodecahedronGeometry args={[0.7, 0]} /><meshStandardMaterial {...ROCK} /></mesh>
      <mesh position={[0.34, 0.2, 0.16]} rotation={[0.28, -0.2, 0.08]} scale={[0.48, 0.34, 0.42]} castShadow receiveShadow><icosahedronGeometry args={[0.62, 0]} /><meshStandardMaterial color="#8a6953" roughness={0.96} flatShading /></mesh>
      <mesh position={[0.05, 0.12, -0.42]} scale={[0.3, 0.2, 0.24]} castShadow><dodecahedronGeometry args={[0.6, 0]} /><meshStandardMaterial {...DARK_ROCK} /></mesh>
      <mesh position={[-0.38, 0.61, 0.02]} rotation={[0.3, 0.2, 0.15]} scale={[0.25, 0.11, 0.16]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#c09a75" roughness={1} /></mesh>
    </group>;
    case 'crater': return <group name="crater-rim">
      <mesh position={[0, 0.06, 0]} scale={[0.88, 0.08, 0.88]}><cylinderGeometry args={[0.8, 0.8, 1, 16]} /><meshStandardMaterial color="#302d2b" roughness={1} /></mesh>
      {Array.from({ length: 9 }, (_, i) => {
        const a = i * Math.PI * 2 / 9;
        return <mesh key={i} position={[Math.cos(a) * 0.82, 0.23 + (i % 3) * 0.055, Math.sin(a) * 0.82]} rotation={[0.1, a, 0.14]} scale={[0.28 + (i % 2) * 0.08, 0.28, 0.24]} castShadow><dodecahedronGeometry args={[0.55, 0]} /><meshStandardMaterial {...(i % 3 === 0 ? DUST : ROCK)} /></mesh>;
      })}
    </group>;
    case 'ejecta': return <group name="ejecta-lobes">
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1.85, 1]}><circleGeometry args={[0.82, 20]} /><meshStandardMaterial color="#574437" roughness={1} /></mesh>
      {[-1, 0, 1].map((side) => <React.Fragment key={side}>
        <mesh position={[side * 0.5, 0.14, -0.62]} rotation={[0.12, side * 0.12, side * -0.16]} scale={[0.34, 0.16, 0.72]} castShadow><dodecahedronGeometry args={[0.65, 0]} /><meshStandardMaterial color={side === 0 ? '#9b7358' : MAT.rock} roughness={0.98} flatShading /></mesh>
        <mesh position={[side * 0.43, 0.08, 0.56]} rotation={[0, side * 0.1, side * 0.22]} scale={[0.25, 0.12, 0.48]}><icosahedronGeometry args={[0.65, 0]} /><meshStandardMaterial {...DUST} /></mesh>
      </React.Fragment>)}
    </group>;
    case 'dust-devil': return <group name="dust-devil-column" position={[0, 0.05, 0]}>
      <mesh position={[0, 1.1, 0]} scale={[0.35, 1.15, 0.35]}><coneGeometry args={[1, 2, 10]} /><meshStandardMaterial color="#b58b6b" transparent opacity={0.22} depthWrite={false} roughness={1} /></mesh>
      {[0.52, 1.08, 1.65].map((y, i) => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, i * 0.5]} scale={[0.28 + i * 0.08, 0.28 + i * 0.08, 0.1]}><torusGeometry args={[1, 0.13, 5, 12]} /><meshStandardMaterial color="#c49b78" transparent opacity={0.38} depthWrite={false} /></mesh>)}
      {[-0.34, 0.31, -0.14, 0.22].map((x, i) => <mesh key={i} position={[x, 0.35 + i * 0.48, i % 2 ? 0.2 : -0.18]} scale={[0.1, 0.08, 0.08]}><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial {...DUST} /></mesh>)}
    </group>;
    case 'dust-deposit': return <group name="dust-deposit-patches">
      {[[0, 0, 0.72, 0.5], [-0.48, 0.025, 0.58, 0.36], [0.52, 0.035, 0.52, 0.31]].map(([x, z, sx, sz], i) => <mesh key={i} position={[x, 0.035 + i * 0.012, z]} rotation={[-Math.PI / 2, 0, (i - 1) * 0.18]} scale={[sx, sz, 1]}><circleGeometry args={[1, 18]} /><meshStandardMaterial color={i === 1 ? '#c6a080' : '#a97858'} roughness={1} /></mesh>)}
      <mesh position={[0.08, 0.07, -0.43]} rotation={[-Math.PI / 2, 0, -0.16]} scale={[0.53, 0.18, 1]}><circleGeometry args={[1, 16]} /><meshStandardMaterial color="#514139" roughness={1} /></mesh>
    </group>;
    case 'wind-streak': return <group name="wind-streak-ridges">
      <mesh position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.33, 1.0, 1]}><circleGeometry args={[1, 18]} /><meshStandardMaterial color="#453a34" roughness={1} /></mesh>
      {[-0.38, 0, 0.38].map((x, i) => <mesh key={i} position={[x, 0.09, 0.08]} rotation={[0, 0, (i - 1) * -0.06]} scale={[0.12, 0.06, 0.92]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color={i === 1 ? '#c19a79' : '#95745d'} roughness={1} /></mesh>)}
    </group>;
    case 'basalt': return <group name="stacked-basalt-lavas">
      <mesh position={[0, 0.28, 0]} rotation={[0.05, 0.22, -0.04]} scale={[0.92, 0.44, 0.72]} castShadow><dodecahedronGeometry args={[0.72, 0]} /><meshStandardMaterial color="#292c2d" roughness={0.96} flatShading /></mesh>
      <mesh position={[-0.05, 0.56, 0.02]} rotation={[0.08, -0.1, 0.05]} scale={[0.78, 0.18, 0.61]} castShadow><dodecahedronGeometry args={[0.7, 0]} /><meshStandardMaterial color="#444442" roughness={0.94} flatShading /></mesh>
      <mesh position={[0.1, 0.75, -0.02]} rotation={[0.08, 0.16, 0.02]} scale={[0.55, 0.11, 0.43]} castShadow><dodecahedronGeometry args={[0.62, 0]} /><meshStandardMaterial color="#363738" roughness={0.94} flatShading /></mesh>
    </group>;
    case 'strata': return <group name="inclined-rock-strata">
      <mesh position={[0, 0.55, 0]} rotation={[0.14, -0.18, -0.1]} scale={[0.88, 0.76, 0.7]} castShadow><dodecahedronGeometry args={[0.7, 0]} /><meshStandardMaterial color="#343333" roughness={0.96} flatShading /></mesh>
      {[0.32, 0.48, 0.64, 0.8].map((y, i) => <mesh key={i} position={[0, y, 0.24]} rotation={[0.08, 0.12, -0.1]} scale={[0.7 - i * 0.08, 0.055, 0.29]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color={['#9b7458', '#55433a', '#b58c6c', '#51443c'][i]} roughness={1} /></mesh>)}
    </group>;
    case 'lava-channel': return <group name="lava-channel-and-levees">
      <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0.1]} scale={[0.37, 1.05, 1]}><circleGeometry args={[1, 18]} /><meshStandardMaterial color="#1e2122" roughness={0.95} /></mesh>
      {[-0.43, 0.43].map((x, i) => <mesh key={i} position={[x, 0.15, 0]} rotation={[0, 0, i ? -0.1 : 0.1]} scale={[0.19, 0.2, 0.96]} castShadow><dodecahedronGeometry args={[0.78, 0]} /><meshStandardMaterial color={i ? '#51443c' : '#393a39'} roughness={0.95} flatShading /></mesh>)}
      {[-0.55, 0.48].map((z, i) => <mesh key={i} position={[i ? 0.18 : -0.15, 0.08, z]} scale={[0.24, 0.14, 0.23]}><dodecahedronGeometry args={[0.7, 0]} /><meshStandardMaterial {...DARK_ROCK} /></mesh>)}
    </group>;
    case 'ice': return <group name="pale-ice-exposure">
      <mesh position={[0, 0.18, 0]} scale={[0.72, 0.2, 0.58]}><dodecahedronGeometry args={[0.75, 0]} /><meshStandardMaterial color="#768487" roughness={0.92} flatShading /></mesh>
      <mesh position={[-0.13, 0.48, 0.02]} rotation={[0.12, 0.2, -0.16]} scale={[0.42, 0.54, 0.34]} castShadow><octahedronGeometry args={[0.82, 0]} /><meshStandardMaterial color={MAT.ice} roughness={0.28} metalness={0.06} transparent opacity={0.88} flatShading /></mesh>
      <mesh position={[0.4, 0.24, 0.15]} rotation={[0.2, 0.5, 0.1]} scale={[0.3, 0.3, 0.27]}><octahedronGeometry args={[0.7, 0]} /><meshStandardMaterial color="#c4d6d3" roughness={0.32} transparent opacity={0.84} flatShading /></mesh>
    </group>;
    case 'radar': return <group name="radar-profile-instrument">
      <mesh position={[0, 0.46, 0]} scale={[0.42, 0.38, 0.3]} castShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial {...HARDWARE} /></mesh>
      <mesh position={[0, 0.7, 0]} scale={[0.48, 0.06, 0.34]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#7f8a83" metalness={0.45} roughness={0.6} /></mesh>
      <mesh position={[0, 1.05, -0.02]} scale={[0.045, 0.7, 0.045]}><cylinderGeometry args={[1, 1, 1, 8]} /><meshStandardMaterial color="#85908a" metalness={0.55} roughness={0.52} /></mesh>
      <mesh position={[-0.25, 1.25, 0.07]} rotation={[0, 0, -0.32]} scale={[0.3, 0.045, 0.22]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#8c9991" metalness={0.6} roughness={0.5} /></mesh>
      <mesh position={[0.26, 1.25, 0.07]} rotation={[0, 0, 0.32]} scale={[0.3, 0.045, 0.22]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#8c9991" metalness={0.6} roughness={0.5} /></mesh>
      <mesh position={[0, 0.92, 0.12]} scale={[0.075, 0.075, 0.04]}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color={MAT.lamp} emissive={MAT.lamp} emissiveIntensity={0.2} /></mesh>
      <pointLight position={[0, 0.93, 0.2]} color={MAT.lamp} intensity={0.2} distance={2} />
    </group>;
    case 'frost': return <group name="seasonal-frost-patches">
      {[[0, 0, 0.66, 0.45], [-0.38, 0.32, 0.43, 0.31], [0.42, -0.3, 0.4, 0.28], [-0.26, -0.42, 0.31, 0.23]].map(([x, z, sx, sz], i) => <mesh key={i} position={[x, 0.055 + i * 0.012, z]} rotation={[-Math.PI / 2, 0, i * 0.2]} scale={[sx, sz, 1]}><circleGeometry args={[1, 16]} /><meshStandardMaterial color={i % 2 ? '#cad8d4' : MAT.frost} transparent opacity={0.72} roughness={0.45} /></mesh>)}
      <mesh position={[0.08, 0.11, 0.05]} rotation={[0.1, 0.2, 0.08]} scale={[0.31, 0.16, 0.24]}><dodecahedronGeometry args={[0.72, 0]} /><meshStandardMaterial {...ROCK} /></mesh>
    </group>;
    case 'delta': return <group name="branching-dry-delta">
      <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.95, 0.76, 1]}><circleGeometry args={[1, 18]} /><meshStandardMaterial color="#9c7155" roughness={1} /></mesh>
      <mesh position={[0, 0.12, -0.12]} rotation={[0, 0, 0.08]} scale={[0.22, 0.12, 0.8]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#54453b" roughness={1} /></mesh>
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.35, 0.14, 0.32]} rotation={[0, 0, side * -0.44]} scale={[0.18, 0.1, 0.55]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#59483d" roughness={1} /></mesh>)}
      {[-0.4, 0.38].map((x, i) => <mesh key={i} position={[x, 0.1, -0.56]} rotation={[0, 0, i ? 0.18 : -0.18]} scale={[0.14, 0.08, 0.38]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#b58a69" roughness={1} /></mesh>)}
    </group>;
    case 'sediment': return <group name="eroded-cross-bedded-sediment">
      <mesh position={[0, 0.38, 0]} rotation={[0.08, 0.18, -0.1]} scale={[0.84, 0.5, 0.7]} castShadow><dodecahedronGeometry args={[0.78, 0]} /><meshStandardMaterial color="#5b493e" roughness={1} flatShading /></mesh>
      {[-0.18, -0.02, 0.14, 0.3].map((y, i) => <mesh key={i} position={[0, 0.26 + y, 0.17]} rotation={[0, 0.1, -0.22 + i * 0.08]} scale={[0.66 - i * 0.035, 0.045, 0.32]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color={['#b08461', '#765846', '#c49a74', '#8b6a50'][i]} roughness={1} /></mesh>)}
    </group>;
    case 'sample-cache': return <group name="sealed-sample-tubes">
      <mesh position={[0, 0.14, 0]} scale={[0.72, 0.16, 0.5]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial {...HARDWARE} /></mesh>
      {[-0.38, 0, 0.38].map((x, i) => <group key={i} position={[x, 0.37, 0]} rotation={[0, 0, i === 1 ? 0.08 : -0.06]}>
        <mesh scale={[0.1, 0.34, 0.1]} castShadow><cylinderGeometry args={[1, 1, 1, 8]} /><meshStandardMaterial color={i === 1 ? '#a5b2ac' : '#778782'} metalness={0.55} roughness={0.42} /></mesh>
        <mesh position={[0, 0.18, 0]} scale={[0.115, 0.055, 0.115]}><cylinderGeometry args={[1, 1, 1, 8]} /><meshStandardMaterial color="#c2a875" metalness={0.48} roughness={0.5} /></mesh>
        <mesh position={[0, -0.05, 0.09]} scale={[0.07, 0.065, 0.012]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#ded5c7" roughness={0.7} /></mesh>
      </group>)}
    </group>;
  }
}

function ScientificSite({ element, collected }: { element: ScientificElement; collected: boolean }) {
  const hintRef = useRef<import('three').Group>(null);
  useFrame(() => {
    const state = useOutpostStore.getState();
    const remote = state.isDrivingRover;
    const actor = remote ? state.roverPos : state.playerPos;
    const grounded = remote || state.isPlayerGrounded;
    const regionAllowed = remote ? state.remoteRegionId === element.regionId : state.remoteRegionId === null;
    const modalOpen = state.isBackpackOpen || state.isManualOpen || state.isDatapadOpen || state.isClassroomOpen ||
      state.isBrownoutQuizOpen || state.activeScienceEntryId !== null ||
      (typeof document !== 'undefined' && Boolean(document.querySelector('[role="dialog"]')));
    const near = regionAllowed && grounded && !modalOpen && Math.hypot(actor[0] - element.position.x, actor[2] - element.position.z) <= 6;
    if (hintRef.current) hintRef.current.visible = near;
  });

  return <group name={`scientific-element-${element.id}`} position={[element.position.x, sampleWorldGround(element.position.x, element.position.z), element.position.z]}>
    <Feature element={element} />
    <group name="inspect-range-hint" ref={hintRef} visible={false} position={[0, 0.025, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.92, 1.02, 32]} /><meshBasicMaterial color="#d3b47b" transparent opacity={0.24} depthWrite={false} /></mesh>
      <mesh position={[0.04, 0.06, 0.83]} scale={[0.22, 0.11, 0.1]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial {...HARDWARE} /></mesh>
      <mesh position={[0.04, 0.13, 0.83]} scale={[0.11, 0.025, 0.025]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#d7c39f" roughness={0.7} /></mesh>
    </group>
    {collected && <group name="recorded-field-tag" position={[0.78, 0.06, 0.55]} rotation={[0, -0.4, 0]}>
      <mesh scale={[0.22, 0.16, 0.045]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#46524d" metalness={0.3} roughness={0.7} /></mesh>
      <mesh position={[0, 0.015, 0.03]} scale={[0.095, 0.025, 0.012]} rotation={[0, 0, -0.55]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#c6b078" roughness={0.6} /></mesh>
      <mesh position={[0.035, 0.045, 0.03]} scale={[0.14, 0.025, 0.012]} rotation={[0, 0, 0.62]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#c6b078" roughness={0.6} /></mesh>
    </group>}
  </group>;
}

/** Fifteen small, source-linked geology/atmosphere teaching features at canonical discovery anchors. */
export const ScientificElements: React.FC = () => {
  const collected = useOutpostStore((state) => state.exploration.collected);
  return <group name="scientific-elements">
    {SCIENTIFIC_ELEMENTS.map((element) => <ScientificSite key={element.id} element={element} collected={collected.includes(element.id)} />)}
  </group>;
};

export default ScientificElements;
