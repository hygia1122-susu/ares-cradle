import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const compile = (relative, requires, react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.length === 1 ? children[0] : children } }), useRef: (current) => ({ current }), useEffect: () => {} }) => {
  const source = readFileSync(resolve(root, relative), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)((id) => id === 'react' ? { __esModule: true, default: react, ...react } : requires(id), module, module.exports);
  return module.exports;
};
const flatten = (node, result = []) => {
  if (!node || typeof node !== 'object') return result;
  if (Array.isArray(node)) { node.forEach((child) => flatten(child, result)); return result; }
  result.push(node);
  flatten(node.props?.children, result);
  return result;
};

const hudModule = compile('src/modules/mission-control/ExplorationHUD.tsx', (id) => {
  if (id === 'lucide-react') return Object.fromEntries(['Backpack', 'BookOpen', 'HelpCircle', 'Map', 'Wind', 'Utensils', 'Zap'].map((name) => [name, name]));
  throw new Error(`Unexpected HUD import ${id}`);
});
const minimapDeps = async () => import('../../tests/mission-v2/support/load-ts-module.mjs');

test('exploration HUD renders segmented, accessible resource capacities', () => {
  const tree = hudModule.ExplorationHUD({ task: 'Inspect impact rock', taskProgress: { current: 1, required: 3 }, regionName: 'Impact Basin', distance: 26, air: 100, meals: 12, energyEU: 0, onBackpack() {}, onMap() {}, onCodex() {}, onHelp() {} });
  const nodes = flatten(tree);
  const resolveElement = (node) => {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(resolveElement);
    if (typeof node.type === 'function') return resolveElement(node.type(node.props));
    return { ...node, props: { ...node.props, children: resolveElement(node.props?.children) } };
  };
  const rendered = flatten(resolveElement(tree));
  const resource = (label) => rendered.find((node) => node.props?.['data-testid'] === `resource-${label.toLowerCase()}`);
  assert.ok(resource('Air'));
  assert.equal(resource('Air').props['aria-label'], 'Air 100/100');
  assert.equal(resource('Meals').props['aria-label'], 'Meals 12/12');
  assert.equal(resource('Energy').props['aria-label'], 'Energy 0/100');
  assert.equal(rendered.filter((node) => node.type === 'kbd').length, 0, 'no persistent keyboard-hint bar');
  assert.equal(rendered.filter((node) => node.type === 'span' && node.props?.className?.includes('inline-flex h-2.5 w-2.5')).length, 30, 'three resource rows render ten repeated icons each');
  assert.ok(rendered.some((node) => node.props?.['data-testid'] === 'exploration-hud'));
});

