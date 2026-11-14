import React, { useRef } from 'react';
import { useExplorationDialog } from './useExplorationDialog';
import { Eye, Keyboard, MousePointer2, Package, ScanSearch, X } from 'lucide-react';

export interface QuickControlsManualProps {
  isOpen: boolean;
  onStart: () => void;
  onClose: () => void;
}

export const QuickControlsManual: React.FC<QuickControlsManualProps> = ({ isOpen, onStart, onClose }) => {
  const dialogRef = useRef<HTMLElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  useExplorationDialog(isOpen, onClose, dialogRef, startRef);
  if (!isOpen) return null;

  const control = (icon: React.ReactNode, title: string, description: string) => (
    <div className="flex items-start gap-3 border-b border-white/10 py-3 last:border-0">
      <span aria-hidden="true" className="mt-0.5 text-amber-200">{icon}</span>
      <div><h3 className="text-sm font-semibold text-[#f4e2d2]">{title}</h3><p className="mt-0.5 text-sm leading-relaxed text-[#dfcfc1]">{description}</p></div>
    </div>
  );

  return <div className="pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center bg-[#080a0b]/85 p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="exploration-manual-title" className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col rounded-xl border border-amber-200/30 bg-[#171a1c] p-5 text-white shadow-[0_12px_36px_rgba(0,0,0,.55)] sm:p-6">
      <header className="mb-2 flex shrink-0 items-start justify-between gap-4">
        <div><h2 id="exploration-manual-title" className="text-xl font-semibold tracking-tight text-[#f3e1d1]">A field guide to moving around</h2><p className="mt-1 text-sm text-[#cbb7a6]">Leave the screens behind. The landscape is the interface.</p></div>
        <button type="button" onClick={onClose} aria-label="Close controls and help" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/20 text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"><X className="h-5 w-5" /></button>
      </header>
      <div className="min-h-0 overflow-y-auto overscroll-contain">
        {control(<Keyboard className="h-5 w-5" />, 'W A S D', 'Walk across the terrain. Hold Shift to sprint; press Space to jump, and Space again in the air for a short EVA boost.')}
        {control(<MousePointer2 className="h-5 w-5" />, 'Look around', 'Click the world to capture the mouse and turn your view. Press Escape to release it. Touch players can look by dragging the scene.')}
        {control(<ScanSearch className="h-5 w-5" />, 'Inspect the field', 'Walk close to a marked scientific feature and press F to inspect it. Discoveries are recorded in your codex.')}
        {control(<Eye className="h-5 w-5" />, 'Remote rover', 'At a rover console, press R to scout from the rover camera. This is remote viewing—not a teleport or a driving seat.')}
        {control(<Package className="h-5 w-5" />, 'Field tools', 'Open your backpack with E, map with M, and science codex with G. Use the buttons on screen whenever you need a reminder.')}
      </div>
      <footer className="mt-4 flex shrink-0 flex-col-reverse gap-2 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className="min-h-12 rounded-lg border border-white/20 px-4 text-sm text-[#e5d4c5] hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">Back to the field</button>
        <button type="button" onClick={onStart} className="min-h-12 rounded-lg border border-amber-200/45 bg-[#8b4d2b] px-5 text-sm font-semibold text-[#fff4e9] shadow-[0_3px_12px_rgba(0,0,0,.28)] hover:bg-[#a45e35] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">Start exploring</button>
      </footer>
    </section>
  </div>;
};

export default QuickControlsManual;
