import React, { useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { 
  EffectComposer, 
  Bloom 
} from '@react-three/postprocessing';
import { useControls, Leva } from 'leva';
import { useOutpostStore } from '@/modules/store/useOutpostStore';

import LightingRig from './LightingRig';
import MarsTerrain from './MarsTerrain';
import OuterRegions from './OuterRegions';
import HabitatDome from './HabitatDome';
import HabitatInterior from './HabitatInterior';
import SolarArray from './SolarArray';
import BatteryBank from './BatteryBank';
import DustStormParticles from './DustStormParticles';
import MarsRover from './MarsRover';
import ResourceDrops from './ResourceDrops';
import SpecimenNodesCollection from './SpecimenNode';
import SpaceSkybox from './SpaceSkybox';
import AstronautPlayer from '@/modules/character/AstronautPlayer';
import CameraRig from '@/modules/character/CameraRig';
import PhysicsDebugHitboxes from './PhysicsDebugHitboxes';

/**
 * High-performance frame driver connecting R3F render loop with the domain simulation tick.
 */
function SimulationLoopDriver() {
  const tick = useOutpostStore((state) => state.tick);
  const isSimulating = useOutpostStore((state) => state.isSimulating);

  useFrame((_, delta) => {
    if (isSimulating) {
      // Clamp delta to avoid massive leaps on tab defocus
      const safeDelta = Math.min(0.1, delta);
      tick(safeDelta);
    }
  });

  return null;
}

/**
 * Task 9.3 & Fine-Tune Polish: Eye-Friendly Soft Lighting Pipeline
 * - Gentle, low-intensity Bloom (< 0.28) exclusively for dome glass and crystal emissives
 * - Zero Noise, Zero Chromatic Aberration, Zero harsh neon flicker for maximum visual comfort
 */
function PostProcessingPipeline({ isDebug }: { isDebug: boolean }) {
  const solPhase = useOutpostStore((state) => state.solPhase);

  // Soft, eye-pleasing subtle bloom baseline
  const calcBloom = solPhase === 'Night' ? 0.26 : 0.18;

  // Interactive GUI for developer calibration (Active when URL has ?debug=true)
  const [controls] = useControls(
    'Mars Post-Processing & Lighting',
    () => ({
      bloomIntensity: { value: calcBloom, min: 0, max: 1.0, step: 0.02 }
    }),
    { collapsed: true }
  );

  const bloomIntensity = isDebug ? controls.bloomIntensity : calcBloom;

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        luminanceThreshold={0.72}
        luminanceSmoothing={0.65}
        intensity={bloomIntensity}
        mipmapBlur
      />
    </EffectComposer>
  );
}

/**
 * Camera Controller with Leva GUI integration when ?debug=true
 */