test('exploration dialog keeps one focus lifecycle while callbacks and player pose update', () => {
  const effects = [];
  let hookValues = [];
  let hookIndex = 0;
  const react = {
    useRef: (initial) => {
      const index = hookIndex++;
      if (!(index in hookValues)) hookValues[index] = { current: initial };
      return hookValues[index];
    },
    useEffect: (create, deps) => {
      const index = hookIndex++;
      const previous = hookValues[index];
      const changed = !previous || !deps || !previous.deps || deps.length !== previous.deps.length || deps.some((value, i) => !Object.is(value, previous.deps[i]));
      if (changed) effects.push({ index, create, deps });
    },
  };
  const hook = compile('src/modules/mission-control/useExplorationDialog.ts', (id) => { throw new Error(`Unexpected dialog import ${id}`); }, react).useExplorationDialog;
  const originalGlobals = ['document', 'window', 'HTMLElement'].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  const listeners = new Set();
  let addCount = 0;
  let removeCount = 0;
  class FakeHTMLElement {
    focusCalls = 0;
    focus() { this.focusCalls++; globalThis.document.activeElement = this; }
  }
  globalThis.document = { activeElement: null };
  globalThis.HTMLElement = FakeHTMLElement;
  globalThis.window = {
    addEventListener(type, listener) { assert.equal(type, 'keydown'); addCount++; listeners.add(listener); },
    removeEventListener(type, listener) { assert.equal(type, 'keydown'); removeCount++; listeners.delete(listener); },
  };
  const previousFocus = new FakeHTMLElement();
  const first = new FakeHTMLElement();
  const second = new FakeHTMLElement();
  let focusables = [first, second];
  const dialogRef = { current: { querySelectorAll: () => focusables } };
  const render = (isOpen, onClose, playerPose) => {
    void playerPose;
    hookIndex = 0;
    effects.length = 0;
    hook(isOpen, onClose, dialogRef);
    for (const effect of effects) {
      const previous = hookValues[effect.index];
      previous?.cleanup?.();
      const cleanup = effect.create();
      hookValues[effect.index] = { deps: effect.deps, cleanup };
    }
  };
  const dispatch = (key, shiftKey = false) => {
    let prevented = false;
    for (const listener of [...listeners]) listener({ key, shiftKey, preventDefault() { prevented = true; } });
    return prevented;
  };
  try {
    globalThis.document.activeElement = previousFocus;
    let closeA = 0;
    let closeB = 0;
    render(true, () => closeA++, [0, 0, 0]);
    assert.equal(first.focusCalls, 1, 'open focuses the first dialog control once');
    assert.equal(addCount, 1);
    assert.equal(listeners.size, 1);

    render(true, () => closeB++, [1, 0, 0]);
    assert.equal(first.focusCalls, 1, 'same-open rerender does not refocus');
    assert.equal(addCount, 1, 'same-open rerender does not add another listener');
    assert.equal(removeCount, 0, 'same-open rerender does not clean up the listener');
    assert.equal(listeners.size, 1);

    globalThis.document.activeElement = new FakeHTMLElement();
    assert.equal(dispatch('Escape'), true, 'Escape is prevented even after focus left the dialog');
    assert.equal(closeA, 0);
    assert.equal(closeB, 1, 'Escape uses the latest callback');

    render(false, () => closeB++, [1, 0, 0]);
    assert.equal(previousFocus.focusCalls, 1, 'closing restores the original focus once');
    assert.equal(removeCount, 1);
    assert.equal(listeners.size, 0);

    render(true, () => closeB++, [2, 0, 0]);
    assert.equal(first.focusCalls, 2, 'reopening focuses the dialog again once');
    assert.equal(addCount, 2);
    focusables = [second, new FakeHTMLElement()];
    const liveLast = focusables[1];
    globalThis.document.activeElement = liveLast;
    assert.equal(dispatch('Tab'), true);
    assert.equal(globalThis.document.activeElement, second, 'Tab wraps to the first currently focusable control');
    assert.equal(dispatch('Tab', true), true);
    assert.equal(globalThis.document.activeElement, liveLast, 'Shift+Tab wraps to the last currently focusable control');

    render(false, () => closeB++, [2, 0, 0]);
    assert.equal(previousFocus.focusCalls, 2, 'the reopened dialog restores focus once when closed');
    assert.equal(listeners.size, 0);
  } finally {
    for (const [name, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});

test('waypoint map only changes selected navigation target and displays canonical locations', async () => {
  const world = await minimapDeps().then((loaded) => loaded.loadTsModule('../../src/modules/outpost-3d/worldRegions.ts', import.meta.url));
  const mapModule = compile('src/modules/mission-control/ExplorationMap.tsx', (id) => {
    if (id === './useExplorationDialog') return { useExplorationDialog() {} };
    if (id === 'lucide-react') return { X: 'X' };
    if (id === '@/modules/outpost-3d/worldRegions') return world;
    throw new Error(`Unexpected map import ${id}`);
  });
  const picked = [];
  const mapTree = mapModule.ExplorationMap({ isOpen: true, playerPos: [0, -0.4, 0], activeRegionId: 'home', activeWaypointRegionId: 'dust', onSetWaypoint: (id) => picked.push(id), onClose() {} });
  const resolveMapElement = (node) => {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(resolveMapElement);
    if (typeof node.type === 'function') return resolveMapElement(node.type(node.props));
    return { ...node, props: { ...node.props, children: resolveMapElement(node.props?.children) } };
  };
  const nodes = flatten(resolveMapElement(mapTree));
  const iceMarkers = nodes.filter((node) => node.type === 'button' && node.props?.['aria-label']?.startsWith('Sheltered Ice Shelf'));
  assert.ok(iceMarkers.length >= 1);
  const waypointButtons = nodes.filter((node) => node.type === 'button' && node.props?.['aria-pressed'] !== undefined);
  const dust = waypointButtons.find((node) => node.props['aria-pressed'] === true);
  assert.ok(dust, 'one region is selected as the navigation waypoint');
  const listChoice = nodes.find((node) => node.type === 'button' && node.props?.onClick && JSON.stringify(node.props.children).includes('Sheltered Ice Shelf'));
  listChoice?.props.onClick();
  assert.deepEqual(picked, ['ice']);
  const props = readFileSync(resolve(root, 'src/modules/mission-control/ExplorationMap.tsx'), 'utf8');
  assert.doesNotMatch(props, /setPlayerPos|setRoverPos|teleport/i);
});

test('mission overlay omits cockpit clutter and legacy field-tool entry', () => {
  const source = readFileSync(resolve(root, 'src/modules/mission-control/MissionControlOverlay.tsx'), 'utf8');
  assert.doesNotMatch(source, /CockpitVisorHUD|HorizontalDatapadHUD|CockpitDrivingDeck|MissionCommsBriefing|desktop-controls-pill/);
  const guide = readFileSync(resolve(root, 'src/modules/story-engine/components/FieldGuideModal.tsx'), 'utf8');
  assert.doesNotMatch(guide, /field-tools|Field Tools|ImpactFieldTools/);
});

test('minimap keeps north-up and rotates only a smooth player pointer across wrap', async () => {
  const world = await minimapDeps().then((loaded) => loaded.loadTsModule('../../src/modules/outpost-3d/worldRegions.ts', import.meta.url));
  const source = readFileSync(resolve(root, 'src/modules/story-engine/components/MinimapRadar.tsx'), 'utf8');
  assert.match(source, /data-testid="minimap-player-arrow"/);
  assert.match(source, /Math\.atan2\(Math\.sin\(cameraYaw - previousYaw\.current\), Math\.cos\(cameraYaw - previousYaw\.current\)\)/);
  assert.match(source, /transition-transform duration-100 ease-out/);
  assert.match(source, /x: \(dx \/ distance\) \* ratio/);
  assert.match(source, /y: \(dz \/ distance\) \* ratio/);
  assert.match(source, /ZOOM_SCALES = \[25, 50, 80, 300, 450\]/);
  assert.match(source, /exploration\.completedRegions/);
  assert.doesNotMatch(source, /useStoryStore|expeditionProgress/);
  assert.doesNotMatch(source, /angle - cameraYaw/);
  assert.equal(world.WORLD_REGIONS.length, 5);
});
