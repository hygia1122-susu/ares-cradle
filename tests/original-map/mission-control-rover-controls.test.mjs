import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = readFileSync(resolve(root, 'src/modules/mission-control/MissionControlOverlay.tsx'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React } }).outputText;
const element = (type, props, ...children) => ({ type, props: { ...props, children: children.length <= 1 ? children[0] : children } });
let capturedEffects = null;
const React = { createElement: element, useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}], useEffect: (effect) => capturedEffects?.push(effect) };
globalThis.document ??= { documentElement: { setAttribute() {} }, querySelector: () => null, querySelectorAll: () => [] };
const components = new Map([
  ['./EventModal', 'EventModal'], ['./DebriefModal', 'DebriefModal'],
  ['@/modules/survival-ui/BackpackModal', 'BackpackModal'], ['@/modules/survival-ui/RewardCelebration', 'RewardCelebration'],
  ['@/modules/survival-ui/ClassroomModal', 'ClassroomModal'], ['@/modules/survival-ui/BrownoutQuizModal', 'BrownoutQuizModal'],
  ['@/modules/character/VirtualJoystick', 'VirtualJoystick'], ['@/modules/showcase/LabShowcaseModal', 'LabShowcaseModal'],
  ['@/modules/story-engine/components/MinimapRadar', 'MinimapRadar'], ['@/modules/story-engine/components/FieldSpecimenToast', 'FieldSpecimenToast'],
  ['@/modules/story-engine/components/BioDomeLabStation', 'BioDomeLabStation'], ['@/modules/story-engine/components/ScienceCardModal', 'ScienceCardModal'],
  ['./ExplorationHUD', 'ExplorationHUD'], ['./QuickControlsManual', 'QuickControlsManual'], ['./ExplorationMap', 'ExplorationMap'], ['./ScienceCodex', 'ScienceCodex'],
].map(([id, name]) => [id, Object.assign(function StubComponent() {}, { displayName: name })]));
const world = { getRegionByPosition: () => ({ id: 'home', name: 'Ares Cradle' }), WORLD_REGIONS: [{ id: 'impact', name: 'Impact Basin', baseConsole: { x: -240, z: -240 } }, { id: 'ice', name: 'Sheltered Ice Shelf', baseConsole: { x: 240, z: -240 } }, { id: 'volcano', name: 'Basalt Ridges', baseConsole: { x: -240, z: 240 } }, { id: 'lake', name: 'Ancient Lake Margin', baseConsole: { x: 240, z: 240 } }, { id: 'dust', name: 'Wind-Swept Basin', baseConsole: { x: 0, z: -255 } }] };
const science = { SCIENTIFIC_ELEMENTS: world.WORLD_REGIONS.flatMap(({ id }) => [1, 2, 3].map((n) => ({ id: `${id}.science-${n}`, regionId: id }))) };
const storeState = (overrides = {}) => ({ exploration: { survival: { air: 100, meals: 12, energyEU: 100 }, collected: [] }, explorationWarning: null, explorationNotice: null, dismissExplorationNotice() {}, activeScienceEntryId: null, openScienceEntry() {}, isManualOpen: false, setManualOpen() {}, playerPos: [0, -0.4, 0], roverPos: [0, -0.4, 0], remoteRegionId: null, isDrivingRover: false, activeWaypointRegionId: 'dust', setWaypointRegion() {}, isBackpackOpen: false, openBackpack() { state.openCount += 1; state.isBackpackOpen = true; }, closeBackpack() { state.closeCount += 1; state.isBackpackOpen = false; }, isClassroomOpen: false, closeClassroom() {}, isPhysicsDebugVisible: false, togglePhysicsDebug() {}, hudColorTheme: 'solar-amber', cycleHudColorTheme() {}, isPointerLocked: false, toggleDrivingRover() {}, inventory: {}, roverInventory: {}, quickbarSlots: ['flashlight', 'soil_analyzer', 'flashlight', 'flashlight', 'flashlight'], assignQuickbarSlot() {}, executeItemAction: () => ({ ok: true, feedback: 'ok', reason: 'no' }), transferCargoItem: () => ({ ok: true, reason: 'ok' }), oxygen: 21, temperature: 20, battery: 100, batteryKwh: 10, batteryCapacityKwh: 10, dustCoverage: 0, isFlashlightOn: false, isInsideHabitat: true, activeEvents: [], ...overrides });
let state;
const store = (selector) => selector(state);
store.getState = () => state;
const loadOverlay = () => {
  const localRequire = (id) => {
    if (id === 'react') return { __esModule: true, default: React, ...React };
    if (id === '@/modules/store/useOutpostStore') return { useOutpostStore: store };
    if (id === '@/modules/store/useStoryStore') return { useStoryStore: (selector) => selector({ setBriefingOpen() {} }) };
    if (id === '@/modules/outpost-3d/worldRegions') return world;
    if (id === '@/modules/outpost-3d/scienceCatalog') return science;
    if (components.has(id)) return { __esModule: true, default: components.get(id) };
    throw new Error(`Unexpected import in MissionControlOverlay test: ${id}`);
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  return module.exports.MissionControlOverlay();
};
const descendants = (node, visit) => {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach((child) => descendants(child, visit));
  if (!node.type) return;
  visit(node);
  descendants(node.props?.children, visit);
};
const nodes = (tree) => { const found = []; descendants(tree, (node) => found.push(node)); return found; };
const named = (items, name) => items.find((node) => node.type.displayName === name);

const backpackSource = readFileSync(resolve(root, 'src/modules/survival-ui/BackpackModal.tsx'), 'utf8');
const backpackCompiled = ts.transpileModule(backpackSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React } }).outputText;
const backpackElement = (type, props, ...children) => ({ type, props: { ...props, children: children.length <= 1 ? children[0] : children } });
const backpackReact = { createElement: backpackElement, useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}], useEffect: (effect) => capturedEffects?.push(effect) };
const item = new Proxy({}, { get: (_, key) => ({ id: String(key), name: String(key), catalogNumber: 1, svgIconId: 'tool', mvpActive: true, reusable: true, category: 'tool', unitLabel: 'unit', targetRequirement: 'Any target', costOrYieldLabel: 'No cost', description: 'Tool', scientificNote: 'Context', unlockSol: 1 })[key] });
const backpackImports = new Map([
  ['framer-motion', { motion: { div: 'motion.div' }, AnimatePresence: 'AnimatePresence' }],
  ['lucide-react', new Proxy({}, { get: (_, name) => name })],
  ['@/modules/store/useOutpostStore', { useOutpostStore: Object.assign((...args) => outpostStore(...args), { getState: () => outpostStore.getState() }) }],
  ['@/modules/store/useStoryStore', { useStoryStore: (selector) => selector({ carriedVials: [], setLabStationOpen() {} }) }],
  ['@/modules/audio/soundEngine', { soundEngine: { playClick() {} } }],
  ['./itemRegistry', { ITEM_CATALOG: new Proxy({ flashlight: item.flashlight }, { get: (target, key) => target[key] ?? item[key] }), MVP_EQUIPMENT_IDS: ['flashlight', 'soil_analyzer'], BLUEPRINT_CATALOG_IDS: ['blueprint'], ItemStatusBadge: {} }],
  ['./AerospaceItemIcon', 'AerospaceItemIcon'],
  ['@/modules/mission-control/BackpackSurvivalShelf', 'BackpackSurvivalShelf'],
]);
let outpostStore = store;
const loadBackpack = () => {
  const localRequire = (id) => {
    if (id === 'react') return { __esModule: true, default: backpackReact, ...backpackReact };
    const imported = backpackImports.get(id);
    if (imported !== undefined) return typeof imported === 'string' ? { __esModule: true, default: Object.assign(function Stub() {}, { displayName: imported }) } : imported;
    throw new Error(`Unexpected import in BackpackModal test: ${id}`);
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', backpackCompiled)(localRequire, module, module.exports);
  return module.exports.BackpackModal();
};

test('exploration overlay presents new controls without permanent cockpit clutter on desktop and mobile', () => {
  for (const mobile of [false, true]) {
    state = storeState();
    const savedWindow = globalThis.window;
    globalThis.window = { innerWidth: mobile ? 390 : 1440, matchMedia: () => ({ matches: mobile, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, removeEventListener() {} };
    const rendered = nodes(loadOverlay());
    assert.ok(named(rendered, 'ExplorationHUD'));
    assert.ok(named(rendered, 'MinimapRadar'));
    assert.ok(named(rendered, 'QuickControlsManual'));
    assert.ok(named(rendered, 'ExplorationMap'));
    assert.ok(named(rendered, 'ScienceCodex'));
    assert.equal(named(rendered, 'CockpitVisorHUD'), undefined);
    assert.equal(named(rendered, 'HorizontalDatapadHUD'), undefined);
    assert.equal(named(rendered, 'CockpitDrivingDeck'), undefined);
    assert.equal(named(rendered, 'MissionCommsBriefing'), undefined);
    if (savedWindow === undefined) delete globalThis.window; else globalThis.window = savedWindow;
  }
});

test('backpack keyboard owner avoids dialog collisions and toggles once in either mount order', () => {
  const originalWindow = globalThis.window;
  const originalQuerySelector = globalThis.document.querySelector;
  const originalQuerySelectorAll = globalThis.document.querySelectorAll;

  for (const backpackFirst of [false, true]) {
    const listeners = new Map();
    const dialogs = [];
    globalThis.window = {
      innerWidth: 1440,
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
      addEventListener(type, listener) { const list = listeners.get(type) ?? []; list.push(listener); listeners.set(type, list); },
      removeEventListener(type, listener) { listeners.set(type, (listeners.get(type) ?? []).filter((entry) => entry !== listener)); },
    };
    globalThis.document.querySelectorAll = (selector) => selector === '[role="dialog"]' ? dialogs.map((label) => ({ getAttribute: (name) => name === 'aria-labelledby' ? label : null })) : [];
    globalThis.document.querySelector = (selector) => globalThis.document.querySelectorAll(selector)[0] ?? null;

    state = storeState({ openCount: 0, closeCount: 0 });
    const renderAndMount = (render) => {
      capturedEffects = [];
      const rendered = render();
      const effects = capturedEffects;
      capturedEffects = null;
      for (const effect of effects) effect();
      return rendered;
    };
    let overlayTree;
    if (backpackFirst) {
      renderAndMount(loadBackpack);
      overlayTree = renderAndMount(loadOverlay);
    } else {
      overlayTree = renderAndMount(loadOverlay);
      renderAndMount(loadBackpack);
    }

    const press = (key, options = {}) => {
      let prevented = false;
      let stopped = false;
      const event = { key, repeat: false, ctrlKey: false, altKey: false, metaKey: false, target: { tagName: 'BODY', isContentEditable: false }, preventDefault() { prevented = true; }, stopPropagation() { stopped = true; }, ...options };
      for (const listener of listeners.get('keydown') ?? []) listener(event);
      return { prevented, stopped };
    };

    // An open Manual, Map or Codex role-dialog keeps E/I from stacking the backpack.
    for (const [label, overrides] of [
      ['exploration-manual-title', { isManualOpen: true }],
      ['exploration-map-title', {}],
      ['science-codex-title', { activeScienceEntryId: 'impact.science-1' }],
    ]) {
      state = storeState({ openCount: 0, closeCount: 0, ...overrides });
      dialogs.splice(0, dialogs.length, label);
      press('e');
      press('i');
      assert.equal(state.openCount, 0, `${label} should keep E/I from opening a second dialog`);
      assert.equal(state.isBackpackOpen, false);
    }

    const hud = named(nodes(overlayTree), 'ExplorationHUD');
    state = storeState({ openCount: 0, closeCount: 0 });
    hud.props.onBackpack();
    assert.equal(state.openCount, 1, 'explicit HUD backpack action should remain wired to openBackpack');
    assert.equal(state.isBackpackOpen, true);

    dialogs.length = 0;
    state = storeState({ openCount: 0, closeCount: 0 });
    const opened = press('e');
    assert.equal(state.openCount, 1, 'E should open backpack exactly once regardless of effect order');
    assert.equal(state.isBackpackOpen, true);
    assert.equal(opened.prevented, true);
    assert.equal(opened.stopped, true);

    dialogs.push('backpack-modal-title');
    press('i');
    assert.equal(state.closeCount, 1, 'I should close the already-open backpack once');
    assert.equal(state.isBackpackOpen, false);
    dialogs.length = 0;

    state = storeState({ openCount: 0, closeCount: 0 });
    press('i');
    assert.equal(state.openCount, 1, 'I should open the backpack exactly once');
    press('e');
    assert.equal(state.closeCount, 1, 'E should close the already-open backpack exactly once');
    assert.equal(state.isBackpackOpen, false);

    state = storeState({ openCount: 0, closeCount: 0, isBackpackOpen: true });
    dialogs.push('backpack-modal-title');
    press('Escape', { target: { tagName: 'INPUT', isContentEditable: false } });
    assert.equal(state.closeCount, 1, 'Escape should close the backpack even when focused in an input');
    assert.equal(state.isBackpackOpen, false);

    dialogs.length = 0;
    state = storeState({ openCount: 0, closeCount: 0 });
    press('e', { repeat: true });
    press('e', { shiftKey: true });
    press('e', { ctrlKey: true });
    press('e', { altKey: true });
    press('e', { metaKey: true });
    press('i', { target: { tagName: 'INPUT', isContentEditable: false } });
    press('i', { target: { tagName: 'DIV', isContentEditable: true } });
    assert.equal(state.openCount, 0, 'repeat, modified, and text-entry keystrokes should not toggle');
    assert.equal((listeners.get('keydown') ?? []).length, 2, 'overlay and BackpackModal may both listen, but their E/I handling must not double-toggle');
  }

  globalThis.window = originalWindow;
  globalThis.document.querySelector = originalQuerySelector;
  globalThis.document.querySelectorAll = originalQuerySelectorAll;
});

test('remote scout HUD follows the actual rover region independently from the explorer', () => {
  state = storeState({ isDrivingRover: true, remoteRegionId: 'ice', playerPos: [-240, -0.4, -240], roverPos: [240, -0.4, -240], activeWaypointRegionId: 'impact' });
  const rendered = nodes(loadOverlay());
  const hud = named(rendered, 'ExplorationHUD');
  assert.equal(hud.props.regionName, 'Sheltered Ice Shelf');
  assert.equal(hud.props.remote, true);
  assert.ok(hud.props.task.includes('Impact Basin'), 'remote location is not confused with selected destination');
});

test('Field Guide removes impact lab tools tab while keeping the capsule and telescope sections', () => {
  const source = readFileSync(resolve(root, 'src/modules/story-engine/components/FieldGuideModal.tsx'), 'utf8');
  assert.doesNotMatch(source, /ImpactFieldTools|Field Tools|field-tools/);
  assert.match(source, /NASA Data Capsules/);
  assert.match(source, /Orbital Telescope/);
});
