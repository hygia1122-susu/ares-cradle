import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import { loadTsModule } from '../mission-v2/support/load-ts-module.mjs';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const world = await loadTsModule('../../src/modules/outpost-3d/worldRegions.ts', import.meta.url);
const catalog = await loadTsModule('../../src/modules/outpost-3d/scienceCatalog.ts', import.meta.url);
const { ADDITIVE_OUTER_COLLIDERS, WORLD_REGIONS, sampleWorldGround } = world;
const { SCIENTIFIC_ELEMENTS } = catalog;
const source = (path) => readFileSync(resolve(root, path), 'utf8');
const transpile = (path) => ts.transpileModule(source(path), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React,
} }).outputText;
const element = (type, props, ...children) => ({ type, props: { ...props, children: children.length ? children.length === 1 ? children[0] : children : props?.children } });
const flatten = (node, output = []) => {
  if (Array.isArray(node)) node.forEach((child) => flatten(child, output));
  else if (node && typeof node === 'object' && node.type) { output.push(node); flatten(node.props?.children, output); }
  return output;
};

let renderState;
let frameCallbacks;
const ReactStub = {
  Fragment: Symbol('React.Fragment'),
  createElement: element,
  useRef: (current) => ({ current }),
  useCallback: (callback) => callback,
  useMemo: (callback) => callback(),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: (callback) => { callback(); },
};
const jsxRuntime = { jsx: (type, props) => element(type, props), jsxs: (type, props) => element(type, props), Fragment: ReactStub.Fragment };
const storeHook = (selector) => selector(renderState);
storeHook.getState = () => renderState;
storeHook.subscribe = () => () => {};
const compile = (path, imports) => {
  const module = { exports: {} };
  const output = transpile(path);
  const req = (id) => {
    if (Object.hasOwn(imports, id)) return imports[id];
    throw new Error(`Unexpected import ${id} from ${path}`);
  };
  new Function('require', 'module', 'exports', output)(req, module, module.exports);
  return module.exports;
};

let ScientificElements;
const renderedSites = () => {
  renderState = { exploration: { collected: [] }, isDrivingRover: false, remoteRegionId: null, playerPos: [0, -0.4, 0], roverPos: [0, -0.4, 0], isPlayerGrounded: true, isBackpackOpen: false, isManualOpen: false, activeScienceEntryId: null };
  frameCallbacks = [];
  const fiber = { useFrame: (callback) => frameCallbacks.push(callback) };
  if (!ScientificElements) ScientificElements = compile('src/modules/outpost-3d/ScientificElements.tsx', {
    react: { __esModule: true, default: ReactStub, ...ReactStub },
    'react/jsx-runtime': jsxRuntime,
    '@react-three/fiber': fiber,
    '@/modules/store/useOutpostStore': { useOutpostStore: storeHook },
    './scienceCatalog': catalog,
    './worldRegions': world,
  }).ScientificElements;
  const expand = (node) => {
    if (Array.isArray(node)) return node.map(expand);
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') return expand(node.type(node.props));
    return { ...node, props: { ...node.props, children: expand(node.props?.children) } };
  };
  return expand(ScientificElements());
};

