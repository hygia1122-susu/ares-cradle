import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Backpack,
  X,
  Truck,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  Pin,
  FlaskConical,
  Info
} from 'lucide-react';
import { useOutpostStore } from '@/modules/store/useOutpostStore';
import { useStoryStore, CarriedVial } from '@/modules/store/useStoryStore';
import { soundEngine } from '@/modules/audio/soundEngine';
import {
  ITEM_CATALOG,
  MVP_EQUIPMENT_IDS,
  BLUEPRINT_CATALOG_IDS,
  ItemStatusBadge
} from './itemRegistry';
import AerospaceItemIcon from './AerospaceItemIcon';
import BackpackSurvivalShelf from '@/modules/mission-control/BackpackSurvivalShelf';

const modalSpring = {
  type: 'spring' as const,
  stiffness: 320,
  damping: 28
};

type StorageTab = 'personal' | 'rover' | 'blueprints';

export const BackpackModal: React.FC = () => {
  const isBackpackOpen = useOutpostStore((state) => state.isBackpackOpen);
  const closeBackpack = useOutpostStore((state) => state.closeBackpack);
  const inventory = useOutpostStore((state) => state.inventory);
  const roverInventory = useOutpostStore((state) => state.roverInventory);
  const quickbarSlots = useOutpostStore((state) => state.quickbarSlots);
  const assignQuickbarSlot = useOutpostStore((state) => state.assignQuickbarSlot);
  const executeItemAction = useOutpostStore((state) => state.executeItemAction);
  const transferCargoItem = useOutpostStore((state) => state.transferCargoItem);

  const oxygen = useOutpostStore((state) => state.oxygen);
  const temperature = useOutpostStore((state) => state.temperature);
  const battery = useOutpostStore((state) => state.battery);
  const batteryKwh = useOutpostStore((state) => state.batteryKwh);
  const batteryCapacityKwh = useOutpostStore((state) => state.batteryCapacityKwh);
  const dustCoverage = useOutpostStore((state) => state.dustCoverage);
  const isFlashlightOn = useOutpostStore((state) => state.isFlashlightOn);
  const isInsideHabitat = useOutpostStore((state) => state.isInsideHabitat);
  const isDrivingRover = useOutpostStore((state) => state.isDrivingRover);
  const playerPos = useOutpostStore((state) => state.playerPos);
  const roverPos = useOutpostStore((state) => state.roverPos);
  const activeEvents = useOutpostStore((state) => state.activeEvents);

  const carriedVials = useStoryStore((state) => state.carriedVials);
  const setLabStationOpen = useStoryStore((state) => state.setLabStationOpen);

  const [activeTab, setActiveTab] = useState<StorageTab>('personal');
  const [selectedItemId, setSelectedItemId] = useState<string>('flashlight');
  const [selectedVialIndex, setSelectedVialIndex] = useState<number | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [showQuickbarPicker, setShowQuickbarPicker] = useState(false);

  const distToRover = Math.hypot(
    playerPos[0] - roverPos[0],
    playerPos[2] - roverPos[2]
  );
  const isNearRover = isDrivingRover || distToRover <= 4.5;
  const distToSolar = Math.hypot(playerPos[0] - -4.5, playerPos[2] - 1.4);
  const distToBase = Math.hypot(playerPos[0], playerPos[2]);
  const hasActiveLeak = activeEvents.some(
    (e) => e.active && !e.resolved && Boolean(e.effects?.leakRateMultiplier)
  );

  // Clear temporary feedback banner when reopening modal
  useEffect(() => {
    if (isBackpackOpen) {
      setStatusBanner(null);
      setShowQuickbarPicker(false);
    }
  }, [isBackpackOpen]);

  // Own the global [E] / [I] toggle and close only this modal on [Escape].
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      const state = useOutpostStore.getState();
      if (e.key === 'Escape') {
        if (!state.isBackpackOpen) return;
        e.preventDefault();
        e.stopPropagation();
        state.closeBackpack();
        return;
      }

      if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
      const key = e.key.toLowerCase();
      if (key !== 'e' && key !== 'i') return;

      const target = e.target as HTMLElement | null;
      if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return;

      const otherDialogOpen = Array.from(document.querySelectorAll('[role="dialog"]')).some(
        (dialog) => dialog.getAttribute('aria-labelledby') !== 'backpack-modal-title'
      );
      if (!state.isBackpackOpen && (otherDialogOpen || state.isManualOpen || state.activeScienceEntryId)) return;

      e.preventDefault();
      e.stopPropagation();
      if (state.isBackpackOpen) state.closeBackpack();
      else state.openBackpack();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute semantic status badge for any catalog item
  const getItemStatusBadge = (itemId: string): {
    badge: ItemStatusBadge;
    colorClass: string;
  } => {
    const def = ITEM_CATALOG[itemId];
    if (!def) {
      return { badge: 'Depleted', colorClass: 'bg-slate-800 text-slate-400 border-slate-700' };
    }
    if (!def.mvpActive) {
      return {
        badge: 'Research unlocked',
        colorClass: 'bg-sky-950/80 text-sky-300 border-sky-500/40'
      };
    }
    if (def.category === 'specimen') {
      return {
        badge: 'Mission sample',
        colorClass: 'bg-amber-950/80 text-amber-300 border-amber-500/50'
      };
    }
    if (itemId === 'flashlight' && isFlashlightOn) {
      return {
        badge: 'In use',
        colorClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-400/60'
      };
    }
    if (activeTab === 'rover') {
      const rCount = roverInventory[itemId] ?? 0;
      return rCount > 0
        ? {
            badge: 'Stored in rover',
            colorClass: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50'
          }
        : {
            badge: 'Depleted',
            colorClass: 'bg-slate-900 text-slate-500 border-slate-800'
          };
    }

    const count = inventory[itemId] ?? 0;
    if (!def.reusable && count <= 0) {
      return {
        badge: 'Depleted',
        colorClass: 'bg-rose-950/60 text-rose-300 border-rose-500/40'
      };
    }

    // Check contextual target readiness
    if (
      (itemId === 'sonic_wiper' && (dustCoverage <= 0.02 || (distToSolar > 10.5 && !isInsideHabitat && distToBase > 8.5))) ||
      ((itemId === 'space_tape' || itemId === 'gasket_set') && !hasActiveLeak && oxygen >= 20.4) ||
      (itemId === 'backup_battery' && batteryKwh >= batteryCapacityKwh - 0.25) ||
      (itemId === 'rover_repair_kit' && !isNearRover)
    ) {
      return {
        badge: 'Needs target',
        colorClass: 'bg-amber-950/70 text-amber-300 border-amber-500/40'
      };
    }

    return {
      badge: 'Ready',
      colorClass: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
    };
  };

  // Map a carried vial to its catalog specimen definition
  const mapVialToCatalogId = (vial: CarriedVial): string => {
    if (vial.specimenId.includes('hematite')) return 'hematite_sample';
    if (vial.category === 'ice') return 'ice_core_sample';
    if (vial.category === 'atmosphere') return 'atmosphere_sample';
    return 'regolith_sample';
  };

  const selectedVial =
    selectedVialIndex !== null ? carriedVials[selectedVialIndex] || null : null;
  const activeInspectItemId = selectedVial
    ? mapVialToCatalogId(selectedVial)
    : selectedItemId;
  const selectedDef = ITEM_CATALOG[activeInspectItemId] || ITEM_CATALOG.flashlight;
  const selectedStatus = getItemStatusBadge(activeInspectItemId);
  const personalCount = inventory[activeInspectItemId] ?? 0;
  const roverCount = roverInventory[activeInspectItemId] ?? 0;
  const pinnedSlotIndex = quickbarSlots.indexOf(activeInspectItemId);

  const handleSelectSlot = (itemId: string) => {
    soundEngine.playClick(1050);
    setSelectedVialIndex(null);
    setSelectedItemId(itemId);
    setStatusBanner(null);
  };

  const handleSelectVial = (idx: number) => {
    soundEngine.playClick(1100);
    setSelectedVialIndex(idx);
    const vial = carriedVials[idx];
    if (vial) {
      setSelectedItemId(mapVialToCatalogId(vial));
    }
    setStatusBanner(null);
  };

  const handlePrimaryAction = () => {
    if (selectedVial) {
      if (isInsideHabitat || distToBase <= 7.5) {
        closeBackpack();
        setLabStationOpen(true);
      } else {
        soundEngine.playClick(450);
        setStatusBanner({
          ok: false,
          message: `Return to the Habitat Bio-Dome Chemical Analyzer (currently ${distToBase.toFixed(1)}m away) to refine ${selectedVial.name}.`
        });
      }
      return;
    }

    const res = executeItemAction(selectedDef.id);
    if (res.ok) {
      setStatusBanner({ ok: true, message: res.feedback });
    } else {
      setStatusBanner({ ok: false, message: res.reason });
    }
  };

  const handleTransfer = (direction: 'to_rover' | 'to_backpack') => {
    const res = transferCargoItem(selectedDef.id, direction);
    setStatusBanner({ ok: res.ok, message: res.reason });
  };

  const visibleGridIds =
    activeTab === 'blueprints' ? BLUEPRINT_CATALOG_IDS : MVP_EQUIPMENT_IDS;

  return (
    <AnimatePresence>
      {isBackpackOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="backpack-modal-title"
        >
          {/* Backdrop Click Dismiss */}
          <div className="absolute inset-0" onClick={closeBackpack} />

          <motion.div
            data-testid="backpack-modal"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={modalSpring}
            className="hud-panel hud-corner-brackets relative z-10 w-full max-w-5xl max-h-[92vh] flex flex-col rounded-xl border border-slate-700 bg-[#111820] text-[#EDF1EC] shadow-2xl overflow-hidden"
          >
            {/* ========================================================
                1. HEADER: Aerospace Equipment & Specimen Manifest
                ======================================================== */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3 bg-[#151E28]">
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-lg border"
                  style={{
                    borderColor: 'var(--hud-border)',
                    color: 'var(--hud-accent)',
                    backgroundColor: 'rgba(0,0,0,0.35)'
                  }}
                >
                  <Backpack className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2
                      id="backpack-modal-title"
                      className="font-display font-bold text-base sm:text-lg tracking-wider text-white uppercase"
                    >
                      EVA Field Equipment & Specimen Manifest
                    </h2>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300 font-bold">
                      [KEY: E] • SIM PAUSED
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-sans">
                    Select any equipment slot to inspect specifications. Use or transfer supplies from the right-hand console.
                  </p>
                </div>
              </div>

              {/* Outpost Telemetry Summary Strip (Distinct from Personal Equipment) */}
              <div className="flex items-center gap-3">
                <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[#0C1117] border border-slate-800 font-mono text-xs tabular-nums">
                  <span title="Outpost Grid Battery (kWh source of truth)">
                    GRID: <strong className="text-amber-300">{batteryKwh.toFixed(1)}/{batteryCapacityKwh.toFixed(0)} kWh</strong> ({battery.toFixed(0)}%)
                  </span>
                  <span className="text-slate-700">|</span>
                  <span title="Habitat Cabin Oxygen Concentration">
                    HAB O₂: <strong className="text-cyan-300">{oxygen.toFixed(1)}%</strong>
                  </span>
                  <span className="text-slate-700">|</span>
                  <span title="Habitat Cabin Temperature">
                    HAB TEMP: <strong className="text-emerald-300">{temperature > 0 ? '+' : ''}{temperature.toFixed(1)}°C</strong>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={closeBackpack}
                  data-testid="close-backpack-btn"
                  className="btn-tactile px-3 py-1.5 rounded-lg text-xs text-slate-200 hover:text-white flex items-center gap-1"
                  aria-label="Close Equipment Manifest"
                >
                  <X className="w-4 h-4" />
                  <span>CLOSE [ESC]</span>
                </button>
              </div>
            </div>

            {/* ========================================================
                2. MAIN BODY: Left Grid + Vials | Right Inspector Console
                ======================================================== */}
            <div className="flex-1 overflow-y-auto p-4">
              <BackpackSurvivalShelf />
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* LEFT COLUMN (7 cols): Storage Tabs, 12-Slot Grid, 3-Vial Specimen Rack & Quickbar */}
              <div className="lg:col-span-7 flex flex-col gap-3.5">
                {/* Storage Location Tabs */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === 'personal'}
                      onClick={() => {
                        soundEngine.playClick(1000);
                        setActiveTab('personal');
                        setSelectedVialIndex(null);
                      }}
                      data-testid="tab-personal-pack"
                      className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeTab === 'personal'
                          ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400'
                          : 'bg-[#18222D] text-slate-300 border border-slate-800 hover:text-white'
                      }`}
                    >
                      <Backpack className="w-3.5 h-3.5" />
                      <span>EVA Suit Pack (12)</span>
                    </button>

                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === 'rover'}
                      onClick={() => {
                        soundEngine.playClick(1000);
                        setActiveTab('rover');
                        setSelectedVialIndex(null);
                      }}
                      data-testid="tab-rover-cargo"
                      className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeTab === 'rover'
                          ? 'bg-amber-500/20 text-amber-200 border border-amber-400'
                          : 'bg-[#18222D] text-slate-300 border border-slate-800 hover:text-white'
                      }`}
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>
                        Rover Cargo {isNearRover ? '(Docked)' : `(${distToRover.toFixed(0)}m)`}
                      </span>
                    </button>

                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeTab === 'blueprints'}
                      onClick={() => {
                        soundEngine.playClick(1000);
                        setActiveTab('blueprints');
                        setSelectedVialIndex(null);
                        setSelectedItemId(BLUEPRINT_CATALOG_IDS[0]);
                      }}
                      data-testid="tab-blueprints"
                      className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeTab === 'blueprints'
                          ? 'bg-sky-500/20 text-sky-200 border border-sky-400'
                          : 'bg-[#18222D] text-slate-300 border border-slate-800 hover:text-white'
                      }`}
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>Phase-2 Specs (8)</span>
                    </button>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400">
                    Click slot to inspect • Does not auto-consume
                  </span>
                </div>

                {/* 12-Slot Equipment Grid */}
                <div
                  data-testid="inventory-equipment-grid"
                  className="grid grid-cols-3 sm:grid-cols-4 gap-2.5"
                >
                  {visibleGridIds.map((itemId) => {
                    const def = ITEM_CATALOG[itemId];
                    if (!def) return null;
                    const count =
                      activeTab === 'rover'
                        ? roverInventory[itemId] ?? 0
                        : inventory[itemId] ?? 0;
                    const isSelected =
                      selectedVialIndex === null && selectedItemId === itemId;
                    const qIndex = quickbarSlots.indexOf(itemId);
                    const { badge } = getItemStatusBadge(itemId);

                    return (
                      <button
                        key={itemId}
                        type="button"
                        data-testid={`slot-${itemId}`}
                        onClick={() => handleSelectSlot(itemId)}
                        className={`slot-tactile relative p-2.5 min-h-[88px] rounded-lg text-left flex flex-col justify-between transition-all ${
                          isSelected
                            ? 'ring-2 ring-cyan-400 border-cyan-400 bg-[#1B2838]'
                            : 'bg-[#141D26] border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        {/* Top row: Quickbar Pin + Count */}
                        <div className="w-full flex items-center justify-between gap-1">
                          {qIndex !== -1 ? (
                            <span
                              className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 font-mono text-[10px] font-bold"
                              title={`Assigned to Quickbar Slot [${qIndex + 1}]`}
                            >
                              #{qIndex + 1}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-500">
                              C{def.catalogNumber.toString().padStart(2, '0')}
                            </span>
                          )}

                          {def.mvpActive ? (
                            <span
                              data-testid={`slot-count-${itemId}`}
                              className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded tabular-nums ${
                                def.reusable
                                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                                  : count > 0
                                  ? 'bg-cyan-950/80 text-cyan-200 border border-cyan-500/40'
                                  : 'bg-slate-900 text-slate-500 border border-slate-800'
                              }`}
                            >
                              {def.reusable ? (itemId === 'flashlight' ? (isFlashlightOn ? 'ON' : 'OFF') : 'TOOL') : `x${count}`}
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-500/30">
                              SPEC
                            </span>
                          )}
                        </div>

                        {/* Center SVG Silhouette Icon */}
                        <div className="my-1 flex items-center justify-center">
                          <AerospaceItemIcon iconId={def.svgIconId} className="w-7 h-7" />
                        </div>

                        {/* Bottom Item Title & Mini Status */}
                        <div className="w-full">
                          <div className="text-xs font-display font-bold text-slate-100 truncate text-center">
                            {def.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate text-center">
                            {badge}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* ========================================================
                    3-SLOT HERMETIC SPECIMEN VIAL RACK (Identity-Preserved)
                    ======================================================== */}
                <div className="p-3 rounded-xl bg-[#151F2A] border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-amber-400" />
                      <span className="font-display font-bold text-xs uppercase tracking-wider text-slate-100">
                        Hermetic Field Specimen Containment Rack ({carriedVials.length}/3 Sealed Vials)
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-amber-300">
                      Mission Samples • Non-Consumable
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {[0, 1, 2].map((slotIdx) => {
                      const vial = carriedVials[slotIdx];
                      const isVialSelected = selectedVialIndex === slotIdx;

                      if (!vial) {
                        return (
                          <div
                            key={`empty-vial-${slotIdx}`}
                            className="p-2.5 rounded-lg bg-[#0E141B] border border-dashed border-slate-800 flex items-center gap-2.5 text-slate-500"
                          >
                            <AerospaceItemIcon iconId="vial" className="w-6 h-6 opacity-40" />
                            <div className="min-w-0">
                              <div className="text-xs font-mono font-bold">
                                VIAL TUBE #{slotIdx + 1}
                              </div>
                              <div className="text-[11px] font-sans">Sterile • Empty</div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={`${vial.specimenId}-${slotIdx}`}
                          type="button"
                          data-testid={`vial-slot-${slotIdx}`}
                          onClick={() => handleSelectVial(slotIdx)}
                          className={`p-2.5 rounded-lg border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                            isVialSelected
                              ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-400'
                              : 'bg-[#121A24] border-amber-500/40 hover:border-amber-400'
                          }`}
                        >
                          <AerospaceItemIcon
                            iconId={
                              vial.category === 'ice'
                                ? 'specimen_ice'
                                : vial.specimenId.includes('hematite')
                                ? 'specimen_hematite'
                                : vial.category === 'atmosphere'
                                ? 'specimen_gas'
                                : 'specimen_rock'
                            }
                            className="w-7 h-7 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-mono font-bold text-amber-300 uppercase">
                                SOL {vial.solCollected ?? 1} SAMPLE
                              </span>
                              <span className="text-[10px] font-mono px-1 rounded bg-amber-500/20 text-amber-200">
                                SEALED
                              </span>
                            </div>
                            <div className="text-xs font-display font-bold text-white truncate">
                              {vial.name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 truncate">
                              ID: {vial.specimenId}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN (5 cols): Detailed Equipment Inspector & Action Console */}
              <div className="lg:col-span-5 flex flex-col justify-between p-4 rounded-xl bg-[#16202B] border border-slate-700/80">
                <div className="space-y-3">
                  {/* Top Inspector Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-[#0D131A] border border-slate-700">
                        <AerospaceItemIcon iconId={selectedDef.svgIconId} className="w-9 h-9" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-mono text-slate-400">
                            CAT #{selectedDef.catalogNumber.toString().padStart(2, '0')}
                          </span>
                          <span
                            className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${selectedStatus.colorClass}`}
                          >
                            {selectedStatus.badge}
                          </span>
                        </div>
                        <h3
                          data-testid="inspector-item-name"
                          className="font-display font-bold text-lg text-white mt-0.5"
                        >
                          {selectedVial ? selectedVial.name : selectedDef.name}
                        </h3>
                        <p className="text-xs font-mono text-cyan-300">
                          {selectedVial
                            ? `Specimen ID: ${selectedVial.specimenId} • Category: ${selectedVial.category.toUpperCase()}`
                            : `Unit: ${selectedDef.unitLabel} • ${selectedDef.reusable ? 'Reusable Instrument' : 'Consumable Supply'}`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Inventory Ownership Counts */}
                  {!selectedVial && selectedDef.mvpActive && (
                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-[#0E151D] border border-slate-800 font-mono text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">IN EVA BACKPACK:</span>
                        <span className="text-white font-bold text-sm">
                          {selectedDef.reusable ? '1 (Mounted)' : `${personalCount} available`}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">IN ROVER CARGO BAY:</span>
                        <span className="text-amber-300 font-bold text-sm">
                          {roverCount} stored
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Technical Specifications & Target Requirement */}
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-[#0E151D] border border-slate-800">
                      <div className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-0.5">
                        Valid Target & Operating Condition
                      </div>
                      <div className="text-slate-100 font-sans">
                        {selectedDef.targetRequirement}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#0E151D] border border-slate-800">
                      <div className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-0.5">
                        Operational Effect / Yield
                      </div>
                      <div className="text-emerald-300 font-mono font-bold">
                        {selectedDef.costOrYieldLabel}
                      </div>
                    </div>

                    <p className="text-slate-200 font-sans leading-relaxed">
                      {selectedVial ? selectedVial.quickFact : selectedDef.description}
                    </p>

                    <div className="p-2.5 rounded-lg bg-slate-900/90 border-l-2 border-cyan-400 text-[11px] text-slate-300 font-sans">
                      <strong className="text-cyan-300 font-mono uppercase block mb-0.5">
                        NASA / Engineering Context:
                      </strong>
                      {selectedDef.scientificNote}
                    </div>
                  </div>

                  {/* Live Action Feedback Banner */}
                  {statusBanner && (
                    <div
                      data-testid="inspector-action-feedback"
                      className={`p-3 rounded-lg border text-xs font-sans flex items-start gap-2 ${
                        statusBanner.ok
                          ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                          : 'bg-amber-950/60 border-amber-500/60 text-amber-200'
                      }`}
                    >
                      {statusBanner.ok ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <span>{statusBanner.message}</span>
                    </div>
                  )}
                </div>

                {/* ========================================================
                    BOTTOM ACTION CONSOLE (Use / Quickbar / Cargo Transfer)
                    ======================================================== */}
                <div className="pt-3 mt-3 border-t border-slate-800 space-y-2">
                  {/* Primary Action Button */}
                  {selectedVial ? (
                    <button
                      type="button"
                      data-testid="inspector-use-btn"
                      onClick={handlePrimaryAction}
                      className="btn-tactile-rust w-full py-2.5 px-4 rounded-lg font-display font-bold text-sm uppercase tracking-wider cursor-pointer"
                    >
                      {isInsideHabitat || distToBase <= 7.5
                        ? 'Open Bio-Dome Analyzer to Process Sample 🔬'
                        : `Return to Bio-Dome Lab (${distToBase.toFixed(0)}m) to Analyze`}
                    </button>
                  ) : selectedDef.mvpActive ? (
                    <button
                      type="button"
                      data-testid="inspector-use-btn"
                      onClick={handlePrimaryAction}
                      disabled={!selectedDef.reusable && personalCount <= 0}
                      className="btn-tactile-rust w-full py-2.5 px-4 rounded-lg font-display font-bold text-sm uppercase tracking-wider cursor-pointer disabled:opacity-45"
                    >
                      {selectedDef.id === 'flashlight'
                        ? isFlashlightOn
                          ? 'Turn Off EVA Flood Torch [F]'
                          : 'Turn On EVA Flood Torch [F]'
                        : selectedDef.id === 'soil_analyzer'
                        ? 'Run Local XRF Regolith Scan'
                        : selectedDef.reusable
                        ? `Activate ${selectedDef.name}`
                        : `Use ${selectedDef.name} (${personalCount} left)`}
                    </button>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-sky-950/40 border border-sky-500/30 text-xs text-sky-200 font-mono text-center">
                      Phase-2 Engineering Specification • Unlocks at Sol {selectedDef.unlockSol}
                    </div>
                  )}

                  {/* Secondary Actions: Assign Quickbar [1-5] & Rover Cargo Transfer */}
                  {!selectedVial && selectedDef.mvpActive && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setShowQuickbarPicker((prev) => !prev)}
                        className="btn-tactile py-2 px-3 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5"
                      >
                        <Pin className="w-3.5 h-3.5 text-cyan-400" />
                        <span>
                          {pinnedSlotIndex !== -1
                            ? `Quickbar [#${pinnedSlotIndex + 1}]`
                            : 'Pin Quickbar [1-5]'}
                        </span>
                      </button>

                      {activeTab === 'rover' ? (
                        <button
                          type="button"
                          data-testid="transfer-to-backpack-btn"
                          onClick={() => handleTransfer('to_backpack')}
                          disabled={!isNearRover || roverCount <= 0}
                          className="btn-tactile py-2 px-3 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 disabled:opacity-45"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                          <span>Retrieve to Pack</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          data-testid="transfer-to-rover-btn"
                          onClick={() => handleTransfer('to_rover')}
                          disabled={
                            !isNearRover ||
                            selectedDef.reusable ||
                            personalCount <= 0
                          }
                          className="btn-tactile py-2 px-3 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 disabled:opacity-45"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                          <span>Store in Rover</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Quickbar Slot Picker Row */}
                  {showQuickbarPicker && !selectedVial && selectedDef.mvpActive && (
                    <div className="p-2 rounded-lg bg-[#0E151D] border border-cyan-500/40 flex items-center justify-between gap-1.5 font-mono text-xs">
                      <span className="text-slate-300 text-[11px]">Assign to key:</span>
                      <div className="flex items-center gap-1">
                        {[0, 1, 2, 3, 4].map((slotIdx) => (
                          <button
                            key={slotIdx}
                            type="button"
                            onClick={() => {
                              assignQuickbarSlot(slotIdx, selectedDef.id);
                              setShowQuickbarPicker(false);
                              setStatusBanner({
                                ok: true,
                                message: `Pinned ${selectedDef.name} to Quickbar Slot [${slotIdx + 1}].`
                              });
                            }}
                            className={`px-2.5 py-1 rounded border font-bold cursor-pointer ${
                              quickbarSlots[slotIdx] === selectedDef.id
                                ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                                : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-cyan-400'
                            }`}
                          >
                            [{slotIdx + 1}]
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              </div>
            </div>

            {/* ========================================================
                3. FOOTER: 5-Slot Quickbar Preview & Controls Guide
                ======================================================== */}
            <div className="border-t border-slate-800 px-4 py-2.5 bg-[#141C25] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-2 overflow-x-auto">
                <span className="text-slate-400 text-[11px] shrink-0">QUICKBAR [1–5]:</span>
                {quickbarSlots.map((qId, idx) => {
                  const qDef = ITEM_CATALOG[qId];
                  const qCount = inventory[qId] ?? 0;
                  return (
                    <button
                      key={`qb-${idx}`}
                      type="button"
                      onClick={() => handleSelectSlot(qId)}
                      className={`px-2 py-1 rounded border flex items-center gap-1.5 cursor-pointer ${
                        selectedItemId === qId && selectedVialIndex === null
                          ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200'
                          : 'bg-[#0E141B] border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-amber-400 font-bold">[{idx + 1}]</span>
                      <span className="truncate max-w-[95px]">{qDef?.name || qId}</span>
                      <span className="text-[10px] text-slate-400">
                        {qDef?.reusable ? '∞' : `x${qCount}`}
                      </span>
                    </button>
                  );
                })}
              </div>

              <span className="text-slate-400 text-[11px]">
                {isNearRover
                  ? '✅ Rover Cargo Link Active (<4.5m)'
                  : `ℹ️ Move within 4.5m of Rover to transfer cargo (currently ${distToRover.toFixed(1)}m)`}
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default BackpackModal;
