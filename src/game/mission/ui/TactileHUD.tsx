import React, { useEffect } from 'react';
import { useMissionStore } from '../state/store';
import { RegionId } from '../contract';
import {
  Map,
  BookOpen,
  Building2,
  Radio,
  Zap,
  Utensils,
  Droplets,
  Wind,
  Volume2,
  VolumeX,
  Flag,
  User,
  Truck
} from 'lucide-react';

interface TactileHUDProps {
  onToggleSound?: () => void;
  isMuted?: boolean;
}

const REGION_COORDS: Record<RegionId, [number, number, number]> = {
  dust: [0, 0, 0],
  ice: [210, 0, -180],
  lake: [200, 0, 170],
};

export const TactileHUD: React.FC<TactileHUDProps> = ({ onToggleSound, isMuted = false }) => {
  const currentRegion = useMissionStore((s) => s.currentRegion);
  const supportBaseId = useMissionStore((s) => s.supportBaseId);
  const bases = useMissionStore((s) => s.bases);
  const surveys = useMissionStore((s) => s.surveys);
  const completedReports = useMissionStore((s) => s.completedReports);
  const activeControl = useMissionStore((s) => s.activeControl);
  const solDay = useMissionStore((s) => s.solDay);
  const timeOfDay = useMissionStore((s) => s.timeOfDay);
  const activeModal = useMissionStore((s) => s.activeModal);
  const setModal = useMissionStore((s) => s.setModal);
  const toggleControl = useMissionStore((s) => s.toggleControl);
  const recentNotification = useMissionStore((s) => s.recentNotification);
  const leoPose = useMissionStore((s) => s.leoPose);
  const roverPoses = useMissionStore((s) => s.roverPoses);

  const activeBase = bases[supportBaseId] || bases[currentRegion];
  const currentSurvey = surveys[currentRegion];

  // Proximity to active outpost airlock
  const playerPose = activeControl === 'rover' ? (roverPoses[currentRegion] || leoPose) : leoPose;
  const currentBasePos = REGION_COORDS[currentRegion];
  const distToBase = Math.hypot(playerPose[0] - currentBasePos[0], playerPose[2] - currentBasePos[2]);
  const isNearBase = distToBase < 16.0;

  // Dynamic tactical objective
  let objectiveText = 'Survey regional landmarks on foot or with rover.';
  if (currentSurvey.focalPointsDone.length < 2) {
    objectiveText = `Collect evidence from focal points (${currentSurvey.focalPointsDone.length}/2 required to unlock science activity).`;
  } else if (!currentSurvey.essentialShiftPaid) {
    objectiveText = 'Commit shift pack (2 EU, 1 Meal, 1 Water, 1 Air) at base to begin science activity.';
  } else if (!currentSurvey.minigameCompleted) {
    objectiveText = 'Run regional science minigame activity at field terminal.';
  } else if (!currentSurvey.secondaryJobSelected) {
    objectiveText = 'Select 1 priority engineering job (2 EU) to apply operational upgrade.';
  } else if (!currentSurvey.reportCompleted) {
    objectiveText = 'Finalize and file region scientific report.';
  } else if (completedReports.length < 3) {
    objectiveText = `Region complete! Travel to remaining outposts (${completedReports.length}/3 done).`;
  } else {
    objectiveText = '🌟 ALL 3 REGION REPORTS FILED! Open Finale Review to certify base for Ares-1.';
  }

  // Keyboard shortcut listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'm' || e.key === 'M') {
        setModal(activeModal === 'map' ? null : 'map');
      } else if (e.key === 'n' || e.key === 'N') {
        setModal(activeModal === 'notebook' ? null : 'notebook');
      } else if (e.key === 'b' || e.key === 'B' || e.key === 'e' || e.key === 'E') {
        useMissionStore.getState().setSupportBase(currentRegion);
        setModal(activeModal === 'base' ? null : 'base');
      } else if (e.key === 'f' || e.key === 'F' || e.key === 'r' || e.key === 'R') {
        toggleControl();
      } else if (e.key === 'g' || e.key === 'G') {
        if (currentSurvey.essentialShiftPaid && !currentSurvey.minigameCompleted) {
          setModal('minigame');
        }
      } else if (e.key === 'Escape') {
        setModal(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal, setModal, toggleControl, currentSurvey]);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-40 select-none font-sans">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
        {/* Left: Region & Sol indicator */}
        <div className="flex items-center gap-3 bg-[#1C2026]/90 backdrop-blur-md px-4 py-2 rounded-lg border border-[#F4F1EA]/20 shadow-lg">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5A1F] animate-ping" />
              <h1 className="text-base font-bold font-mono tracking-wider text-[#F4F1EA] uppercase">
                {bases[currentRegion]?.name || currentRegion}
              </h1>
              <span className="text-xs px-2 py-0.5 rounded bg-[#00D2FF]/20 text-[#00D2FF] font-mono border border-[#00D2FF]/40 uppercase">
                {currentRegion} Sector
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-[#F4F1EA]/70 mt-0.5">
              <span>SOL {solDay}</span>
              <span>•</span>
              <span>{timeOfDay}</span>
              <span>•</span>
              <span className="text-[#00D2FF]">Reports: {completedReports.length}/3</span>
            </div>
          </div>
        </div>

        {/* Center: Objective Banner */}
        <div className="hidden lg:flex items-center gap-2 bg-[#16191E]/90 backdrop-blur-md px-4 py-2 rounded-lg border border-[#00D2FF]/30 shadow-lg max-w-md">
          <Flag className="w-4 h-4 text-[#00D2FF] shrink-0" />
          <p className="text-xs font-mono text-[#F4F1EA]/90 truncate leading-snug">
            {objectiveText}
          </p>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2">
          {/* Actor Control Switch */}
          <button
            type="button"
            onClick={toggleControl}
            className={`px-3 py-2 rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow-md border ${
              activeControl === 'rover'
                ? 'bg-[#FF5A1F] text-black border-[#FF5A1F]'
                : 'bg-[#1C2026]/90 text-[#F4F1EA] border-[#F4F1EA]/20 hover:border-[#FF5A1F]'
            }`}
            title="Press [F] to toggle Sol Relay rover control"
          >
            {activeControl === 'rover' ? <Truck className="w-4 h-4" /> : <User className="w-4 h-4" />}
            <span>{activeControl === 'rover' ? 'ROVER DRIVE [F]' : 'CADET LEO [F]'}</span>
          </button>

          {/* Base Terminal Button */}
          <button
            type="button"
            onClick={() => setModal(activeModal === 'base' ? null : 'base')}
            className={`px-3 py-2 rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow-md border ${
              activeModal === 'base'
                ? 'bg-[#00D2FF] text-black border-[#00D2FF]'
                : 'bg-[#1C2026]/90 text-[#F4F1EA] border-[#F4F1EA]/20 hover:border-[#00D2FF]'
            }`}
            title="Press [B] for Base Management Terminal"
          >
            <Building2 className="w-4 h-4" />
            <span>BASE [B]</span>
          </button>

          {/* Field Notebook */}
          <button
            type="button"
            onClick={() => setModal(activeModal === 'notebook' ? null : 'notebook')}
            className={`px-3 py-2 rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow-md border ${
              activeModal === 'notebook'
                ? 'bg-[#FFB800] text-black border-[#FFB800]'
                : 'bg-[#1C2026]/90 text-[#F4F1EA] border-[#F4F1EA]/20 hover:border-[#FFB800]'
            }`}
            title="Press [N] for Field Notebook & NASA STEM Cards"
          >
            <BookOpen className="w-4 h-4" />
            <span>NOTEBOOK [N]</span>
          </button>

          {/* World Map */}
          <button
            type="button"
            onClick={() => setModal(activeModal === 'map' ? null : 'map')}
            className={`px-3 py-2 rounded-lg font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow-md border ${
              activeModal === 'map'
                ? 'bg-[#2A9D8F] text-black border-[#2A9D8F]'
                : 'bg-[#1C2026]/90 text-[#F4F1EA] border-[#F4F1EA]/20 hover:border-[#2A9D8F]'
            }`}
            title="Press [M] for World Map & Fast Travel"
          >
            <Map className="w-4 h-4" />
            <span>MAP [M]</span>
          </button>

          {/* Finale Button if all 3 completed */}
          {completedReports.length >= 3 && (
            <button
              type="button"
              onClick={() => setModal('finale')}
              className="px-3 py-2 rounded-lg font-mono text-xs font-bold bg-[#FF5A1F] hover:bg-[#ff723f] text-black border border-[#FF5A1F] flex items-center gap-1.5 animate-pulse shadow-lg"
              title="All 3 regions completed! Open Finale Review"
            >
              <Radio className="w-4 h-4" />
              <span>FINALE REVIEW</span>
            </button>
          )}

          {/* Audio Mute */}
          {onToggleSound && (
            <button
              type="button"
              onClick={onToggleSound}
              className="p-2 rounded-lg bg-[#1C2026]/90 text-[#F4F1EA] border border-[#F4F1EA]/20 hover:border-[#F4F1EA]/40 transition-all shadow-md"
              title="Toggle Audio"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-green-400" />}
            </button>
          )}
        </div>
      </div>

      {/* Top Floating Notification Toast (Clean, doesn't block center crosshair) */}
      {recentNotification && (
        <div className="mx-auto pointer-events-auto max-w-xl transition-all duration-300 mt-2">
          <div className="px-4 py-2 bg-[#1C2026]/95 backdrop-blur-md border border-[#FF5A1F]/50 text-[#F4F1EA] rounded-lg shadow-xl flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#00D2FF]" />
            <span className="text-xs font-mono font-medium leading-relaxed">{recentNotification}</span>
          </div>
        </div>
      )}

      {/* Bottom Bar: Invariant I09 Resource Gauges & Context Prompt */}
      <div className="flex flex-wrap items-end justify-between gap-4 pointer-events-auto mt-auto">
        {/* Left: Tactile Hardware Resource Dials */}
        <div className="flex items-center gap-2 bg-[#1C2026]/90 backdrop-blur-md p-2.5 rounded-lg border border-[#F4F1EA]/20 shadow-lg">
          {/* Energy Dial */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#16191E] rounded border border-[#F4F1EA]/10">
            <Zap className="w-4 h-4 text-[#FFB800]" />
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-[#F4F1EA]/60 uppercase">Power</span>
              <span className="text-sm font-bold font-mono text-[#F4F1EA]">{activeBase.resources.energy} EU</span>
            </div>
          </div>

          {/* Meals Dial */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#16191E] rounded border border-[#F4F1EA]/10">
            <Utensils className="w-4 h-4 text-orange-400" />
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-[#F4F1EA]/60 uppercase">Rations</span>
              <span className="text-sm font-bold font-mono text-[#F4F1EA]">{activeBase.resources.meals} Meals</span>
            </div>
          </div>

          {/* Clean Water Dial */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#16191E] rounded border border-[#F4F1EA]/10">
            <Droplets className="w-4 h-4 text-[#00D2FF]" />
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-[#F4F1EA]/60 uppercase">Clean H₂O</span>
              <span className="text-sm font-bold font-mono text-[#F4F1EA]">{activeBase.resources.water} Portions</span>
            </div>
          </div>

          {/* Air Packs Dial */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#16191E] rounded border border-[#F4F1EA]/10">
            <Wind className="w-4 h-4 text-cyan-300" />
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-[#F4F1EA]/60 uppercase">Air Packs</span>
              <span className="text-sm font-bold font-mono text-[#F4F1EA]">{activeBase.resources.airPacks} Packs</span>
            </div>
          </div>
        </div>

        {/* Right: Tactile Context Pill & Airlock Access */}
        <div className="flex items-center gap-2">
          {isNearBase && activeModal === null && (
            <button
              type="button"
              onClick={() => setModal('base')}
              className="bg-[#00D2FF] hover:bg-[#3cdcff] text-black font-mono text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,210,255,0.4)] border border-white animate-pulse transition-all cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>[E] OPEN BASE TERMINAL</span>
            </button>
          )}

          <div className="bg-[#1C2026]/90 backdrop-blur-md px-4 py-2.5 rounded-lg border border-[#F4F1EA]/20 shadow-lg text-xs font-mono text-[#F4F1EA]/80 flex items-center gap-3">
            <span>Controls: <strong className="text-[#00D2FF]">WASD</strong></span>
            <span>•</span>
            <span><strong className="text-[#00D2FF]">[B]</strong> Base</span>
            <span>•</span>
            <span><strong className="text-[#00D2FF]">[M]</strong> Map</span>
            <span>•</span>
            <span><strong className="text-[#00D2FF]">[N]</strong> Notes</span>
          </div>
        </div>
      </div>
    </div>
  );
};
