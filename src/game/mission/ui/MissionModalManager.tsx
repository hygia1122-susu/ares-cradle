import React from 'react';
import { useMissionStore } from '../state/store';
import { WorldMapModal } from './WorldMapModal';
import { BaseTerminalModal } from './BaseTerminalModal';
import { FieldNotebookModal } from './FieldNotebookModal';
import { EngineeringJobModal } from './EngineeringJobModal';
import { RecoveryModal } from './RecoveryModal';
import { FinaleReviewModal } from './FinaleReviewModal';
import { DustGridModel } from '../activities/DustGridModel';
import { IceDrillCore } from '../activities/IceDrillCore';
import { LakeContextSurvey } from '../activities/LakeContextSurvey';
import { X } from 'lucide-react';

export const MissionModalManager: React.FC = () => {
  const activeModal = useMissionStore((s) => s.activeModal);
  const currentRegion = useMissionStore((s) => s.currentRegion);
  const setModal = useMissionStore((s) => s.setModal);

  if (!activeModal) return null;

  if (activeModal === 'map') {
    return <WorldMapModal onClose={() => setModal(null)} />;
  }

  if (activeModal === 'base') {
    return <BaseTerminalModal onClose={() => setModal(null)} />;
  }

  if (activeModal === 'notebook') {
    return <FieldNotebookModal onClose={() => setModal(null)} />;
  }

  if (activeModal === 'decision') {
    return <EngineeringJobModal onClose={() => setModal(null)} />;
  }

  if (activeModal === 'recovery') {
    return <RecoveryModal onClose={() => setModal(null)} />;
  }

  if (activeModal === 'finale') {
    return <FinaleReviewModal onClose={() => setModal(null)} />;
  }

  if (activeModal === 'minigame') {
    return (
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 select-none">
        <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col">
          <button
            type="button"
            onClick={() => setModal(null)}
            className="absolute top-3 right-3 z-50 p-2 rounded-lg bg-black/60 hover:bg-black/90 text-[#F4F1EA] transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          {currentRegion === 'dust' && <DustGridModel />}
          {currentRegion === 'ice' && <IceDrillCore />}
          {currentRegion === 'lake' && <LakeContextSurvey />}
        </div>
      </div>
    );
  }

  return null;
};
