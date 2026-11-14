import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../../src/App.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React },
}).outputText;
const legacy = { name: 'MarsCanvas' };
const overlay = { name: 'MissionControlOverlay' };
const rover = { name: 'RoverReview' };
const suspense = { name: 'Suspense' };
const loadedModules = [];
const invokedLazyFactories = [];
const React = {
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  lazy: factory => ({ lazyFactory: factory }),
};
React.Suspense = suspense;
React.default = React;
const module = { exports: {} };
const windowMock = { location: { search: '' } };
vm.runInNewContext(compiled, {
  module, exports: module.exports,
  require(name) {
    loadedModules.push(name);
    if (name === 'react') return React;
    if (name.includes('MarsCanvas')) return { __esModule: true, default: legacy };
    if (name.includes('MissionControlOverlay')) return { __esModule: true, default: overlay };
    if (name.includes('RoverReview')) return { __esModule: true, default: rover };
    if (name.includes('MissionGame')) return { __esModule: true, default: { name: 'MissionGame' } };
    if (name.includes('jsx-runtime')) throw new Error('Unexpected automatic JSX runtime');
    throw new Error(`Unexpected import ${name}`);
  },
  window: windowMock,
  URLSearchParams,
});
const App = module.exports.App;
async function render(search) {
  windowMock.location.search = search;
  const root = App();
  const lazyElements = [];
  function collect(element) {
    if (!element || typeof element !== 'object') return;
    if (element.type?.lazyFactory) lazyElements.push(element.type);
    for (const child of element.children ?? []) collect(child);
  }
  collect(root);
  for (const elementType of lazyElements) {
    invokedLazyFactories.push(elementType.lazyFactory);
    await elementType.lazyFactory();
  }
  return root;
}

function isMarsHud(root) {
  return root.type === 'main' && root.children[0].type === legacy && root.children[1].type === overlay;
}

test('release entry keeps the Mars HUD for default, unknown, legacy, and Frontiers queries', async () => {
  assert.equal(isMarsHud(await render('')), true);
  assert.equal(isMarsHud(await render('?unknown=1')), true);
  assert.equal(isMarsHud(await render('?legacy=1')), true);
  assert.equal(isMarsHud(await render('?mission=frontiers')), true);
  assert.equal(isMarsHud(await render('?mission=frontiers&legacy=1')), true);
  assert.equal(loadedModules.some(name => name.includes('MissionGame')), false);
  assert.equal(invokedLazyFactories.length, 0);
});

test('rover review retains priority and remains the only lazy game entry', async () => {
  const root = await render('?review=rover&mission=frontiers');
  assert.equal(root.type, suspense);
  assert.equal(root.props.fallback.props.role, 'status');
  assert.deepEqual(loadedModules.filter(name => name.includes('RoverReview')), ['./game/review/RoverReview']);
  assert.equal(loadedModules.some(name => name.includes('MissionGame')), false);
  assert.equal(invokedLazyFactories.length, 1);
});
