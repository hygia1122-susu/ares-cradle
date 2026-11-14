import React, { useRef, useState } from 'react';
import { House, ZoomIn, ZoomOut } from 'lucide-react';
import { useOutpostStore } from '@/modules/store/useOutpostStore';
import { soundEngine } from '@/modules/audio/soundEngine';
import { WORLD_REGIONS } from '@/modules/outpost-3d/worldRegions';

const ZOOM_SCALES = [25, 50, 80, 300, 450] as const;

export const MinimapRadar: React.FC = () => {
  const [zoomIndex, setZoomIndex] = useState<number>(4);
  const previousYaw = useRef(0);
  const unwrappedYaw = useRef(0);
  const playerPos = useOutpostStore((state) => state.playerPos);
  const isDrivingRover = useOutpostStore((state) => state.isDrivingRover);
  const roverPos = useOutpostStore((state) => state.roverPos);
  const cameraYaw = useOutpostStore((state) => state.cameraYaw);
  const exploration = useOutpostStore((state) => state.exploration);
  const activeWaypointRegionId = useOutpostStore((state) => state.activeWaypointRegionId);
  const yawDelta = Math.atan2(Math.sin(cameraYaw - previousYaw.current), Math.cos(cameraYaw - previousYaw.current));
  unwrappedYaw.current += yawDelta;
  previousYaw.current = cameraYaw;
  const activeZoomIndex = Math.max(0, Math.min(zoomIndex, ZOOM_SCALES.length - 1));
  const currentScale = ZOOM_SCALES[activeZoomIndex];
  const currentPos = isDrivingRover ? roverPos : playerPos;
  const [px, , pz] = currentPos;
  const projectToRadar = (wx: number, wz: number) => {
    const dx = wx - px;
    const dz = wz - pz;
    const dist = Math.hypot(dx, dz);
    const ratio = Math.min(dist, currentScale) / currentScale;
    const distance = dist || 1;
    return { x: (dx / distance) * ratio * 50, y: (dz / distance) * ratio * 50, isOutside: dist > currentScale };
  };
  const completed = new Set(exploration.completedRegions);
  const stationBlips = WORLD_REGIONS.map((region, index) => {
    const { x, y } = projectToRadar(region.baseConsole.x, region.baseConsole.z);
    const distance = Math.hypot(px - region.baseConsole.x, pz - region.baseConsole.z);
    return { region, index, x, y, distance, active: completed.has(region.id), isTarget: activeWaypointRegionId === region.id };
  });
  const cycleZoom = (delta: number) => {
    soundEngine.playClick(1000);
    setZoomIndex((prev) => Math.max(0, Math.min(ZOOM_SCALES.length - 1, prev + delta)));
  };
  const distToBase = Math.hypot(px, pz);

  return (
    <div className="fixed top-3 right-3 z-30 pointer-events-auto flex flex-col items-end select-none font-mono">
      <div className="relative w-28 h-28 rounded-full hud-theme-shell border-2 flex items-center justify-center overflow-hidden" aria-label="North-up minimap">
        <div className="absolute inset-2 rounded-full border border-cyan-500/20" />
        <div className="absolute inset-6 rounded-full border border-cyan-500/30 border-dashed" />
        <div className="absolute inset-10 rounded-full border border-cyan-500/40" />
        <div className="absolute w-full h-px bg-cyan-500/20" />
        <div className="absolute h-full w-px bg-cyan-500/20" />
        <div style={{ transform: `translate(${projectToRadar(0, 0).x}px, ${projectToRadar(0, 0).y}px)` }} className="absolute z-10 w-4 h-4 -ml-2 -mt-2 flex items-center justify-center text-cyan-300" title={`Ares Cradle habitat — ${distToBase.toFixed(0)}m`}>
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 border border-white shadow-[0_0_8px_#00F0FF] flex items-center justify-center"><House className="h-2 w-2" aria-hidden="true" /></span>
        </div>
        {stationBlips.map(({ region, index, x, y, distance, active, isTarget }) => (
          <div key={region.id} style={{ transform: `translate(${x}px, ${y}px)` }} className={`absolute z-10 w-4 h-4 -ml-2 -mt-2 flex items-center justify-center text-[7px] font-bold transition-transform duration-100 ${isTarget ? 'text-amber-200' : active ? 'text-cyan-100' : 'text-cyan-300'}`} title={`${region.name} — ${distance.toFixed(0)}m — ${isTarget ? 'waypoint' : active ? 'surveyed' : 'unvisited'}`}>
            <span className={`w-2.5 h-2.5 flex items-center justify-center border ${active ? 'rounded-full bg-cyan-400 border-white shadow-[0_0_8px_#00F0FF]' : 'rotate-45 rounded-sm bg-slate-900 border-cyan-300'} ${isTarget ? 'ring-1 ring-amber-300 shadow-[0_0_8px_#F59E0B]' : ''}`}><span className={active ? '' : '-rotate-45'}>{index + 1}</span></span>
          </div>
        ))}
        <span className="absolute top-1 z-20 text-[8px] font-bold text-rose-300" aria-hidden="true">N</span>
        <div className="absolute z-20 w-3 h-3 flex items-center justify-center" aria-label={`Facing ${(cameraYaw * 180 / Math.PI).toFixed(0)} degrees`}>
          <div data-testid="minimap-player-arrow" style={{ transform: `rotate(${-unwrappedYaw.current * (180 / Math.PI)}deg)` }} className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] border-b-white shadow-[0_0_6px_#FFFFFF] transition-transform duration-100 ease-out" />
        </div>
        <div className="absolute bottom-1 z-20 px-1.5 py-0.5 bg-slate-900/90 rounded text-[8px] font-bold text-cyan-300 border border-cyan-500/30">{currentScale}M</div>
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[9px] text-slate-200 bg-slate-950/90 px-2 py-0.5 rounded-md border border-slate-700">
        <span>X:{px.toFixed(0)} Z:{pz.toFixed(0)}</span>
        <div className="flex items-center gap-0.5 pl-1 border-l border-slate-700">
          <button type="button" onClick={() => cycleZoom(-1)} disabled={activeZoomIndex === 0} className="min-h-7 min-w-7 flex items-center justify-center hover:text-white disabled:opacity-30" title="Zoom In" aria-label="Zoom in"><ZoomIn className="w-3 h-3" /></button>
          <button type="button" onClick={() => cycleZoom(1)} disabled={activeZoomIndex === ZOOM_SCALES.length - 1} className="min-h-7 min-w-7 flex items-center justify-center hover:text-white disabled:opacity-30" title="Zoom Out" aria-label="Zoom out"><ZoomOut className="w-3 h-3" /></button>
        </div>
      </div>
    </div>
  );
};

export default MinimapRadar;
