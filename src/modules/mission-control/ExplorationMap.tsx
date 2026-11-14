import React, { useRef } from 'react';
import { WORLD_REGIONS, type RegionId } from '@/modules/outpost-3d/worldRegions';
import { X } from 'lucide-react';
import { useExplorationDialog } from './useExplorationDialog';

export interface ExplorationMapProps {
  isOpen: boolean;
  playerPos: readonly [number, number, number];
  activeRegionId: RegionId | 'home';
  activeWaypointRegionId: RegionId | null;
  onSetWaypoint: (regionId: RegionId) => void;
  onClose: () => void;
}

export const ExplorationMap: React.FC<ExplorationMapProps> = ({ isOpen, playerPos, activeRegionId, activeWaypointRegionId, onSetWaypoint, onClose }) => {
  const dialogRef = useRef<HTMLElement>(null);
  useExplorationDialog(isOpen, onClose, dialogRef);
  if (!isOpen) return null;
  const extent = 300;
  const position = (x: number, z: number) => ({ left: `${((x + extent) / (extent * 2)) * 100}%`, top: `${((z + extent) / (extent * 2)) * 100}%` });
  return <div className="pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center bg-[#080a0b]/85 p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="exploration-map-title" className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-cyan-100/25 bg-[#171a1c] text-white shadow-[0_12px_36px_rgba(0,0,0,.55)]">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
        <div><h2 id="exploration-map-title" className="text-lg font-semibold text-[#f1e1d3]">Ares Cradle field map</h2><p className="text-xs text-[#cbb8a8]">North is up · waypoints guide you on foot or rover</p></div>
        <button type="button" onClick={onClose} aria-label="Close map" className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"><X className="h-5 w-5" /></button>
      </header>
      <div className="grid min-h-0 gap-4 overflow-y-auto p-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(15rem,.8fr)] sm:p-5">
        <div className="relative aspect-square max-h-[62vh] w-full overflow-hidden rounded-lg border border-amber-100/20 bg-[#211d1b]" aria-label="North-up regional map">
          <div className="absolute inset-[16.66%] rounded-full border border-amber-100/15" />
          <div className="absolute inset-[33.33%] rounded-full border border-amber-100/10" />
          <span className="absolute left-1/2 top-[5%] -translate-x-1/2 text-xs font-semibold text-cyan-100">N</span>
          <span className="absolute left-1/2 top-1/2 h-px w-full -translate-y-1/2 bg-white/10" />
          <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/10" />
          <button type="button" title="Ares Cradle habitat" aria-label="Ares Cradle habitat" style={position(0, 0)} className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100 bg-cyan-300 p-1.5 shadow-[0_2px_8px_rgba(0,0,0,.45)]" />
          {WORLD_REGIONS.map((region) => <button key={region.id} type="button" title={`${region.name} · set waypoint`} aria-label={`${region.name}, set waypoint${activeRegionId === region.id ? ', your region' : ''}`} aria-pressed={activeWaypointRegionId === region.id} onClick={() => onSetWaypoint(region.id)} style={position(region.center.x, region.center.z)} className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border p-1.5 shadow-[0_2px_8px_rgba(0,0,0,.45)] ${activeRegionId === region.id ? 'border-amber-100 bg-amber-300 ring-2 ring-amber-200/60' : 'border-[#ecd4c0] bg-[#9c6244]'}`} />)}
          <span aria-label="You are here" title="You are here" style={position(playerPos[0], playerPos[2])} className="absolute z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-cyan-300 shadow-[0_0_0_3px_rgba(34,211,238,.25)]" />
          <span className="absolute bottom-2 left-2 rounded bg-[#101214]/85 px-2 py-1 text-[11px] text-[#e1cec0]">Home + 5 survey regions</span>
        </div>
        <div className="min-w-0">
          <h3 className="mb-2 text-sm font-semibold text-[#f1e1d3]">Set a waypoint</h3>
          <p className="mb-3 text-xs leading-relaxed text-[#cbb8a8]">A waypoint changes your navigation target only. Reach each region through the terrain or an available rover route.</p>
          <div className="flex flex-col gap-1.5">
            {WORLD_REGIONS.map((region) => <button key={region.id} type="button" aria-pressed={activeWaypointRegionId === region.id} onClick={() => onSetWaypoint(region.id)} className={`flex min-h-12 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 ${activeWaypointRegionId === region.id ? 'border-amber-200/60 bg-amber-200/10 text-amber-50' : 'border-white/15 bg-[#111416] text-[#e3d2c4] hover:border-white/30'}`}>
              <span>{region.name}</span><span className="text-xs tabular-nums text-[#ccb9a8]">{Math.round(Math.hypot(playerPos[0] - region.baseConsole.x, playerPos[2] - region.baseConsole.z))} m</span>
            </button>)}
          </div>
        </div>
      </div>
    </section>
  </div>;
};

export default ExplorationMap;
