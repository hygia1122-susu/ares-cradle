import React, { useCallback, useEffect, useMemo } from 'react';
import { SCIENTIFIC_ELEMENTS, type ScientificElement } from '@/modules/outpost-3d/scienceCatalog';
import { WORLD_REGIONS, type RegionId } from '@/modules/outpost-3d/worldRegions';
import { useOutpostStore } from '@/modules/store/useOutpostStore';

export const SCIENCE_INTERACTION_RANGE = 4.5;
export const REGIONAL_SCOUT_RANGE = 18;

type Pose = readonly [number, number, number];

export function nearestScientificElement(
  elements: readonly ScientificElement[],
  pose: Pose,
  options: { isRemote: boolean; remoteRegionId: RegionId | null; grounded: boolean },
): ScientificElement | null {
  if (!options.grounded || (options.isRemote ? options.remoteRegionId === null : options.remoteRegionId !== null)) return null;
  let nearest: ScientificElement | null = null;
  let distance = SCIENCE_INTERACTION_RANGE;
  for (const element of elements) {
    if (options.isRemote && element.regionId !== options.remoteRegionId) continue;
    const candidateDistance = Math.hypot(pose[0] - element.position.x, pose[2] - element.position.z);
    if (candidateDistance <= distance) {
      nearest = element;
      distance = candidateDistance;
    }
  }
  return nearest;
}

export function isScientificKeyTarget(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false;
  return Boolean(target.closest('input,textarea,select,button,[contenteditable="true"],[role="dialog"]'));
}

function hasBlockingOverlay(): boolean {
  return typeof document !== 'undefined' && Boolean(document.querySelector('[role="dialog"]'));
}

/** Owns the single field interaction route; HUD overlay owns the codex dialog. */
export const ScientificInteractionPrompt: React.FC = () => {
  const playerPos = useOutpostStore((state) => state.playerPos);
  const roverPos = useOutpostStore((state) => state.roverPos);
  const grounded = useOutpostStore((state) => state.isPlayerGrounded);
  const isRemote = useOutpostStore((state) => state.isDrivingRover);
  const remoteRegionId = useOutpostStore((state) => state.remoteRegionId);
  const isBackpackOpen = useOutpostStore((state) => state.isBackpackOpen);
  const isManualOpen = useOutpostStore((state) => state.isManualOpen);
  const isDatapadOpen = useOutpostStore((state) => state.isDatapadOpen);
  const isClassroomOpen = useOutpostStore((state) => state.isClassroomOpen);
  const isBrownoutQuizOpen = useOutpostStore((state) => state.isBrownoutQuizOpen);
  const toggleDrivingRover = useOutpostStore((state) => state.toggleDrivingRover);
  const activeScienceEntryId = useOutpostStore((state) => state.activeScienceEntryId);
  const pose = isRemote ? roverPos : playerPos;
  const nearest = useMemo(() => nearestScientificElement(SCIENTIFIC_ELEMENTS, pose, {
    isRemote,
    remoteRegionId,
    grounded: isRemote || grounded,
  }), [pose, isRemote, remoteRegionId, grounded]);
  const modalOpen = isBackpackOpen || isManualOpen || isDatapadOpen || isClassroomOpen || isBrownoutQuizOpen ||
    activeScienceEntryId !== null || hasBlockingOverlay();

  const nearestConsole = useMemo(() => {
    if (isRemote || !grounded || remoteRegionId !== null) return null;
    let result: (typeof WORLD_REGIONS)[number] | null = null;
    let best = REGIONAL_SCOUT_RANGE;
    for (const region of WORLD_REGIONS) {
      const distance = Math.hypot(pose[0] - region.baseConsole.x, pose[2] - region.baseConsole.z);
      if (distance <= best) { best = distance; result = region; }
    }
    return result;
  }, [pose, isRemote, grounded, remoteRegionId]);

  const inspect = useCallback((id: string) => {
    const state = useOutpostStore.getState();
    const livePose = state.isDrivingRover ? state.roverPos : state.playerPos;
    const candidate = nearestScientificElement(SCIENTIFIC_ELEMENTS, livePose, {
      isRemote: state.isDrivingRover,
      remoteRegionId: state.remoteRegionId,
      grounded: state.isDrivingRover || state.isPlayerGrounded,
    });
    if (!candidate || candidate.id !== id || modalOpen || hasBlockingOverlay()) return;
    state.inspectScientificElement(id);
  }, [modalOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'KeyF' || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (isScientificKeyTarget(event.target) || modalOpen || hasBlockingOverlay()) return;
      const state = useOutpostStore.getState();
      const livePose = state.isDrivingRover ? state.roverPos : state.playerPos;
      const target = nearestScientificElement(SCIENTIFIC_ELEMENTS, livePose, {
        isRemote: state.isDrivingRover,
        remoteRegionId: state.remoteRegionId,
        grounded: state.isDrivingRover || state.isPlayerGrounded,
      });
      if (!target) return;
      event.preventDefault();
      state.inspectScientificElement(target.id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen]);


  return <>
    {!modalOpen && (nearest || (!isRemote && nearestConsole)) && <div
      data-testid="scientific-interaction-prompt"
      className="pointer-events-auto fixed bottom-[19rem] left-1/2 z-[55] max-w-[calc(100vw-1.5rem)] -translate-x-1/2 lg:bottom-52"
      role="status"
    >
      {nearest ? <button type="button" onKeyDown={(event) => { if (event.code === 'Space') event.stopPropagation(); }} onClick={() => inspect(nearest.id)} className="min-h-12 min-w-[min(92vw,18rem)] rounded-lg border border-[#d4c29d]/45 bg-[#171a1c]/95 px-4 py-2 text-left text-sm text-[#f1e1d3] shadow-[0_5px_18px_rgba(0,0,0,.45)] hover:border-[#d4c29d]/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200">
        <span className="mr-2 inline-flex h-6 min-w-6 items-center justify-center rounded border border-[#d4c29d]/45 bg-[#302a22] px-1 font-semibold text-[#f0d7a4]">F</span>
        Inspect <span className="font-semibold">{nearest.title}</span>
      </button> : <button type="button" onClick={() => toggleDrivingRover()} className="min-h-12 min-w-[min(92vw,18rem)] rounded-lg border border-[#d4c29d]/35 bg-[#171a1c]/95 px-4 py-2 text-left text-sm text-[#f1e1d3] shadow-[0_5px_18px_rgba(0,0,0,.4)] hover:border-[#d4c29d]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200">
        <span className="mr-2 inline-flex h-6 min-w-6 items-center justify-center rounded border border-[#d4c29d]/40 bg-[#302a22] px-1 font-semibold text-[#f0d7a4]">R</span>
        Link <span className="font-semibold">{nearestConsole!.name}</span> regional scout
      </button>}
    </div>}
  </>;
};

export default ScientificInteractionPrompt;