function DynamicCameraController({ isDebug }: { isDebug: boolean }) {
  const { camera } = useThree();

  const [camControls] = useControls(
    'Camera Rig Controls',
    () => ({
      fov: { value: 45, min: 30, max: 75, step: 1 },
      posY: { value: 6.5, min: 3, max: 15, step: 0.5 },
      posZ: { value: 13, min: 6, max: 25, step: 0.5 }
    }),
    { collapsed: false }
  );

  useEffect(() => {
    if (isDebug && (camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const persCam = camera as THREE.PerspectiveCamera;
      persCam.fov = camControls.fov;
      persCam.updateProjectionMatrix();
    }
  }, [isDebug, camControls.fov, camera]);

  return null;
}

/**
 * Primary 3D Viewport for Ares Cradle (v2.0).
 * Hallmark-grade interactive Mars diorama designed for tactile clarity and 60 FPS performance.
 * Integrates CC0 Low-Poly Astronaut, Mars Rover, Energy Crystals, NASA InSight Hologram,
 * and GPU Post-Processing Shader Pipeline.
 */
export const MarsCanvas: React.FC = () => {
  const graphicsQuality = useOutpostStore((state) => state.graphicsQuality);

  // Query flag check for ?debug=true
  const isDebug = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('debug') === 'true';
  }, []);

  const canvasDpr: number | [number, number] =
    graphicsQuality === 'low' ? 1 : graphicsQuality === 'medium' ? [1, 1.5] : [1, 2];

  return (
    <div
      data-graphics-quality={graphicsQuality}
      className="w-full h-full relative cursor-grab active:cursor-grabbing select-none"
    >
      {/* Leva GUI Control Deck - Visible only with ?debug=true query flag */}
      <Leva
        hidden={!isDebug}
        titleBar={{ title: 'Ares Cradle v2.0 • Post-Processing Debug Deck' }}
        theme={{
          colors: {
            elevation1: '#0B0E14',
            elevation2: '#121620',
            elevation3: '#1A2130',
            accent1: '#00F0FF',
            highlight1: '#FFB020',
            highlight2: '#C1440E'
          }
        }}
      />

      <Canvas
        camera={{ position: [0, 6.5, 13], fov: 45 }}
        dpr={canvasDpr}
        shadows={graphicsQuality !== 'low'}
        gl={{
          antialias: graphicsQuality !== 'low',
          alpha: false,
          powerPreference: 'high-performance'
        }}
        onCreated={({ gl, scene }) => {
          // Strict memory hygiene: clamp pixel ratio and clean clear color
          gl.setPixelRatio(Math.min(window.devicePixelRatio, graphicsQuality === 'low' ? 1 : 2));
          gl.setClearColor(new THREE.Color('#0B0E14'));
          scene.fog = new THREE.FogExp2('#0B0E14', 0.035);
        }}
      >
        {/* Real-time simulation tick processor */}
        <SimulationLoopDriver />

        {/* Dynamic Camera Controller with Leva tuning */}
        <DynamicCameraController isDebug={isDebug} />

        {/* Dynamic Mars Sun, Atmosphere & Storm Lighting */}
        <LightingRig />

        {/* Task 10.3: Celestial Skybox with Twinkling Stars & Orbiting Phobos Moon */}
        <SpaceSkybox />

        {/* Mars Surface, Craters, Foundation & Mineral Rocks */}
        <MarsTerrain />
        <OuterRegions />

        {/* Pressurized Habitat with Reactive Bioluminescent Core */}
        <HabitatDome />

        {/* Task 9.2: NASA InSight Lander / Rover Wireframe Hologram Blueprint inside Observation Glass */}
        <HabitatInterior />

        {/* Task 12.2: Interactive Astronaut Player (Cadet Leo with WASD + Joystick) */}
        <AstronautPlayer />

        {/* Task 9.1: Low-Poly Mars Rover Unit (Kenney Space Kit Style) */}
        <MarsRover />

        {/* Grounded Martian Field Supply Caches & Mineral Outcrops */}
        <ResourceDrops />

        {/* Phase 19: 3D Scientific Specimen Drops with Proximity Glow */}
        <SpecimenNodesCollection />

        {/* Tactile Solar Array with Interactive Dust Wiping */}
        <SolarArray />

        {/* Modular Energy Storage with Dynamic LED Charge Bar */}
        <BatteryBank />

        {/* 3D Physics Hitbox & Bounding Box Visualizer (Toggleable via [B] or UI Button) */}
        <PhysicsDebugHitboxes />

        {/* Dynamic Atmospheric Dust Motes & Storm Particle System */}
        <DustStormParticles />

        {/* Task 9.3: GPU Post-Processing Pipeline (Disabled on Low Quality for 60 FPS Chromebook/Mobile) */}
        {graphicsQuality !== 'low' && <PostProcessingPipeline isDebug={isDebug} />}

        {/* Task 12.2: Smooth 45° Isometric Camera Rig with Interior/Exterior Switching */}
        {!isDebug && <CameraRig />}

        {/* Safe OrbitControls for Developer Leva Tuning Deck */}
        {isDebug && (
          <OrbitControls
            enablePan={false}
            maxPolarAngle={Math.PI / 2.05}
            minPolarAngle={Math.PI / 6}
            minDistance={6}
            maxDistance={22}
            dampingFactor={0.08}
          />
        )}
      </Canvas>
    </div>
  );
};

export default MarsCanvas;
