import React, { useState } from 'react';
import { useMissionStore } from '../state/store';
import { RegionId, SecondaryJobDefinition } from '../contract';
import { X, Wrench, Zap, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

interface EngineeringJobModalProps {
  onClose: () => void;
}

const REGION_JOBS: Record<RegionId, SecondaryJobDefinition[]> = {
  dust: [
    {
      id: 'job_dust_clean',
      title: 'Solar Array Dust Sweeping Protocol',
      description: 'Deploy automated brush arms across primary photovoltaic masts. Yields +2 EU reserve energy recharge.',
      cost: { energy: 2, meals: 0, water: 0, airPacks: 0 },
      outputKey: 'panelsClean',
      outputValue: true,
      energyBonus: 2,
      readout: 'Solar arrays polished clean. Energy generation boosted (+2 EU post-shift reserve).'
    },
    {
      id: 'job_dust_water',
      title: 'Atmospheric Moisture Recovery Cycle',
      description: 'Recycle 2 units of condensation greywater into certified ultra-pure potable water (+2 Clean Water).',
      cost: { energy: 2, meals: 0, water: 0, airPacks: 0 },
      outputKey: 'waterCleaned',
      outputValue: true,
      waterBonus: 2,
      readout: 'Greywater batch processed and sanitized (+2 Clean Water certified).'
    }
  ],
  ice: [
    {
      id: 'job_ice_scan',
      title: 'Subsurface Core Stratigraphy Analysis',
      description: 'Feed extracted ice core through multi-spectral laser scanner to reconstruct 500,000-year climate record.',
      cost: { energy: 2, meals: 0, water: 0, airPacks: 0 },
      outputKey: 'coreAnalysis',
      outputValue: 'complete',
      readout: 'Glacial ice core scanned. Prehistoric atmospheric climate layers cataloged.'
    },
    {
      id: 'job_ice_water',
      title: 'ECLSS Greywater Filtration Run',
      description: 'Process station greywater holding tank through catalytic oxidizer to yield +2 certified potable water.',
      cost: { energy: 2, meals: 0, water: 0, airPacks: 0 },
      outputKey: 'waterCleaned',
      outputValue: true,
      waterBonus: 2,
      readout: 'ECLSS filtration run complete. Clean reserve water stock increased (+2 Clean Water).'
    }
  ],
  lake: [
    {
      id: 'job_lake_summary',
      title: 'Telemetry Summary & Rover Mechanical Inspection',
      description: 'Transmit condensed telemetry burst to Earth, then perform mechanical arm and wheel health diagnostics.',
      cost: { energy: 2, meals: 0, water: 0, airPacks: 0 },
      outputKey: 'roverInspection',
      outputValue: 'complete',
      readout: 'Short telemetry packet dispatched. Rover joints, wheels, and camera arm calibrated.'
    },
    {
      id: 'job_lake_full',
      title: 'Full Science Telemetry Deep-Space Uplink',
      description: 'Dedicate high-gain dish bandwidth to transmitting full raw multi-spectral data packets to NASA science teams.',
      cost: { energy: 2, meals: 0, water: 0, airPacks: 0 },
      outputKey: 'transmit',
      outputValue: 'full',
      readout: 'Full 4K scientific imagery and spectral cubes transmitted directly to Earth Command.'
    }
  ]
};

export const EngineeringJobModal: React.FC<EngineeringJobModalProps> = ({ onClose }) => {
  const currentRegion = useMissionStore((s) => s.currentRegion);
  const supportBaseId = useMissionStore((s) => s.supportBaseId);
  const bases = useMissionStore((s) => s.bases);
  const surveys = useMissionStore((s) => s.surveys);
  const selectSecondaryJob = useMissionStore((s) => s.selectSecondaryJob);

  const activeBase = bases[supportBaseId] || bases[currentRegion];
  const currentSurvey = surveys[currentRegion];
  const jobs = REGION_JOBS[currentRegion] || [];

  const [selectedJobId, setSelectedJobId] = useState<string>(jobs[0]?.id || '');

  const chosenJob = jobs.find((j) => j.id === selectedJobId) || jobs[0];
  const deferredJob = jobs.find((j) => j.id !== selectedJobId) || jobs[1];

  const handleCommitJob = () => {
    if (!chosenJob) return;
    const success = selectSecondaryJob(currentRegion, chosenJob.id, chosenJob);
    if (success) {
      onClose();
    }
  };

  const isAlreadySelected = !!currentSurvey.secondaryJobSelected;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 select-none">
      <div className="bg-[#1C2026] border-2 border-[#FF5A1F]/40 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans text-[#F4F1EA]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#F4F1EA]/10 bg-[#16191E]">
          <div className="flex items-center gap-3">
            <Wrench className="w-6 h-6 text-[#FF5A1F]" />
            <div>
              <h2 className="text-xl font-bold font-mono tracking-wider text-[#F4F1EA] uppercase">
                Priority Engineering Trade-Off — {activeBase.name}
              </h2>
              <p className="text-xs text-[#F4F1EA]/70">
                Allocate 2 EU to execute one essential upgrade. The alternative task will be marked Deferred.
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Base Energy Availability Banner */}
          <div className="p-3 bg-[#16191E] rounded border border-[#F4F1EA]/10 flex items-center justify-between font-mono text-xs">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#FFB800]" />
              <span>Available Energy at {activeBase.name}:</span>
              <strong className="text-base text-[#F4F1EA]">{activeBase.resources.energy} EU</strong>
            </div>
            <span className="text-[#FF5A1F] font-bold">Standard Job Cost: 2 EU</span>
          </div>

          {/* If already selected */}
          {isAlreadySelected ? (
            <div className="p-4 bg-green-950/40 border border-green-500 rounded text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto" />
              <h3 className="font-bold text-sm text-[#F4F1EA]">Engineering Decision Already Committed</h3>
              <p className="text-xs text-[#F4F1EA]/70 font-mono">
                Selected: [{currentSurvey.secondaryJobSelected}] • Deferred: [{currentSurvey.secondaryJobDeferred}]
              </p>
            </div>
          ) : (
            /* Side-by-Side Trade-off Cards */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {jobs.map((job) => {
                const isSelected = job.id === selectedJobId;
                return (
                  <div
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    className={`p-5 rounded-lg border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#FF5A1F] bg-[#FF5A1F]/10 shadow-lg'
                        : 'border-[#F4F1EA]/20 bg-[#16191E] hover:border-[#F4F1EA]/40'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-[#FF5A1F] uppercase">Option</span>
                        {isSelected && (
                          <span className="px-2 py-0.5 rounded bg-[#FF5A1F] text-black text-xs font-mono font-bold">
                            Selected
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-base text-[#F4F1EA] leading-snug">{job.title}</h4>
                      <p className="text-xs text-[#F4F1EA]/80 leading-relaxed">{job.description}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#F4F1EA]/10 space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-[#F4F1EA]/60">Cost:</span>
                        <span className="text-[#FFB800] font-bold">2 EU</span>
                      </div>
                      {job.energyBonus && (
                        <div className="flex items-center justify-between text-xs font-mono text-green-400 font-bold">
                          <span>Energy Yield:</span>
                          <span>+{job.energyBonus} EU Reserve</span>
                        </div>
                      )}
                      {job.waterBonus && (
                        <div className="flex items-center justify-between text-xs font-mono text-[#00D2FF] font-bold">
                          <span>Potable Water Yield:</span>
                          <span>+{job.waterBonus} Clean Water</span>
                        </div>
                      )}
                      <p className="text-[11px] text-[#00D2FF] font-mono bg-[#00D2FF]/10 p-2 rounded">
                        Outcome: {job.readout}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Trade-off Explanation Banner */}
          {!isAlreadySelected && chosenJob && deferredJob && (
            <div className="p-3 bg-black/40 border border-[#F4F1EA]/10 rounded text-xs font-mono space-y-1">
              <div className="flex items-center gap-1.5 text-[#FFB800]">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="font-bold">Operational Impact:</span>
              </div>
              <p className="text-[#F4F1EA]/80">
                Executing <strong>{chosenJob.title}</strong> will commit 2 EU and apply its visual and resource consequences.
                The unselected task (<strong>{deferredJob.title}</strong>) will be logged as <em>Deferred</em> in your final mission report to Commander Mira.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#16191E] border-t border-[#F4F1EA]/10 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#F4F1EA]/20 text-[#F4F1EA]/70 hover:bg-[#F4F1EA]/10 rounded text-xs font-mono uppercase"
          >
            Cancel
          </button>

          {!isAlreadySelected && (
            <button
              type="button"
              disabled={activeBase.resources.energy < 2}
              onClick={handleCommitJob}
              className={`px-6 py-2.5 font-bold text-sm tracking-wider uppercase rounded transition-all shadow-lg flex items-center gap-2 ${
                activeBase.resources.energy >= 2
                  ? 'bg-[#FF5A1F] hover:bg-[#ff723f] text-black ring-2 ring-[#FF5A1F]'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
              }`}
            >
              <span>Commit Engineering Choice</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
