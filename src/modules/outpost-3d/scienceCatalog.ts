import { WORLD_REGIONS, type RegionId, type WorldPoint } from './worldRegions';

export interface ScientificElement {
  readonly id: string;
  readonly regionId: RegionId;
  readonly title: string;
  readonly kind:
    | 'impact-rock' | 'crater' | 'ejecta' | 'dust-devil' | 'dust-deposit' | 'wind-streak'
    | 'basalt' | 'strata' | 'lava-channel' | 'ice' | 'radar' | 'frost'
    | 'delta' | 'sediment' | 'sample-cache';
  readonly position: WorldPoint;
  readonly summary: string;
  readonly explanation: string;
  readonly sourceTitle: string;
  readonly sourceUrl: string;
  readonly credit: string;
  readonly scienceBoundary: string;
}

type ElementCopy = Pick<ScientificElement, 'title' | 'kind' | 'summary' | 'explanation' | 'sourceTitle' | 'sourceUrl' | 'credit' | 'scienceBoundary'>;

const REGION_COPY: Readonly<Record<RegionId, readonly [ElementCopy, ElementCopy, ElementCopy]>> = {
  impact: [
    {
      title: 'Impact-shocked rock', kind: 'impact-rock',
      summary: 'Some Martian impact craters have ejecta lobes shaped by interactions with volatile-rich ground.',
      explanation: 'Some Martian craters have continuous ejecta lobes interpreted as material fluidized over volatile-rich ground. A rock’s appearance alone cannot prove that it is a meteorite.',
      sourceTitle: 'Fluidized crater ejecta', sourceUrl: 'https://science.nasa.gov/photojournal/fluidized-crater-ejecta/',
      credit: 'NASA/JPL/Arizona State University',
      scienceBoundary: 'Training depiction only; a rock’s appearance cannot establish meteorite origin or identify this fictional site.',
    },
    {
      title: 'Crater rim', kind: 'crater',
      summary: 'A crater rim records material displaced during an impact.',
      explanation: 'Impact craters form when an incoming body strikes the ground and ejects material. The shape shown here is illustrative, not a measurement of a mapped NASA crater.',
      sourceTitle: 'Fluidized crater ejecta', sourceUrl: 'https://science.nasa.gov/photojournal/fluidized-crater-ejecta/',
      credit: 'NASA/JPL/Arizona State University',
      scienceBoundary: 'Training feature; no size, age, or impactor identity is inferred from this scene.',
    },
    {
      title: 'Ejecta blanket', kind: 'ejecta',
      summary: 'Ejecta is material thrown outward when an impact crater forms.',
      explanation: 'Some Martian craters have lobate ejecta patterns interpreted as impact material that flowed over volatile-bearing ground. That interpretation does not identify the exact composition beneath this fictional feature.',
      sourceTitle: 'Fluidized crater ejecta', sourceUrl: 'https://science.nasa.gov/photojournal/fluidized-crater-ejecta/',
      credit: 'NASA/JPL/Arizona State University',
      scienceBoundary: 'A general Mars example, not a claim that this training feature has measured volatiles.',
    },
  ],
  ice: [
    {
      title: 'Subsurface water ice', kind: 'ice',
      summary: 'Orbital observations map areas where water ice may lie beneath Martian soil.',
      explanation: 'NASA’s Subsurface Water Ice Mapping project combines orbital measurements to locate likely buried ice. Subsurface ice is not surface water and is not ready to drink without extraction and treatment.',
      sourceTitle: 'SWIM Map Shows Subsurface Water Ice on Mars', sourceUrl: 'https://science.nasa.gov/photojournal/swim-map-shows-subsurface-water-ice-on-mars/',
      credit: 'NASA/JPL-Caltech/Planetary Science Institute',
      scienceBoundary: 'A conceptual training marker; it does not report a local ice detection or an accessible water reserve.',
    },
    {
      title: 'Radar view', kind: 'radar',
      summary: 'Radar and other orbital data help assess possible buried ice.',
      explanation: 'Scientists combine multiple kinds of orbital evidence because no single map is a direct view of every buried layer. This scene contains no actual radar return or local measurement.',
      sourceTitle: 'SWIM Map Shows Subsurface Water Ice on Mars', sourceUrl: 'https://science.nasa.gov/photojournal/swim-map-shows-subsurface-water-ice-on-mars/',
      credit: 'NASA/JPL-Caltech/Planetary Science Institute',
      scienceBoundary: 'Illustrative only; no radar instrument is being simulated and no water quantity is implied.',
    },
    {
      title: 'Seasonal frost', kind: 'frost',
      summary: 'Some overnight frost observed on Mars is mostly carbon-dioxide ice.',
      explanation: 'NASA observations found that frost in the studied locations was largely dry ice, not water ice. A pale surface or frost-like appearance cannot identify its composition by sight alone.',
      sourceTitle: 'Science at Sunrise: Solving the Mystery of Frost Hiding on Mars', sourceUrl: 'https://www.nasa.gov/missions/odyssey/science-at-sunrise-solving-the-mystery-of-frost-hiding-on-mars/',
      credit: 'NASA/JPL-Caltech/Arizona State University',
      scienceBoundary: 'A general observation; the training frost does not represent a measured local deposit.',
    },
  ],
  volcano: [
    {
      title: 'Volcanic flow rock', kind: 'basalt',
      summary: 'Orbital images show extensive volcanic flows on Mars.',
      explanation: 'Orbital images show volcanic flow patterns on Mars. The appearance of this training rock does not confirm its composition.',
      sourceTitle: 'Martian Lava Flows', sourceUrl: 'https://science.nasa.gov/photojournal/martian-lava-flows/',
      credit: 'NASA/JPL/Malin Space Science Systems',
      scienceBoundary: 'Color and shape in this scene do not establish mineral composition or a specific eruption history.',
    },
    {
      title: 'Layered flow edge', kind: 'strata',
      summary: 'A younger plain truncating a flow can reveal their relative order.',
      explanation: 'The cited orbital example shows a younger plain truncating older flow features. This indicates relative order, not an absolute age in years.',
      sourceTitle: 'Martian Lava Flows', sourceUrl: 'https://science.nasa.gov/photojournal/martian-lava-flows/',
      credit: 'NASA/JPL/Malin Space Science Systems',
      scienceBoundary: 'Relative chronology only; no absolute date is assigned to this fictional outcrop.',
    },
    {
      title: 'Lava channel', kind: 'lava-channel',
      summary: 'Some Martian volcanic flows show channels and raised margins called levees.',
      explanation: 'Orbital images show channels and levees associated with some Martian flows. The shape of this training feature alone does not establish its composition or origin.',
      sourceTitle: 'Martian Lava Flows', sourceUrl: 'https://science.nasa.gov/photojournal/martian-lava-flows/',
      credit: 'NASA/JPL/Malin Space Science Systems',
      scienceBoundary: 'Illustrative landform; no local flow composition, age, or direction is measured.',
    },
  ],
  lake: [
    {
      title: 'Ancient delta', kind: 'delta',
      summary: 'A river delta can preserve sediments deposited where water entered a lake.',
      explanation: 'As general mission context, Perseverance studies the ancient Jezero delta as a record of past water and to investigate potential signs of ancient life. That mission goal is not evidence that life existed there or at this fictional site.',
      sourceTitle: 'Studying the Jezero Delta From a Distance', sourceUrl: 'https://science.nasa.gov/blog/studying-the-jezero-delta-from-a-distance/',
      credit: 'NASA/JPL-Caltech/ASU/MSSS',
      scienceBoundary: 'General Jezero science context; the fictional lake margin is not Jezero or a confirmed biosignature site.',
    },
    {
      title: 'Layered sediment', kind: 'sediment',
      summary: 'Sedimentary layers can preserve evidence of changing environments.',
      explanation: 'Perseverance studies delta rocks to understand how sediments were transported and deposited in ancient Jezero. Layering can inform geological history, but does not by itself show biology.',
      sourceTitle: 'Studying the Jezero Delta From a Distance', sourceUrl: 'https://science.nasa.gov/blog/studying-the-jezero-delta-from-a-distance/',
      credit: 'NASA/JPL-Caltech/ASU/MSSS',
      scienceBoundary: 'Training outcrop only; no sediment composition or biological evidence is claimed here.',
    },
    {
      title: 'Sample cache marker', kind: 'sample-cache',
      summary: 'Perseverance placed selected sample tubes in a depot at Three Forks.',
      explanation: 'Perseverance deposited selected sample tubes at Three Forks in 2022–23. This marker is a fictional teaching prop, not a replica or location of that depot.',
      sourceTitle: 'Perseverance’s Three Forks Sample Depot Map', sourceUrl: 'https://science.nasa.gov/photojournal/perseverances-three-forks-sample-depot-map/',
      credit: 'NASA/JPL-Caltech/University of Arizona',
      scienceBoundary: 'No real sample, cache coordinate, or return status is represented by this training marker.',
    },
  ],
  dust: [
    {
      title: 'Passing dust devil', kind: 'dust-devil',
      summary: 'Martian dust devils are whirlwinds observed moving across the ground.',
      explanation: 'Rover observations show dust devils as transient events linked to surface heating and atmospheric motion. They are not evidence of a permanent tornado-like storm at this site.',
      sourceTitle: 'Curiosity Observes Whirlwinds Carrying Martian Dust', sourceUrl: 'https://science.nasa.gov/resource/curiosity-observes-whirlwinds-carrying-martian-dust/',
      credit: 'NASA/JPL-Caltech/TAMU',
      scienceBoundary: 'Training illustration; no live weather, wind speed, or dust-devil measurement is simulated.',
    },
    {
      title: 'Dust deposit', kind: 'dust-deposit',
      summary: 'Wind can move bright dust and expose darker ground beneath it.',
      explanation: 'NASA observations describe bright dust settling and wind removing thin dust veneers, changing the surface contrast. A color difference alone does not identify a mineral or deposit age.',
      sourceTitle: 'Wind Streaks Among Flows', sourceUrl: 'https://science.nasa.gov/photojournal/wind-streaks-among-flows/',
      credit: 'NASA/JPL/Malin Space Science Systems',
      scienceBoundary: 'General wind-process example; this training patch has no measured composition or age.',
    },
    {
      title: 'Wind streak', kind: 'wind-streak',
      summary: 'Streak orientation can help scientists infer the direction of past winds.',
      explanation: 'Mapped Martian wind streaks form as wind redistributes a thin dust cover around surface features. The displayed orientation is not a local wind measurement or a real NASA image.',
      sourceTitle: 'Wind Streaks Among Flows', sourceUrl: 'https://science.nasa.gov/photojournal/wind-streaks-among-flows/',
      credit: 'NASA/JPL/Malin Space Science Systems',
      scienceBoundary: 'Illustrative streak only; no precise wind vector or atmospheric strength is inferred.',
    },
  ],
};

export const SCIENTIFIC_ELEMENTS: readonly ScientificElement[] = WORLD_REGIONS.flatMap((region) =>
  REGION_COPY[region.id].map((item, index) => ({
    id: `${region.id}.science-${index + 1}`,
    regionId: region.id,
    title: item.title,
    kind: item.kind,
    position: region.discoveries[index],
    summary: item.summary,
    explanation: item.explanation,
    sourceTitle: item.sourceTitle,
    sourceUrl: item.sourceUrl,
    credit: item.credit,
    scienceBoundary: item.scienceBoundary,
  })),
);

export function getScientificElement(id: string): ScientificElement | undefined {
  return SCIENTIFIC_ELEMENTS.find((element) => element.id === id);
}
