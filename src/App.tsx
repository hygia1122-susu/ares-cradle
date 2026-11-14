import React, { lazy, Suspense } from 'react';
import MarsCanvas from '@/modules/outpost-3d/MarsCanvas';
import MissionControlOverlay from '@/modules/mission-control/MissionControlOverlay';

const RoverReview = lazy(() => import('./game/review/RoverReview'));
const MissionGame = lazy(() => import('./game/mission/MissionGame'));

export const App: React.FC = () => {
  const query = new URLSearchParams(window.location.search);
  if (query.get('review') === 'rover') {
    return <Suspense fallback={<p role="status">Loading field rover…</p>}><RoverReview /></Suspense>;
  }
  if (query.get('legacy') !== '1' && query.get('mission') === 'frontiers') {
    return <Suspense fallback={<p role="status">Loading Five Frontiers…</p>}><MissionGame /></Suspense>;
  }
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-mars-charcoal bg-grid-telemetry font-sans">
      {/* 3D Diorama Canvas */}
      <MarsCanvas />

      {/* Hallmark Mission Control Tactical HUD */}
      <MissionControlOverlay />
    </main>
  );
};

export default App;
