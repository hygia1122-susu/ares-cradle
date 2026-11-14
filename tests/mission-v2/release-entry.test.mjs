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
const game = { name: 'MissionGame' };
const suspense = { name: 'Suspense' };
const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
React.lazy = factory => ({ factory });
React.Suspense = suspense;
React.default = React;
const module = { exports: {} };
const windowMock = { location: { search: '' } };
vm.runInNewContext(compiled, {
  module, exports: module.exports,
  require(name) {
    if (name === 'react') return React;
    if (name.includes('MarsCanvas')) return { __esModule: true, default: legacy };
    if (name.includes('MissionControlOverlay')) return { __esModule: true, default: overlay };
    if (name.includes('jsx-runtime')) throw new Error('Unexpected automatic JSX runtime');
    throw new Error(`Unexpected import ${name}`);
  },
  window: windowMock,
  URLSearchParams,
});
const App = module.exports.App;
function render(search) {
  windowMock.location.search = search;
  return App();
}
function selected(root) {
  if (root.type === 'main') return 'legacy';
  const lazyType = root.children[0].type;
  return lazyType.factory.toString().includes('./game/mission/MissionGame') ? 'mission' : 'review';
}

test('release entry defaults to original Mars HUD, keeps rover review priority, and opts into Frontiers explicitly', () => {
  assert.equal(selected(render('')), 'legacy');
  assert.equal(selected(render('?unknown=1')), 'legacy');
  assert.equal(selected(render('?legacy=1')), 'legacy');
  assert.equal(selected(render('?mission=frontiers')), 'mission');
  assert.equal(selected(render('?review=rover')), 'review');
  assert.equal(selected(render('?review=rover&legacy=1')), 'review');
  assert.equal(selected(render('?review=rover&mission=frontiers')), 'review');
  assert.equal(selected(render('?mission=frontiers&legacy=1')), 'legacy');
});
