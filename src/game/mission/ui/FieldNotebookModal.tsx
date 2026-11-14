import React, { useState } from 'react';
import { useMissionStore } from '../state/store';
import { RegionId } from '../contract';
import { X, BookOpen, ExternalLink, CheckCircle2 } from 'lucide-react';

interface FieldNotebookModalProps {
  onClose: () => void;
}

export const FieldNotebookModal: React.FC<FieldNotebookModalProps> = ({ onClose }) => {
  const currentRegion = useMissionStore((s) => s.currentRegion);
  const surveys = useMissionStore((s) => s.surveys);
  const [selectedRegion, setSelectedRegion] = useState<RegionId>(currentRegion);
  const [activeTier, setActiveTier] = useState<'elementary' | 'cadet' | 'sources' | 'nasa2026'>('elementary');

  const REGIONS_DATA: Record<RegionId, {
    title: string;
    question: string;
    coreLesson: string;
    points: { id: string; title: string; kid: string; field: string; source: string; sourceUrl: string; credit: string; boundary: string }[];
  }> = {
    dust: {
      title: 'Wind Basin',
      question: 'How do wind patterns move fine dust, and how does dust affect solar energy systems?',
      coreLesson: 'Dust can dim the sky and cover equipment. Engineering models help us simulate particle movement before storms hit.',
      points: [
        {
          id: 'D1',
          title: 'Wind Shadows Behind Boulders',
          kid: 'Just like hiding behind a wall from the wind, dust piles up behind rocks where the air is calm.',
          field: 'Lee-side aerodynamic deceleration creates deposition zones indicating prevailing storm azimuths.',
          source: 'Fact and Fiction of Martian Dust Storms',
          sourceUrl: 'https://www.nasa.gov/solar-system/the-fact-and-fiction-of-martian-dust-storms/',
          credit: 'NASA Science',
          boundary: 'Martian atmosphere is 1% Earth density; winds carry low dynamic pressure and cannot flip heavy habitats.'
        },
        {
          id: 'D2',
          title: 'Clean vs Dusted Solar Mast',
          kid: 'Even a thin coat of red Mars dust blocks sunlight and starves our solar panels of power!',
          field: 'Fine iron-oxide dust (particle size < 5 microns) causes optical extinction and severe power drops.',
          source: 'Opportunity Rover Long-Term Photovoltaics',
          sourceUrl: 'https://science.nasa.gov/mission/mer-opportunity/',
          credit: 'NASA / JPL-Caltech',
          boundary: 'Natural wind cleaning events are unpredictable and cannot replace engineered sweeping protocols.'
        },
        {
          id: 'D3',
          title: 'Dust Devils vs Global Storms',
          kid: 'Dust devils leave dark curvy trails on the ground, while giant dust storms turn the whole sky orange.',
          field: 'Convective thermal columns scrub surface dust, exposing darker underlying substrate.',
          source: 'NASA GSFC Space Weather Database (DONKI)',
          sourceUrl: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
          credit: 'NASA GSFC',
          boundary: 'Solar particle events (SPE) from space weather are distinct from tropospheric dust circulation.'
        }
      ]
    },
    ice: {
      title: 'Sealed Ice Cliff',
      question: 'How do we sample subsurface glacier ice, and why is raw ice different from treated drinking water?',
      coreLesson: 'An ice core is a scientific sample of ancient climate. Safe drinking water requires its own purification steps and chemical tests.',
      points: [
        {
          id: 'I1',
          title: 'Protective Debris Mantle',
          kid: 'Without this blanket of red dust, Mars ice would turn straight into gas and disappear into space!',
          field: 'Low surface pressure (600 Pa) triggers sublimation unless protected by rocky lag regolith.',
          source: 'Glacial Ice Deposits in Mid-Latitudes of Mars',
          sourceUrl: 'https://science.nasa.gov/resource/glacial-ice-deposits-in-mid-latitudes-of-mars/',
          credit: 'NASA / JPL-Caltech / ASI',
          boundary: 'Subsurface ice cannot be scooped like snow; it is cemented into cryogenic rock permafrost.'
        },
        {
          id: 'I2',
          title: 'SHARAD Subsurface Radar Profile',
          kid: 'Radar satellites beam radio pulses underground that bounce off buried pure water ice sheets.',
          field: 'Shallow Radar (SHARAD) dielectric constant (~3.1) confirms pure massive water ice deposit 80m thick.',
          source: 'MRO Shallow Radar (SHARAD)',
          sourceUrl: 'https://science.nasa.gov/resource/glacial-ice-deposits-in-mid-latitudes-of-mars/',
          credit: 'NASA / ASI',
          boundary: 'Radar maps dielectric contrast, which must be calibrated with core drilling ground-truth.'
        },
        {
          id: 'I3',
          title: 'Water Ice (H2O) vs Dry Ice (CO2)',
          kid: 'Dry ice is frozen carbon dioxide (-125°C). Water ice (-0°C) is what humans need to drink!',
          field: 'Seasonal CO2 frost sublimates rapidly in spring; perennial H2O ice remains locked in cryogenic permafrost.',
          source: 'Dry Ice on Mars',
          sourceUrl: 'https://science.nasa.gov/resource/dry-ice-on-mars/',
          credit: 'NASA Science',
          boundary: 'CO2 dry ice is toxic and cannot be melted into drinking water.'
        }
      ]
    },
    lake: {
      title: 'Ancient Lake Shore',
      question: 'What scientific documentation does a geological clue require before scientists can study it on Earth?',
      coreLesson: 'A useful clue deserves careful study. It does not prove that life once lived here without clean provenance and proof.',
      points: [
        {
          id: 'L1',
          title: 'Delta Mudstone Cross-Bedding',
          kid: 'Smooth mud layers show that calm water once flowed here billions of years ago!',
          field: 'Fine-grained smectite clay mudstones possess high potential for preserving ancient organic biosignatures.',
          source: 'Mars 2020 Perseverance Sample Caching',
          sourceUrl: 'https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/',
          credit: 'NASA / JPL-Caltech',
          boundary: 'Fluvial sediment layers prove past liquid water, not past microscopic life.'
        },
        {
          id: 'L2',
          title: 'Robotic Arm Diagnostics',
          kid: 'The robot arm works like a careful scientist with a magnifying glass, laser, and camera.',
          field: '5-DoF robotic arm positions SHERLOC and PIXL instruments with sub-millimeter precision.',
          source: 'Perseverance Robotic Arm & Coring System',
          sourceUrl: 'https://science.nasa.gov/mission/mars-2020-perseverance/',
          credit: 'NASA / JPL-Caltech',
          boundary: 'Rover tools provide initial triage; definitive biosignature confirmation requires Earth labs.'
        },
        {
          id: 'L3',
          title: 'Witness Tubes for Contamination',
          kid: 'Witness tubes are clean empty tubes that prove Earth dust didn’t sneak into our Mars samples!',
          field: 'Witness blanks capture outgassing volatiles and rover contaminants to validate true Mars origin.',
          source: 'Witness Tubes for Contamination Tracking',
          sourceUrl: 'https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/',
          credit: 'NASA / JPL-Caltech',
          boundary: 'Witness tubes monitor Earth contamination; they are blanks, not Mars geological specimens.'
        }
      ]
    }
  };

  const regData = REGIONS_DATA[selectedRegion];
  const survey = surveys[selectedRegion];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 select-none">
      <div className="bg-[#1C2026] border-2 border-[#FFB800]/40 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans text-[#F4F1EA]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#F4F1EA]/10 bg-[#16191E]">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-[#FFB800]" />
            <div>
              <h2 className="text-xl font-bold font-mono tracking-wider text-[#F4F1EA] uppercase">
                Field Notebook & NASA STEM Curriculum
              </h2>
              <p className="text-xs text-[#F4F1EA]/70">
                Official Junior Astronaut Training Academy science cards and peer-reviewed NASA/CSA citations.
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

        {/* Region & Tier Navigation */}
        <div className="p-4 border-b border-[#F4F1EA]/10 bg-[#12151A] flex flex-wrap items-center justify-between gap-3">
          {/* Region Tabs */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(REGIONS_DATA) as RegionId[]).map((rId) => {
              const isSelected = rId === selectedRegion;
              const isReportDone = surveys[rId].reportCompleted;
              return (
                <button
                  key={rId}
                  type="button"
                  onClick={() => setSelectedRegion(rId)}
                  className={`px-3 py-1.5 rounded font-mono text-xs font-bold transition-all border flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#FFB800] text-black border-[#FFB800] shadow'
                      : 'bg-[#1C2026] text-[#F4F1EA]/80 border-[#F4F1EA]/20 hover:border-[#F4F1EA]/40'
                  }`}
                >
                  {REGIONS_DATA[rId].title}
                  {isReportDone && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                </button>
              );
            })}
          </div>

          {/* Difficulty Tier Tabs */}
          <div className="flex items-center bg-[#1C2026] p-1 rounded border border-[#F4F1EA]/20 font-mono text-xs">
            <button
              type="button"
              onClick={() => setActiveTier('elementary')}
              className={`px-3 py-1 rounded transition-all ${
                activeTier === 'elementary' ? 'bg-[#FF5A1F] text-black font-bold' : 'text-[#F4F1EA]/70'
              }`}
            >
              Junior (7–9y)
            </button>
            <button
              type="button"
              onClick={() => setActiveTier('cadet')}
              className={`px-3 py-1 rounded transition-all ${
                activeTier === 'cadet' ? 'bg-[#00D2FF] text-black font-bold' : 'text-[#F4F1EA]/70'
              }`}
            >
              Cadet (10–12y)
            </button>
            <button
              type="button"
              onClick={() => setActiveTier('sources')}
              className={`px-3 py-1 rounded transition-all ${
                activeTier === 'sources' ? 'bg-[#2A9D8F] text-black font-bold' : 'text-[#F4F1EA]/70'
              }`}
            >
              NASA Sources
            </button>
            <button
              type="button"
              onClick={() => setActiveTier('nasa2026')}
              className={`px-3 py-1 rounded transition-all ${
                activeTier === 'nasa2026' ? 'bg-[#FF5A1F] text-black font-bold' : 'text-[#F4F1EA]/70'
              }`}
            >
              NASA 2026 Resources
            </button>
          </div>
        </div>

        {/* Scrollable Lesson Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTier === 'nasa2026' ? (
            /* NASA Space Apps 2026 Official Resource Catalog */
            <div className="space-y-4">
              <div className="p-4 bg-[#16191E] rounded-lg border border-[#FF5A1F]/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-[#FF5A1F] uppercase font-bold tracking-wider">
                    Official Challenge Resources
                  </span>
                  <a
                    href="https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/?tab=resources"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono text-[#00D2FF] hover:underline flex items-center gap-1"
                  >
                    NASA 2026 Challenge Portal <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <h3 className="text-base font-bold text-[#F4F1EA]">
                  NASA Space Apps Challenge 2026 — Junior Astronaut Mission Trainer Datasets
                </h3>
                <p className="text-xs text-[#F4F1EA]/80 leading-relaxed font-sans">
                  The resources below are verified open-access NASA/CSA datasets, mission archives, and telemetry repositories integrated directly into Ares Cradle's STEM mechanics.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. DONKI */}
                <div className="p-4 bg-[#16191E] rounded-lg border border-[#F4F1EA]/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-[#00D2FF]">1. NASA DONKI Space Weather Database</h4>
                    <a href="https://ccmc.gsfc.nasa.gov/tools/DONKI/" target="_blank" rel="noreferrer" className="text-[#FF5A1F] hover:underline">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <p className="text-xs text-[#F4F1EA]/80 font-sans">
                    Space Weather Database of Notifications, Knowledge, Information (CCMC / Goddard). Provides coronal mass ejection (CME) telemetry and solar flare particle fluxes.
                  </p>
                  <div className="p-2 bg-black/40 rounded text-[11px] font-mono text-[#FFB800]">
                    In-Game Mechanics: Calibrates habitat radiation shelter requirements and solar farm disruption.
                  </div>
                </div>

                {/* 2. OSDR */}
                <div className="p-4 bg-[#16191E] rounded-lg border border-[#F4F1EA]/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-[#00D2FF]">2. NASA Open Science Data Repository (OSDR)</h4>
                    <a href="https://osdr.nasa.gov/" target="_blank" rel="noreferrer" className="text-[#FF5A1F] hover:underline">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <p className="text-xs text-[#F4F1EA]/80 font-sans">
                    Unified space life sciences repository (GeneLab & ALSDA). Includes study OSD-268 measuring red romaine lettuce crop biology under microgravity and elevated CO₂.
                  </p>
                  <div className="p-2 bg-black/40 rounded text-[11px] font-mono text-[#FFB800]">
                    In-Game Mechanics: Outpost hydroponics food production, calorie quotas, and dietary balance.
                  </div>
                </div>

                {/* 3. InSight SEIS */}
                <div className="p-4 bg-[#16191E] rounded-lg border border-[#F4F1EA]/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-[#00D2FF]">3. InSight SEIS & Acoustic Sonification</h4>
                    <a href="https://science.nasa.gov/resource/listen-to-a-meteoroid-hitting-the-red-planet/" target="_blank" rel="noreferrer" className="text-[#FF5A1F] hover:underline">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <p className="text-xs text-[#F4F1EA]/80 font-sans">
                    Seismic Experiment for Interior Structure (SEIS). Direct audio sonification of hypersonic meteoroid impacts (e.g. S1000a, S1094b) recorded on Mars.
                  </p>
                  <div className="p-2 bg-black/40 rounded text-[11px] font-mono text-[#FFB800]">
                    In-Game Mechanics: Powers Echo Crater minigame acoustic frequency matching and orbital triangulation.
                  </div>
                </div>

                {/* 4. MRO HiRISE & Mars Trek */}
                <div className="p-4 bg-[#16191E] rounded-lg border border-[#F4F1EA]/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-[#00D2FF]">4. MRO HiRISE & Mars Trek GIS</h4>
                    <a href="https://trek.nasa.gov/mars/" target="_blank" rel="noreferrer" className="text-[#FF5A1F] hover:underline">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <p className="text-xs text-[#F4F1EA]/80 font-sans">
                    High-Resolution Imaging Science Experiment (HiRISE) satellite imagery and USGS/NASA Mars Trek interactive orbital cartography.
                  </p>
                  <div className="p-2 bg-black/40 rounded text-[11px] font-mono text-[#FFB800]">
                    In-Game Mechanics: Sub-meter orbital crater identification, ejecta albedo, and surface geomorphology.
                  </div>
                </div>

                {/* 5. Perseverance Mars 2020 */}
                <div className="p-4 bg-[#16191E] rounded-lg border border-[#F4F1EA]/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-[#00D2FF]">5. Perseverance Caching & Mastcam-Z</h4>
                    <a href="https://science.nasa.gov/mission/mars-2020-perseverance/mars-rock-samples/" target="_blank" rel="noreferrer" className="text-[#FF5A1F] hover:underline">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <p className="text-xs text-[#F4F1EA]/80 font-sans">
                    Jezero Crater sedimentary delta investigation. Utilizes sealed sample tubes, witness tube blank controls, and multi-spectral Mastcam-Z stereo imagery.
                  </p>
                  <div className="p-2 bg-black/40 rounded text-[11px] font-mono text-[#FFB800]">
                    In-Game Mechanics: Ancient Lake Shore multi-scale context survey (macro texture + landscape + GPS).
                  </div>
                </div>

                {/* 6. ISS ECLSS Water Recovery */}
                <div className="p-4 bg-[#16191E] rounded-lg border border-[#F4F1EA]/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-[#00D2FF]">6. ISS ECLSS Closed-Loop Water Recovery</h4>
                    <a href="https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/" target="_blank" rel="noreferrer" className="text-[#FF5A1F] hover:underline">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <p className="text-xs text-[#F4F1EA]/80 font-sans">
                    Environmental Control and Life Support System (ECLSS) achieving 98% water recovery milestone from crew sweat and moisture distillation.
                  </p>
                  <div className="p-2 bg-black/40 rounded text-[11px] font-mono text-[#FFB800]">
                    In-Game Mechanics: Distinction between raw glacial ice core research vs potable water purification.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Regional Core Lesson Banner */}
              <div className="p-4 bg-[#16191E] rounded-lg border border-[#F4F1EA]/10 space-y-2">
                <span className="text-xs font-mono text-[#FFB800] uppercase font-bold tracking-wider">
                  Regional Scientific Core Question
                </span>
                <h3 className="text-base font-bold text-[#F4F1EA]">{regData.question}</h3>
                <p className="text-xs text-[#00D2FF] font-mono bg-[#00D2FF]/10 p-2 rounded border border-[#00D2FF]/20">
                  💡 {regData.coreLesson}
                </p>
              </div>

              {/* 3 Scientific Points Cards */}
              <div className="space-y-4">
                <h4 className="text-xs font-mono uppercase text-[#F4F1EA]/60 tracking-wider">
                  Regional Focal Evidence ({survey.focalPointsDone.length}/3 Logged)
                </h4>

                {regData.points.map((pt) => {
                  const isLogged = survey.focalPointsDone.includes(pt.id);
                  return (
                    <div
                      key={pt.id}
                      className={`p-4 rounded-lg border transition-all ${
                        isLogged
                          ? 'border-[#00D2FF]/40 bg-[#16191E]'
                          : 'border-[#F4F1EA]/10 bg-[#12151A] opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#FF5A1F]/20 text-[#FF5A1F] border border-[#FF5A1F]/40">
                            {pt.id}
                          </span>
                          <h5 className="font-bold text-sm text-[#F4F1EA]">{pt.title}</h5>
                        </div>
                        {isLogged ? (
                          <span className="text-xs text-green-400 font-mono flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Evidence Logged
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500 font-mono">Unobserved</span>
                        )}
                      </div>

                      {/* Tier 1: Junior Astronaut (7-9y) */}
                      {activeTier === 'elementary' && (
                        <div className="space-y-2">
                          <p className="text-sm text-[#F4F1EA] leading-relaxed font-sans">{pt.kid}</p>
                          <span className="text-[11px] text-[#00D2FF] font-mono block">
                            🎯 Focus: Clear cause-and-effect observation.
                          </span>
                        </div>
                      )}

                      {/* Tier 2: Cadet Field Notes (10-12y) */}
                      {activeTier === 'cadet' && (
                        <div className="space-y-2">
                          <p className="text-xs text-[#F4F1EA]/90 leading-relaxed font-mono">{pt.field}</p>
                          <p className="text-xs text-[#FFB800] bg-[#FFB800]/10 p-2 rounded border border-[#FFB800]/20">
                            ⚖️ Scientific Limit: {pt.boundary}
                          </p>
                        </div>
                      )}

                      {/* Tier 3: Official NASA/CSA Sources */}
                      {activeTier === 'sources' && (
                        <div className="space-y-2 text-xs font-mono bg-black/40 p-3 rounded border border-[#F4F1EA]/10">
                          <div className="flex items-center justify-between">
                            <span className="text-[#00D2FF] font-bold">{pt.source}</span>
                            <a
                              href={pt.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#FF5A1F] hover:underline flex items-center gap-1"
                            >
                              Official NASA Link <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <p className="text-[#F4F1EA]/70">Credit: {pt.credit}</p>
                          <p className="text-[#FFB800]">Verification Boundary: {pt.boundary}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#16191E] border-t border-[#F4F1EA]/10 flex items-center justify-between text-xs font-mono text-[#F4F1EA]/60">
          <span>All research items sourced directly from NASA JPL, MRO, and CSA Junior Astronaut curriculums.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#252A33] hover:bg-[#323945] rounded font-mono text-xs uppercase"
          >
            Close Notebook
          </button>
        </div>
      </div>
    </div>
  );
};
