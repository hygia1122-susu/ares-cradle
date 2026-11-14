import React from 'react';
import { Backpack, BookOpen, HelpCircle, Map, Wind, Utensils, Zap } from 'lucide-react';

export interface ExplorationHUDProps {
  task: string;
  taskProgress?: { current: number; required: number };
  regionName: string;
  distance?: number;
  air: number;
  meals: number;
  energyEU: number;
  onBackpack: () => void;
  onMap: () => void;
  onCodex: () => void;
  onHelp: () => void;
  remote?: boolean;
  onExitRemote?: () => void;
  notice?: string | null;
  onDismissNotice?: () => void;
}

const IconButton: React.FC<{ label: string; shortcut: string; onClick: () => void; children: React.ReactNode }> = ({ label, shortcut, onClick, children }) => (
  <button
    type="button"
    aria-label={label}
    title={`${label} (${shortcut})`}
    onClick={onClick}
    className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 bg-[#151a1d]/90 text-[#f1d5be] shadow-[0_3px_12px_rgba(0,0,0,.32)] transition-colors hover:border-amber-300/70 hover:bg-[#25201c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 touch-manipulation"
  >{children}</button>
);

function ResourceSegments({ label, value, capacity, segments, icon }: { label: string; value: number; capacity: number; segments: number; icon: React.ReactNode }) {
  const safeValue = Math.max(0, Math.min(capacity, Number.isFinite(value) ? value : 0));
  const filled = (safeValue / capacity) * segments;
  return (
    <div aria-label={`${label} ${safeValue}/${capacity}`} data-testid={`resource-${label.toLowerCase()}`} className={`flex h-6 items-center gap-0.5 rounded-md bg-[#171a1c]/90 px-1 text-[#f5e8dc] md:h-7 md:gap-1.5 md:px-2 ${safeValue / capacity <= 0.2 ? 'resource-low' : ''}`} title={`${label} ${safeValue.toFixed(safeValue % 1 ? 1 : 0)} / ${capacity}`}>
      <span className="w-7 shrink-0 text-[10px] font-medium md:w-9 md:text-[11px]">{label}</span>
      <span className="flex min-w-0 flex-1 items-center justify-between gap-0 md:gap-px" aria-hidden="true">
        {Array.from({ length: segments }, (_, index) => {
          const fill = Math.max(0, Math.min(1, filled - index));
          return <span key={index} className="relative inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center text-white/25 max-[400px]:h-[9px] max-[400px]:w-[9px]">
            {icon}
            <span className="absolute inset-y-0 left-0 overflow-hidden text-amber-300" style={{ width: `${fill * 100}%` }}>{icon}</span>
          </span>;
        })}
      </span>
      <span className="w-5 shrink-0 text-right text-[10px] tabular-nums text-[#f1d5be] md:w-7">{Math.round(safeValue)}</span>
      <span className="sr-only">{label} {safeValue} of {capacity}</span>
    </div>
  );
}

export const ExplorationHUD: React.FC<ExplorationHUDProps> = ({
  task, taskProgress, regionName, distance, air, meals, energyEU,
  onBackpack, onMap, onCodex, onHelp, remote, onExitRemote, notice, onDismissNotice,
}) => (
  <div data-testid="exploration-hud" className="pointer-events-none absolute inset-0 z-30 text-white">
    <section aria-label="Current exploration objective" className="pointer-events-auto absolute left-3 top-3 w-[min(calc(100vw-160px),22rem)] rounded-lg border border-amber-200/25 bg-[#171a1c]/90 px-3 py-2 shadow-[0_4px_18px_rgba(0,0,0,.38)]">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#f4dec9]">
        <span className="truncate">{task}</span>
        {taskProgress && <span className="shrink-0 text-xs tabular-nums text-cyan-200">{taskProgress.current}/{taskProgress.required}</span>}
      </div>
      <p className="mt-0.5 truncate text-xs text-[#e8c8aa]">{regionName}{Number.isFinite(distance) ? ` · ${Math.round(distance!)} m` : ''}</p>
    </section>

    <div className="pointer-events-auto absolute bottom-28 left-3 flex w-[min(10.5rem,calc(100vw-1.5rem))] flex-col gap-1 rounded-lg border border-white/15 bg-[#171a1c]/90 p-1.5 shadow-[0_4px_18px_rgba(0,0,0,.38)] sm:w-[min(13.5rem,calc(100vw-1.5rem))] lg:bottom-5 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2" aria-label="Suit supplies">
      <ResourceSegments label="Air" value={air} capacity={100} segments={10} icon={<Wind className="h-2.5 w-2.5 max-[400px]:h-2 max-[400px]:w-2" />} />
      <ResourceSegments label="Meals" value={meals} capacity={12} segments={10} icon={<Utensils className="h-2.5 w-2.5 max-[400px]:h-2 max-[400px]:w-2" />} />
      <ResourceSegments label="Energy" value={energyEU} capacity={100} segments={10} icon={<Zap className="h-2.5 w-2.5 max-[400px]:h-2 max-[400px]:w-2" />} />
    </div>

    {remote && <button type="button" onClick={onExitRemote} className="pointer-events-auto absolute right-3 top-44 min-h-10 rounded-md border border-cyan-200/40 bg-[#122328]/95 px-3 text-xs font-medium text-cyan-100 hover:bg-[#183139] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">Exit remote scout</button>}

    <nav aria-label="Exploration tools" className="pointer-events-auto absolute bottom-[14rem] left-3 flex gap-2 lg:bottom-3">
      <IconButton label="Backpack" shortcut="E" onClick={onBackpack}><Backpack className="h-5 w-5" /></IconButton>
      <IconButton label="Map" shortcut="M" onClick={onMap}><Map className="h-5 w-5" /></IconButton>
      <IconButton label="Science codex" shortcut="G" onClick={onCodex}><BookOpen className="h-5 w-5" /></IconButton>
      <IconButton label="Controls and help" shortcut="?" onClick={onHelp}><HelpCircle className="h-5 w-5" /></IconButton>
    </nav>

    {notice && <div role="status" className="pointer-events-auto absolute bottom-3 left-1/2 flex max-w-[min(92vw,30rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-amber-200/35 bg-[#221c17]/95 px-3 py-2 text-sm text-amber-50 shadow-[0_4px_18px_rgba(0,0,0,.4)]">
      <span>{notice}</span><button type="button" aria-label="Dismiss notice" onClick={onDismissNotice} className="min-h-9 min-w-9 rounded border border-amber-100/25 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">×</button>
    </div>}
  </div>
);

export default ExplorationHUD;
