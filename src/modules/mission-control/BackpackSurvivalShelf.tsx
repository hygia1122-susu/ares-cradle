import React from 'react';
import { useOutpostStore } from '@/modules/store/useOutpostStore';

const SUPPLIES = [
  { id: 'air_canister', name: 'Air canister', resource: 'Air' },
  { id: 'space_apple', name: 'Meal ration', resource: 'Meals' },
  { id: 'backup_battery', name: 'Power cell', resource: 'Energy' },
] as const;

export const BackpackSurvivalShelf: React.FC = () => {
  const inventory = useOutpostStore((state) => state.inventory);
  const exploration = useOutpostStore((state) => state.exploration);
  const consume = useOutpostStore((state) => state.consumeSurvivalItem);
  return <section aria-label="Exploration supplies" className="mb-4 rounded-lg border border-amber-100/20 bg-[#101518] p-3">
    <h3 className="text-sm font-semibold text-[#f1dfce]">Exploration supplies</h3>
    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {SUPPLIES.map(({ id, name, resource }) => {
        const count = inventory[id] ?? 0;
        const value = resource === 'Air' ? exploration.survival.air : resource === 'Meals' ? exploration.survival.meals : exploration.survival.energyEU;
        const capacity = resource === 'Meals' ? 12 : 100;
        return <div key={id} className="flex items-center justify-between gap-2 rounded-md border border-white/10 px-3 py-2">
          <div className="min-w-0"><div className="truncate text-xs font-medium text-[#ebd9c9]">{name} · {count}</div><div className="text-[11px] text-[#c3ad9b]">{resource}: {Math.round(value)} / {capacity}</div></div>
          <button type="button" onClick={() => consume(id)} disabled={count <= 0 || value >= capacity} className="min-h-10 shrink-0 rounded border border-amber-100/25 px-3 text-xs text-amber-50 hover:bg-amber-100/10 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">Use</button>
        </div>;
      })}
    </div>
  </section>;
};

export default BackpackSurvivalShelf;
