import React from 'react';
import { useMissionStore } from '../state/store';
import { RegionId } from '../contract';
import { X, Navigation, CheckCircle2, Lock } from 'lucide-react';

interface WorldMapModalProps {
  onClose: () => void;
}

const REGION_MAP_INFO: Record<RegionId, { name: string; code: string; x: number; y: number; color: string; desc: string }> = {
  dust: {
    name: 'Wind Basin',
    code: 'SECTOR-01 · WIND',
    x: 50,
    y: 50,
    color: '#FFB800',
    desc: 'Central dust bowl, anemometer wind mast, and primary photovoltaic solar farm.'
  },
  ice: {
    name: 'Sealed Ice Cliff',
    code: 'SECTOR-02 · ICE',
    x: 82,
    y: 22,
    color: '#00D2FF',
    desc: 'Debris-mantled glacier face, cryogenic ultrasonic core rig, and water processing.'
  },
  lake: {
    name: 'Ancient Lake Shore',
    code: 'SECTOR-03 · LAKE',
    x: 80,
    y: 78,
    color: '#2A9D8F',
    desc: 'Dried river delta mudstones, robotic arm sampling station, and biosignature cache.'
  }
};

export const WorldMapModal: React.FC<WorldMapModalProps> = ({ onClose }) => {
  const bases = useMissionStore((s) => s.bases);
  const currentRegion = useMissionStore((s) => s.currentRegion);
  const completedReports = useMissionStore((s) => s.completedReports);
  const fastTravel = useMissionStore((s) => s.fastTravel);

  const handleTravel = (regionId: RegionId) => {
    fastTravel(regionId);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 select-none">
      <div className="bg-[#1C2026] border-2 border-[#00D2FF]/40 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans text-[#F4F1EA]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#F4F1EA]/10 bg-[#16191E]">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#00D2FF]" />
            <div>
              <h2 className="text-xl font-bold font-mono tracking-wider text-[#F4F1EA] uppercase">
                Tactical Surface Map — 600×600 Martian Grid
              </h2>
              <p className="text-xs text-[#F4F1EA]/70">
                5 interconnected scientific regions. Discovered outposts enable instantaneous fast-travel.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-[#F4F1EA]/10 rounded-lg text-[#F4F1EA]/70 hover:text-[#F4F1EA] transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Map Canvas / SVG Radar Display */}
        <div className="relative flex-1 min-h-[380px] bg-[#12151A] overflow-hidden p-6 flex items-center justify-center">
          {/* Subtle Radar Ring Overlays */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <div className="w-[80%] h-[80%] rounded-full border border-[#00D2FF]" />
            <div className="w-[50%] h-[50%] rounded-full border border-[#00D2FF]" />
            <div className="w-[20%] h-[20%] rounded-full border border-[#00D2FF]" />
            <div className="absolute w-full h-[1px] bg-[#00D2FF]/40" />
            <div className="absolute h-full w-[1px] bg-[#00D2FF]/40" />
          </div>

          {/* SVG Sector Connector Lines (Invariant I01 Graph) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-[#F4F1EA]/20 stroke-2 stroke-dasharray-4">
            {/* Impact (20,25) to Dust (50,50) */}
            <line x1="20%" y1="25%" x2="50%" y2="50%" />
            {/* Ice (82,22) to Dust (50,50) */}
            <line x1="82%" y1="22%" x2="50%" y2="50%" />
            {/* Volcano (18,80) to Dust (50,50) */}
            <line x1="18%" y1="80%" x2="50%" y2="50%" />
            {/* Lake (80,78) to Dust (50,50) */}
            <line x1="80%" y1="78%" x2="50%" y2="50%" />
            {/* Impact (20,25) to Volcano (18,80) */}
            <line x1="20%" y1="25%" x2="18%" y2="80%" />
            {/* Ice (82,22) to Lake (80,78) */}
            <line x1="82%" y1="22%" x2="80%" y2="78%" />
          </svg>

          {/* Region Outpost Nodes */}
          <div className="relative w-full h-full">
            {(Object.keys(REGION_MAP_INFO) as RegionId[]).map((regId) => {
              const info = REGION_MAP_INFO[regId];
              const base = bases[regId];
              const isCurrent = currentRegion === regId;
              const isReportDone = completedReports.includes(regId);
              const isDiscovered = base.isDiscovered;

              return (
                <div
                  key={regId}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer"
                  style={{ left: `${info.x}%`, top: `${info.y}%` }}
                  onClick={() => isDiscovered && handleTravel(regId)}
                >
                  {/* Glowing Node Button */}
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-all border-2 ${
                      isCurrent
                        ? 'ring-4 ring-[#00D2FF] scale-110'
                        : isDiscovered
                        ? 'hover:scale-105'
                        : 'opacity-50 grayscale'
                    }`}
                    style={{
                      backgroundColor: isDiscovered ? '#1C2026' : '#12151A',
                      borderColor: isDiscovered ? info.color : '#4A5568',
                    }}
                  >
                    {isReportDone ? (
                      <CheckCircle2 className="w-6 h-6 text-green-400" />
                    ) : isDiscovered ? (
                      <Navigation className="w-5 h-5" style={{ color: info.color }} />
                    ) : (
                      <Lock className="w-5 h-5 text-gray-500" />
                    )}
                  </div>

                  {/* Label Card */}
                  <div className="mt-2 text-center bg-[#1C2026]/90 px-3 py-1 rounded border border-[#F4F1EA]/10 shadow-md">
                    <span className="font-bold text-xs font-mono block text-[#F4F1EA] whitespace-nowrap">
                      {info.name}
                    </span>
                    <span className="text-[10px] text-[#F4F1EA]/60 font-mono block">
                      {info.code} • {isDiscovered ? (isCurrent ? 'YOU ARE HERE' : 'FAST TRAVEL') : 'UNDISCOVERED'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Region Inspection Cards Footer */}
        <div className="p-4 bg-[#16191E] border-t border-[#F4F1EA]/10 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-[#00D2FF]">
              <span className="w-2 h-2 rounded-full bg-[#00D2FF]" /> Active Outpost
            </span>
            <span className="flex items-center gap-1.5 text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Survey Report Completed
            </span>
            <span className="flex items-center gap-1.5 text-gray-400">
              <Lock className="w-3.5 h-3.5" /> Undiscovered Sector
            </span>
          </div>

          <span className="text-[#F4F1EA]/60">
            Click any discovered outpost icon to Fast Travel instantly.
          </span>
        </div>
      </div>
    </div>
  );
};
