import React from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Lightbulb, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, LogOut, Gauge } from 'lucide-react';
import { useOutpostStore } from '@/modules/store/useOutpostStore';
import { soundEngine } from '@/modules/audio/soundEngine';

export const CockpitDrivingDeck: React.FC = () => {
  const isDrivingRover = useOutpostStore((state) => state.isDrivingRover);
  const roverSpeed = useOutpostStore((state) => state.roverSpeed);
  const toggleDrivingRover = useOutpostStore((state) => state.toggleDrivingRover);
  const roverHeadlightMode = useOutpostStore((state) => state.roverHeadlightMode);
  const toggleRoverHeadlightMode = useOutpostStore((state) => state.toggleRoverHeadlightMode);
  const setIsMouseDriving = useOutpostStore((state) => state.setIsMouseDriving);
  const setJoystickVector = useOutpostStore((state) => state.setJoystickVector);

  if (!isDrivingRover) return null;

  const triggerUTurn = () => {
    if (!Number.isFinite(roverSpeed) || roverSpeed <= 0.3) return;
    soundEngine.playClick(1400);
    window.dispatchEvent(new CustomEvent('rover:uturn'));
  };

  // Nav controls simulator
  const handleNavStart = (axis: 'forward' | 'backward' | 'left' | 'right') => {
    soundEngine.playClick(800);
    if (axis === 'forward') {
      setIsMouseDriving(true);
      setJoystickVector({ x: 0, y: -1.0 });
    } else if (axis === 'backward') {
      setJoystickVector({ x: 0, y: 1.0 });
    } else if (axis === 'left') {
      setJoystickVector({ x: -1.0, y: 0 });
    } else if (axis === 'right') {
      setJoystickVector({ x: 1.0, y: 0 });
    }
  };

  const handleNavEnd = () => {
    setIsMouseDriving(false);
    setJoystickVector({ x: 0, y: 0 });
  };

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 50, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 350 }}
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-3 select-none font-mono text-xs"
    >
      {/* Driving Deck Shell */}
      <div className="flex items-center gap-2 sm:gap-3 px-4 py-2 rounded-2xl bg-slate-950/95 border-2 border-cyan-500/50 shadow-[0_0_25px_rgba(0,0,0,0.8),0_0_15px_rgba(0,240,255,0.3)] text-white">
        
        {/* Speedometer Gauge Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300">
          <Gauge className="w-4 h-4 text-cyan-400" />
          <div className="text-left leading-none">
            <span className="text-[9px] text-slate-400 block font-sans">SPEED</span>
            <span className="font-bold text-xs">{Number.isFinite(roverSpeed) ? Math.abs(roverSpeed * 3.6).toFixed(1) : '0.0'} KM/H{roverSpeed < -0.01 ? ' R' : ''}</span>
          </div>
        </div>

        {/* Desktop Keyboard Hint (Hidden on Mobile/Touch) */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-[11px]">
          <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-cyan-300 font-bold text-[10px]">W / S</kbd>
          <span>Accelerate / reverse</span>
          <span className="text-slate-600">·</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-amber-300 font-bold text-[10px]">R</kbd>
          <span>Exit</span>
        </div>

        {/* 180° U-Turn Button */}
        <button
          onClick={triggerUTurn}
          disabled={!Number.isFinite(roverSpeed) || roverSpeed <= 0.3}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-[0_0_12px_rgba(245,158,11,0.4)] transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title="While rolling forward, hold accelerator for a curved U-turn"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="tracking-wider">CURVED U-TURN</span>
        </button>

        {/* Dual Headlight Switch */}
        <button
          onClick={toggleRoverHeadlightMode}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all active:scale-95 cursor-pointer ${
            roverHeadlightMode === 'high'
              ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.5)]'
              : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
          }`}
          title="Toggle Headlight Beam (Low 14m / High 34m)"
        >
          <Lightbulb className="w-4 h-4 text-yellow-300" />
          <span>{roverHeadlightMode === 'high' ? 'HIGH BEAM 34M' : 'LOW BEAM 14M'}</span>
        </button>

        {/* On-Screen Touch Directional D-Pad (Shown only on Mobile/Tablet < 1024px) */}
        <div className="flex lg:hidden items-center gap-1 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
          <button
            onPointerDown={() => handleNavStart('left')}
            onPointerUp={handleNavEnd}
            onPointerLeave={handleNavEnd}
            onPointerCancel={handleNavEnd}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 active:bg-cyan-500 active:text-black cursor-pointer"
            title="Steer Left"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onPointerDown={() => handleNavStart('forward')}
            onPointerUp={handleNavEnd}
            onPointerLeave={handleNavEnd}
            onPointerCancel={handleNavEnd}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 active:bg-cyan-500 active:text-black cursor-pointer"
            title="Accelerate Forward"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            onPointerDown={() => handleNavStart('backward')}
            onPointerUp={handleNavEnd}
            onPointerLeave={handleNavEnd}
            onPointerCancel={handleNavEnd}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 active:bg-cyan-500 active:text-black cursor-pointer"
            title="Reverse"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            onPointerDown={() => handleNavStart('right')}
            onPointerUp={handleNavEnd}
            onPointerLeave={handleNavEnd}
            onPointerCancel={handleNavEnd}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 active:bg-cyan-500 active:text-black cursor-pointer"
            title="Steer Right"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Exit / Dismount Rover Button */}
        <button
          onClick={toggleDrivingRover}
          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 active:scale-95 cursor-pointer"
          title="Exit Rover (Spawns beside door)"
        >
          <LogOut className="w-4 h-4" />
          <span>EXIT</span>
        </button>

      </div>
    </motion.div>
  );
};

export default CockpitDrivingDeck;