test('renders exactly 15 recognizable science features at each canonical sampled anchor', () => {
  assert.equal(SCIENTIFIC_ELEMENTS.length, 15);
  const tree = renderedSites();
  const sites = flatten(tree).filter((node) => node.type === 'group' && node.props.name?.startsWith('scientific-element-'));
  assert.equal(sites.length, 15);
  const byId = new Map(SCIENTIFIC_ELEMENTS.map((entry) => [entry.id, entry]));
  const distinctiveFeatureNames = new Set([
    'impact-shocked-outcrop', 'crater-rim', 'ejecta-lobes', 'dust-devil-column', 'dust-deposit-patches',
    'wind-streak-ridges', 'stacked-basalt-lavas', 'inclined-rock-strata', 'lava-channel-and-levees',
    'pale-ice-exposure', 'radar-profile-instrument', 'seasonal-frost-patches', 'branching-dry-delta',
    'eroded-cross-bedded-sediment', 'sealed-sample-tubes',
  ]);
  for (const site of sites) {
    const id = site.props.name.slice('scientific-element-'.length);
    const entry = byId.get(id);
    assert.ok(entry, `rendered unknown element ${id}`);
    const region = WORLD_REGIONS.find(({ id: regionId }) => regionId === entry.regionId);
    assert.deepEqual([site.props.position[0], site.props.position[2]], [region.discoveries[Number(id.slice(-1)) - 1].x, region.discoveries[Number(id.slice(-1)) - 1].z]);
    assert.equal(site.props.position[1], sampleWorldGround(entry.position.x, entry.position.z), `${id} uses sampled surface Y`);
    assert.ok(Math.hypot(entry.position.x, entry.position.z) > 210, `${id} stays outside preserved home region`);
    assert.ok(ADDITIVE_OUTER_COLLIDERS.some((collider) => collider.kind === 'discovery' && collider.regionId === entry.regionId && collider.x === entry.position.x && collider.z === entry.position.z && collider.radius === 2.5), `${id} is inside a 2.5m discovery footprint`);
    const names = flatten(site).map((node) => node.props?.name).filter(Boolean);
    assert.ok(names.some((name) => distinctiveFeatureNames.has(name)), `${id} must have an authored physical signal`);
    assert.ok(names.includes('inspect-range-hint'), `${id} keeps an inspect plaque/ring anchor`);
  }
  const sourceText = source('src/modules/outpost-3d/ScientificElements.tsx');
  assert.match(sourceText, /ringGeometry args=\{\[0\.92, 1\.02/);
  assert.match(sourceText, /visible=\{false\}/, 'inspect hint starts hidden, not a permanent glow');
  assert.match(sourceText, /name="recorded-field-tag"/, 'recorded science leaves a physical marker, not a removed feature');
});

let keyboardHandler;
let promptModule;
let latestTree;
class ElementStub { closest(selector) { return selector.includes('input') && this.input ? this : selector.includes('[role="dialog"]') && this.dialog ? this : null; } }
const windowStub = { addEventListener(type, handler) { if (type === 'keydown') keyboardHandler = handler; }, removeEventListener(type, handler) { if (type === 'keydown' && keyboardHandler === handler) keyboardHandler = null; } };
const documentStub = { body: {}, querySelector(selector) { return selector === '[role="dialog"]' && this.dialog ? {} : null; }, dialog: false };
const resetPrompt = (patch = {}) => {
  renderState = {
    playerPos: [0, -0.4, 0], roverPos: [0, -0.4, 0], isPlayerGrounded: true, isDrivingRover: false, remoteRegionId: null,
    isBackpackOpen: false, isManualOpen: false, isDatapadOpen: false, isClassroomOpen: false, isBrownoutQuizOpen: false,
    exploration: { collected: [] }, activeScienceEntryId: null, inspected: [], toggleCalls: 0,
    inspectScientificElement: (id) => { renderState.inspected.push(id); return true; },
    openScienceEntry: (id) => { renderState.activeScienceEntryId = id; }, toggleDrivingRover: () => { renderState.toggleCalls++; },
    ...patch,
  };
  keyboardHandler = null; documentStub.dialog = false;
  const ReactDOM = { createPortal: (node) => node };
  const codex = { __esModule: true, default: (props) => element('science-codex', props) };
  if (!promptModule) promptModule = compile('src/modules/mission-control/ScientificInteractionPrompt.tsx', {
    react: { __esModule: true, default: ReactStub, ...ReactStub },
    'react/jsx-runtime': jsxRuntime,
    'react-dom': ReactDOM,
    './ScienceCodex': codex,
    '@/modules/outpost-3d/scienceCatalog': catalog,
    '@/modules/outpost-3d/worldRegions': world,
    '@/modules/store/useOutpostStore': { useOutpostStore: storeHook },
  });
  latestTree = promptModule.ScientificInteractionPrompt();
  return flatten(latestTree);
};
const keyEvent = (patch = {}) => ({ code: 'KeyF', repeat: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: null, prevented: false, preventDefault() { this.prevented = true; }, ...patch });

// Element checks run in a VM-like harness without browser or renderer startup.
globalThis.Element = ElementStub;
globalThis.window = windowStub;
globalThis.document = documentStub;

test('nearest field eligibility is 4.5m, grounded, and scoped to remote sector', () => {
  const { nearestScientificElement, SCIENCE_INTERACTION_RANGE } = (() => {
    const imports = {
      react: { __esModule: true, default: ReactStub, ...ReactStub },
      'react/jsx-runtime': jsxRuntime,
      'react-dom': { createPortal: (node) => node },
      './ScienceCodex': { __esModule: true, default: () => null },
      '@/modules/outpost-3d/scienceCatalog': catalog,
      '@/modules/outpost-3d/worldRegions': world,
      '@/modules/store/useOutpostStore': { useOutpostStore: storeHook },
    };
    return compile('src/modules/mission-control/ScientificInteractionPrompt.tsx', imports);
  })();
  const element = SCIENTIFIC_ELEMENTS.find(({ id }) => id === 'ice.science-1');
  assert.equal(SCIENCE_INTERACTION_RANGE, 4.5);
  const p = [element.position.x, sampleWorldGround(element.position.x, element.position.z), element.position.z];
  assert.equal(nearestScientificElement([element], [p[0] + 4.5, p[1], p[2]], { isRemote: false, remoteRegionId: null, grounded: true })?.id, element.id);
  assert.equal(nearestScientificElement([element], [p[0] + 4.5001, p[1], p[2]], { isRemote: false, remoteRegionId: null, grounded: true }), null);
  assert.equal(nearestScientificElement([element], p, { isRemote: false, remoteRegionId: null, grounded: false }), null);
  assert.equal(nearestScientificElement([element], p, { isRemote: true, remoteRegionId: 'impact', grounded: true }), null);
  assert.equal(nearestScientificElement([element], p, { isRemote: true, remoteRegionId: 'ice', grounded: true })?.id, element.id);
});

test('F inspects a live nearby target once and ignores repeat, typing, dialogs, and airborne poses', () => {
  const element = SCIENTIFIC_ELEMENTS.find(({ id }) => id === 'impact.science-1');
  const position = [element.position.x, sampleWorldGround(element.position.x, element.position.z), element.position.z];
  resetPrompt({ playerPos: position });
  assert.equal(typeof keyboardHandler, 'function');
  const valid = keyEvent(); keyboardHandler(valid);
  assert.equal(valid.prevented, true);
  assert.deepEqual(renderState.inspected, [element.id]);
  const repeat = keyEvent({ repeat: true }); keyboardHandler(repeat);
  const input = Object.assign(new ElementStub(), { input: true });
  keyboardHandler(keyEvent({ target: input }));
  documentStub.dialog = true; keyboardHandler(keyEvent()); documentStub.dialog = false;
  assert.equal(renderState.inspected.length, 1);
  resetPrompt({ playerPos: position, isPlayerGrounded: false });
  keyboardHandler(keyEvent());
  assert.deepEqual(renderState.inspected, []);
  resetPrompt({ playerPos: position, isManualOpen: true });
  keyboardHandler(keyEvent());
  assert.deepEqual(renderState.inspected, [], 'manual overlay blocks field input');
});

test('prompt button invokes the store action once; regional console remains a separate R button', () => {
  const entry = SCIENTIFIC_ELEMENTS.find(({ id }) => id === 'impact.science-1');
  const position = [entry.position.x, sampleWorldGround(entry.position.x, entry.position.z), entry.position.z];
  const nodes = resetPrompt({ playerPos: position });
  const prompt = nodes.find((node) => node.props?.['data-testid'] === 'scientific-interaction-prompt');
  assert.ok(prompt, `prompt missing; nodes: ${nodes.map((node) => String(node.type)).join(',')}`);
  const button = flatten(prompt).find((node) => node.type === 'button');
  button.props.onClick();
  assert.deepEqual(renderState.inspected, [entry.id]);
  assert.equal(renderState.toggleCalls, 0);

  const consolePoint = WORLD_REGIONS.find(({ id }) => id === 'ice').baseConsole;
  const consoleNodes = resetPrompt({ playerPos: [consolePoint.x, sampleWorldGround(consolePoint.x, consolePoint.z), consolePoint.z] });
  const consoleButton = flatten(consoleNodes.find((node) => node.props['data-testid'] === 'scientific-interaction-prompt')).find((node) => node.type === 'button');
  assert.match(JSON.stringify(consoleButton.props.children), /regional scout/);
  consoleButton.props.onClick();
  assert.equal(renderState.toggleCalls, 1);
  assert.deepEqual(renderState.inspected, []);
});
