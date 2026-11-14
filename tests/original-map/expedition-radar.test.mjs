import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import { loadTsModule } from '../../tests/mission-v2/support/load-ts-module.mjs';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const world = await loadTsModule('../../src/modules/outpost-3d/worldRegions.ts', import.meta.url);
let outpost;
let hookValues = [];
let hookIndex = 0;
const React = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.length ? children.length === 1 ? children[0] : children : props?.children } }),
  useRef: (initial) => { const index = hookIndex++; if (!(index in hookValues)) hookValues[index] = { current: initial }; return hookValues[index]; },
  useState: (initial) => {
    const index = hookIndex++;
    if (!(index in hookValues)) hookValues[index] = initial;
    return [hookValues[index], (update) => { hookValues[index] = typeof update === 'function' ? update(hookValues[index]) : update; }];
  },
};
const compile = (path, localRequire) => {
  const source = require('node:fs').readFileSync(path, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
};
const radarModule = compile(resolve(root, 'src/modules/story-engine/components/MinimapRadar.tsx'), (id) => {
  if (id === 'react') return { ...React, default: React };
  if (id === 'lucide-react') return { House: 'House', ZoomIn: 'ZoomIn', ZoomOut: 'ZoomOut' };
  if (id === '@/modules/store/useOutpostStore') return { useOutpostStore: (select) => select(outpost) };
  if (id === '@/modules/audio/soundEngine') return { soundEngine: { playClick() {} } };
  if (id === '@/modules/outpost-3d/worldRegions') return world;
  throw new Error(`Unexpected radar import: ${id}`);
});
const reset = (patch = {}) => {
  outpost = { playerPos: [0, -0.4, 0], isDrivingRover: false, roverPos: [0, -0.4, 0], cameraYaw: 0,
    activeWaypointRegionId: 'impact', exploration: { completedRegions: [] }, ...patch };
  hookValues = []; hookIndex = 0; hookValues[0] = 4;
};
const render = () => { hookIndex = 0; return radarModule.MinimapRadar(); };
const flatten = (node, result = []) => {
  if (!node || typeof node !== 'object') return result;
  if (Array.isArray(node)) { node.forEach((child) => flatten(child, result)); return result; }
  result.push(node); flatten(node.props?.children, result); return result;
};
const title = (node) => node.props?.title;
const resolveElements = (node) => {
  if (Array.isArray(node)) return node.map(resolveElements);
  if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') return resolveElements(node.type(node.props));
  return { ...node, props: { ...node.props, children: resolveElements(node.props?.children) } };
};
const visible = (tree) => flatten(resolveElements(tree));
const text = (value) => Array.isArray(value) ? value.map(text).join('') : value == null ? '' : String(value);
const translate = (node) => {
  const match = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(node.props.style.transform);
  assert.ok(match, 'marker has a projected position');
  return [Number(match[1]), Number(match[2])];
};

test('new radar always shows all five canonical regions and starts at 450m', () => {
  reset();
  const nodes = visible(render());
  const markers = nodes.filter((node) => world.WORLD_REGIONS.some(({ name }) => title(node)?.startsWith(name)));
  assert.equal(markers.length, 5);
  assert.ok(markers.some((node) => title(node).includes('waypoint')));
  assert.ok(nodes.some((node) => text(node.props.children) === '450M'));
  assert.doesNotMatch(require('node:fs').readFileSync(resolve(root, 'src/modules/story-engine/components/MinimapRadar.tsx'), 'utf8'), /useStoryStore|expeditionProgress|anchors/);
  for (const node of markers) assert.ok(Math.hypot(...translate(node)) <= 50.01);
});

test('radar zoom cycles through all fixed scales and only marks completedRegions', () => {
  reset({ exploration: { completedRegions: ['ice', 'lake'] }, activeWaypointRegionId: 'dust' });
  let nodes = visible(render());
  const dust = nodes.find((node) => title(node)?.startsWith('Wind-Swept Basin'));
  assert.ok(title(dust).includes('waypoint'));
  const ice = nodes.find((node) => title(node)?.startsWith('Sheltered Ice Shelf'));
  assert.ok(title(ice).includes('surveyed'));
  const zoomOut = nodes.find((node) => node.type === 'button' && node.props.title === 'Zoom Out');
  assert.equal(zoomOut.props.disabled, true);
  const zoomIn = nodes.find((node) => node.type === 'button' && node.props.title === 'Zoom In');
  zoomIn.props.onClick(); nodes = visible(render()); assert.ok(nodes.some((node) => text(node.props.children) === '300M'));
  nodes.find((node) => node.type === 'button' && node.props.title === 'Zoom In').props.onClick();
  nodes = visible(render()); assert.ok(nodes.some((node) => text(node.props.children) === '80M'));
  nodes.find((node) => node.type === 'button' && node.props.title === 'Zoom In').props.onClick();
  nodes = visible(render()); assert.ok(nodes.some((node) => text(node.props.children) === '50M'));
  nodes.find((node) => node.type === 'button' && node.props.title === 'Zoom In').props.onClick();
  nodes = visible(render()); assert.ok(nodes.some((node) => text(node.props.children) === '25M'));
});

test('north stays fixed and player arrow unwraps camera yaw through the right-facing wrap', () => {
  reset({ cameraYaw: Math.PI - 0.05 });
  let nodes = visible(render());
  let arrow = nodes.find((node) => node.props?.['data-testid'] === 'minimap-player-arrow');
  assert.equal(arrow.props.style.transform, `rotate(${-(Math.PI - 0.05) * 180 / Math.PI}deg)`);
  outpost.cameraYaw = -Math.PI + 0.05;
  nodes = visible(render());
  arrow = nodes.find((node) => node.props?.['data-testid'] === 'minimap-player-arrow');
  const angle = Number(/rotate\(([-\d.]+)deg\)/.exec(arrow.props.style.transform)[1]);
  assert.ok(Math.abs(angle + 182.865) < 0.02, `expected continuous clockwise sign, received ${angle}`);
  assert.ok(nodes.some((node) => node.props.children === 'N'));
});
