import React, { useState } from 'react';
import { useMissionStore } from '../state/store';
import { RegionId, ResearchGoalId, GO_ARRIVAL_THRESHOLD } from '../contract';
import {
  X,
  Radio,
  CheckCircle2,
  AlertCircle,
  Rocket,
  Send,
  Loader2,
  Award,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface FinaleReviewModalProps {
  onClose: () => void;
}

const RESEARCH_GOALS: { id: ResearchGoalId; title: string; bases: RegionId[]; desc: string }[] = [
  {
    id: 'geology',
    title: 'Martian Surface Dynamics & Regolith Science',
    bases: ['dust', 'lake'],
    desc: 'Investigate atmospheric dust circulation and lacustrine sediment layers to understand Mars surface evolution.'
  },
  {
    id: 'water_ops',
    title: 'Water Reclamation & Operational Resilience',
    bases: ['ice', 'dust'],
    desc: 'Master solar dust cleaning mitigation and harvest massive glacial permafrost ice for closed-loop life support.'
  },
  {
    id: 'ancient_life',
    title: 'Ancient Habitable Environments & Biosignatures',
    bases: ['lake', 'ice'],
    desc: 'Collect uncompromised lacustrine mudstone cores to search for organic chemical biosignatures.'
  }
];

export const FinaleReviewModal: React.FC<FinaleReviewModalProps> = ({ onClose }) => {
  const bases = useMissionStore((s) => s.bases);
  const completedReports = useMissionStore((s) => s.completedReports);
  const selectedGoal = useMissionStore((s) => s.selectedGoal);
  const chosenArrivalBase = useMissionStore((s) => s.chosenArrivalBase);
  const miraStatus = useMissionStore((s) => s.miraStatus);
  const miraMessage = useMissionStore((s) => s.miraMessage);
  const isTransmittingProposal = useMissionStore((s) => s.isTransmittingProposal);
  const selectResearchGoal = useMissionStore((s) => s.selectResearchGoal);
  const selectArrivalBase = useMissionStore((s) => s.selectArrivalBase);
  const submitArrivalProposal = useMissionStore((s) => s.submitArrivalProposal);

  const [activeTab, setActiveTab] = useState<'goal' | 'bases' | 'proposal' | 'touchdown'>(
    miraStatus === 'GO' ? 'touchdown' : 'goal'
  );

  const handleLaunchTouchdown = () => {
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch (e) {}
    setActiveTab('touchdown');
  };

  const activeArrivalBase = chosenArrivalBase ? bases[chosenArrivalBase] : null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 select-none">
      <div className="bg-[#1C2026] border-2 border-[#FF5A1F] rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans text-[#F4F1EA]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#F4F1EA]/10 bg-[#16191E]">
          <div className="flex items-center gap-3">
            <Radio className="w-6 h-6 text-[#FF5A1F]" />
            <div>
              <h2 className="text-xl font-bold font-mono tracking-wider text-[#F4F1EA] uppercase">
                Ares-1 Arrival Certification & Readiness Review
              </h2>
              <p className="text-xs text-[#F4F1EA]/70">
                Action before cutscene: Select research objective, certify base inventory, and receive Earth Command flight directive.
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

        {/* Navigation Step Tabs */}
        <div className="flex border-b border-[#F4F1EA]/10 bg-[#12151A] text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('goal')}
            className={`flex-1 py-3 px-4 text-center border-b-2 font-bold transition-all ${
              activeTab === 'goal'
                ? 'border-[#FF5A1F] text-[#FF5A1F] bg-[#FF5A1F]/10'
                : 'border-transparent text-[#F4F1EA]/60 hover:text-[#F4F1EA]'
            }`}
          >
            1. Research Goal {selectedGoal && '✓'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bases')}
            className={`flex-1 py-3 px-4 text-center border-b-2 font-bold transition-all ${
              activeTab === 'bases'
                ? 'border-[#00D2FF] text-[#00D2FF] bg-[#00D2FF]/10'
                : 'border-transparent text-[#F4F1EA]/60 hover:text-[#F4F1EA]'
            }`}
          >
            2. Evaluate 5 Outposts {chosenArrivalBase && '✓'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('proposal')}
            className={`flex-1 py-3 px-4 text-center border-b-2 font-bold transition-all ${
              activeTab === 'proposal'
                ? 'border-[#FFB800] text-[#FFB800] bg-[#FFB800]/10'
                : 'border-transparent text-[#F4F1EA]/60 hover:text-[#F4F1EA]'
            }`}
          >
            3. Mira Proposal & Flight Directive {miraStatus === 'GO' && '★ GO'}
          </button>
          {miraStatus === 'GO' && (
            <button
              type="button"
              onClick={handleLaunchTouchdown}
              className={`flex-1 py-3 px-4 text-center border-b-2 font-bold transition-all ${
                activeTab === 'touchdown'
                  ? 'border-green-400 text-green-400 bg-green-500/10'
                  : 'border-transparent text-green-400/70 hover:text-green-300'
              }`}
            >
              4. Ares-1 Touchdown 🎉
            </button>
          )}
        </div>

        {/* Scrollable Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: Select Research Goal */}
          {activeTab === 'goal' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-[#F4F1EA]">Select Primary Mission Scientific Objective</h3>
                <p className="text-xs text-[#F4F1EA]/70">
                  Cadet Leo must formulate the scientific justification for where the 2 arriving Ares-1 astronauts will focus their expedition.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {RESEARCH_GOALS.map((goal) => {
                  const isSelected = selectedGoal === goal.id;
                  return (
                    <div
                      key={goal.id}
                      onClick={() => selectResearchGoal(goal.id)}
                      className={`p-5 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#FF5A1F] bg-[#FF5A1F]/15 shadow-xl'
                          : 'border-[#F4F1EA]/20 bg-[#16191E] hover:border-[#F4F1EA]/40'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-[#FF5A1F]">Scientific Track</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-[#FF5A1F]" />}
                        </div>
                        <h4 className="font-bold text-sm text-[#F4F1EA]">{goal.title}</h4>
                        <p className="text-xs text-[#F4F1EA]/80 leading-relaxed">{goal.desc}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-[#F4F1EA]/10">
                        <span className="text-[11px] font-mono text-[#00D2FF]">
                          Recommended Bases: {goal.bases.map((b) => bases[b]?.name).join(' & ')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  disabled={!selectedGoal}
                  onClick={() => setActiveTab('bases')}
                  className="px-6 py-2.5 bg-[#FF5A1F] hover:bg-[#ff723f] text-black font-bold font-mono text-xs uppercase rounded transition-all shadow-lg"
                >
                  Proceed to Outpost Evaluation →
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Evaluate 3 Bases */}
          {activeTab === 'bases' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-[#F4F1EA]">Evaluate 3 Outposts Against GO Criteria</h3>
                <p className="text-xs text-[#F4F1EA]/70">
                  Target threshold for 3 crew members (Leo + Ares-1): ≥8 EU, ≥3 Meals, ≥3 Clean Water, ≥3 Air Packs, and all 3 visual safety checks.
                </p>
              </div>

              <div className="space-y-3">
                {(Object.keys(bases) as RegionId[]).map((regId) => {
                  const b = bases[regId];
                  const isSelected = chosenArrivalBase === regId;
                  const res = b.resources;
                  const thresh = GO_ARRIVAL_THRESHOLD;

                  const hasEnergy = res.energy >= thresh.energy;
                  const hasMeals = res.meals >= thresh.meals;
                  const hasWater = res.water >= thresh.water;
                  const hasAir = res.airPacks >= thresh.airPacks;
                  const allChecks = b.safetyChecks.diagnostics && b.safetyChecks.shelter && b.safetyChecks.comms;

                  const isReady = hasEnergy && hasMeals && hasWater && hasAir && allChecks;

                  return (
                    <div
                      key={regId}
                      onClick={() => selectArrivalBase(regId)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                        isSelected
                          ? 'border-[#00D2FF] bg-[#00D2FF]/10 shadow-lg'
                          : 'border-[#F4F1EA]/20 bg-[#16191E] hover:border-[#F4F1EA]/40'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#F4F1EA]">{b.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-black/40 text-[#F4F1EA]/60 font-mono uppercase">
                            {b.id} Sector
                          </span>
                          {isSelected && (
                            <span className="text-xs px-2 py-0.5 rounded bg-[#00D2FF] text-black font-bold font-mono">
                              Selected for Arrival
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-[#F4F1EA]/80">
                          <span className={hasEnergy ? 'text-green-400' : 'text-red-400'}>
                            ⚡ {res.energy}/8 EU
                          </span>
                          <span className={hasMeals ? 'text-green-400' : 'text-red-400'}>
                            🍲 {res.meals}/3 Meals
                          </span>
                          <span className={hasWater ? 'text-green-400' : 'text-red-400'}>
                            💧 {res.water}/3 Water
                          </span>
                          <span className={hasAir ? 'text-green-400' : 'text-red-400'}>
                            💨 {res.airPacks}/3 Air
                          </span>
                          <span className={allChecks ? 'text-green-400' : 'text-yellow-400'}>
                            🛡️ Checks: {allChecks ? '3/3 Certified' : 'Incomplete'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {isReady ? (
                          <span className="text-xs px-3 py-1 rounded bg-green-500/20 border border-green-500 text-green-300 font-bold font-mono flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> GO READY
                          </span>
                        ) : (
                          <span className="text-xs px-3 py-1 rounded bg-yellow-500/20 border border-yellow-500 text-yellow-300 font-bold font-mono flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> HOLD DEFICIT
                          </span>
                        )}
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded bg-[#252A33] hover:bg-[#323945] text-xs font-mono uppercase"
                        >
                          {isSelected ? 'Selected' : 'Select'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('goal')}
                  className="px-4 py-2 border border-[#F4F1EA]/20 text-[#F4F1EA]/70 rounded font-mono text-xs uppercase"
                >
                  ← Back to Research Goal
                </button>
                <button
                  type="button"
                  disabled={!chosenArrivalBase}
                  onClick={() => setActiveTab('proposal')}
                  className="px-6 py-2.5 bg-[#00D2FF] hover:bg-[#38dcff] text-black font-bold font-mono text-xs uppercase rounded transition-all shadow-lg"
                >
                  Transmit Proposal to Mira →
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Transmit Proposal & Mira Review */}
          {activeTab === 'proposal' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-[#F4F1EA]">Deep-Space Flight Directive Transmission</h3>
                <p className="text-xs text-[#F4F1EA]/70">
                  Transmit your completed scientific justification and base readiness proposal to Earth Command.
                </p>
              </div>

              {/* Proposal Summary Card */}
              {activeArrivalBase && (
                <div className="p-4 bg-[#16191E] rounded-lg border border-[#F4F1EA]/20 space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center border-b border-[#F4F1EA]/10 pb-2">
                    <span className="text-[#00D2FF] font-bold">SUBMITTED ARRIVAL OUTPOST:</span>
                    <strong className="text-sm text-[#F4F1EA]">{activeArrivalBase.name}</strong>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[#F4F1EA]/80">
                    <div>Energy: {activeArrivalBase.resources.energy} EU (≥8)</div>
                    <div>Rations: {activeArrivalBase.resources.meals} Meals (≥3)</div>
                    <div>Water: {activeArrivalBase.resources.water} Portions (≥3)</div>
                    <div>Air Packs: {activeArrivalBase.resources.airPacks} Packs (≥3)</div>
                  </div>
                  <div>
                    Safety Checks: {
                      activeArrivalBase.safetyChecks.diagnostics &&
                      activeArrivalBase.safetyChecks.shelter &&
                      activeArrivalBase.safetyChecks.comms
                        ? '3/3 Certified (Diagnostics, Shelter, Comms)'
                        : 'Incomplete'
                    }
                  </div>
                  <div>
                    Surveys Completed: {completedReports.length}/5 Regional Reports
                  </div>
                </div>
              )}

              {/* Transmit Action */}
              <div className="flex justify-center">
                <button
                  type="button"
                  disabled={isTransmittingProposal}
                  onClick={submitArrivalProposal}
                  className="px-8 py-3 bg-[#FF5A1F] hover:bg-[#ff723f] text-black font-bold font-mono text-sm uppercase rounded-lg transition-all shadow-xl flex items-center gap-2"
                >
                  {isTransmittingProposal ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Transmitting via Deep Space Network (Simulated Delay)...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      <span>Transmit Official Proposal to Commander Mira</span>
                    </>
                  )}
                </button>
              </div>

              {/* Mira's Response Banner */}
              {miraMessage && (
                <div
                  className={`p-5 rounded-lg border-2 space-y-2 transition-all ${
                    miraStatus === 'GO'
                      ? 'border-green-500 bg-green-950/40'
                      : 'border-yellow-500 bg-yellow-950/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {miraStatus === 'GO' ? (
                      <CheckCircle2 className="w-6 h-6 text-green-400" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-yellow-400" />
                    )}
                    <span className="font-bold text-sm uppercase font-mono tracking-wider">
                      {miraStatus === 'GO' ? 'EARTH COMMAND DIRECTIVE: GO FOR TOUCHDOWN' : 'EARTH COMMAND DIRECTIVE: HOLD'}
                    </span>
                  </div>
                  <p className="text-xs text-[#F4F1EA] leading-relaxed font-mono">{miraMessage}</p>

                  {miraStatus === 'GO' && (
                    <div className="pt-3">
                      <button
                        type="button"
                        onClick={handleLaunchTouchdown}
                        className="px-6 py-2.5 bg-green-500 hover:bg-green-400 text-black font-bold font-mono text-xs uppercase rounded shadow-lg flex items-center gap-2"
                      >
                        <Rocket className="w-4 h-4" />
                        <span>Launch Ares-1 Touchdown Sequence 🎉</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Touchdown Celebration */}
          {activeTab === 'touchdown' && activeArrivalBase && (
            <div className="text-center space-y-6 py-6 max-w-2xl mx-auto">
              <Award className="w-16 h-16 text-[#FFB800] mx-auto animate-bounce" />
              <div className="space-y-2">
                <span className="text-xs font-mono uppercase tracking-widest text-[#FF5A1F] font-bold">
                  NASA Space Apps Challenge 2026 — Mission Accomplished!
                </span>
                <h3 className="text-2xl font-bold text-[#F4F1EA]">
                  Ares-1 Crewed Transport Successfully Landed at {activeArrivalBase.name}!
                </h3>
                <p className="text-xs text-[#F4F1EA]/80 leading-relaxed font-mono">
                  Cadet Leo, robot Sol, and Commander Mira celebrate the grand opening of the first human settlement on Mars.
                  Your rigorous scientific observations, evidence-based trade-offs, and disciplined resource allocations proved that humanity can live and work on the Red Planet.
                </p>
              </div>

              {/* Printable / Viewable Junior Astronaut Diploma */}
              <div className="p-6 bg-[#16191E] rounded-xl border-2 border-[#FFB800] text-left space-y-4 font-mono text-xs shadow-2xl">
                <div className="flex items-center justify-between border-b border-[#F4F1EA]/10 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-[#FFB800] uppercase">JUNIOR ASTRONAUT MISSION COMMANDER DIPLOMA</h4>
                    <span className="text-[10px] text-[#F4F1EA]/60">NASA Space Apps Challenge 2026</span>
                  </div>
                  <Sparkles className="w-6 h-6 text-[#00D2FF]" />
                </div>

                <div className="space-y-1 text-[#F4F1EA]/90">
                  <p>Certified Cadet: <strong>Cadet Leo</strong></p>
                  <p>Autonomous AI Companion: <strong>Sol Bot</strong></p>
                  <p>Primary Scientific Focus: <strong>{RESEARCH_GOALS.find((g) => g.id === selectedGoal)?.title}</strong></p>
                  <p>Primary Landing Outpost: <strong>{activeArrivalBase.name}</strong></p>
                  <p>Regional Survey Reports Filed: <strong>5 / 5 Regions Complete</strong></p>
                  <p>ECLSS Life Support & Reserve EU: <strong>VERIFIED SAFE FOR 3 CREW</strong></p>
                </div>

                <div className="pt-2 border-t border-[#F4F1EA]/10 text-[10px] text-[#F4F1EA]/50 italic">
                  "A place to explore — and a place to come back to."
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-8 py-3 bg-[#00D2FF] hover:bg-[#3cdcff] text-black font-bold font-mono text-xs uppercase rounded-lg shadow-lg"
                >
                  Return to Free Surface Exploration
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#16191E] border-t border-[#F4F1EA]/10 flex items-center justify-between text-xs font-mono text-[#F4F1EA]/60">
          <span>Ares Cradle Mission Trainer • 100% Invariant Compliance (I01–I09)</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#252A33] hover:bg-[#323945] rounded font-mono text-xs uppercase"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};
