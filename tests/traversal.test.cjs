const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const sandbox = { ExtensionCommon: { ExtensionAPI: class {} } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('extension/experiments/implementation.js', 'utf8'), sandbox);
function fixture(states) {
  const calls = [];
  const rows = states.map((collapsed, id) => ({id, classList: {contains: () => collapsed}, set: v => collapsed = v}));
  return { calls, rows, querySelectorAll: selector => {
      assert.equal(selector, 'li[is="folder-tree-row"].children');
      return rows;
    },
    expandRow: r => { calls.push(r.id); r.set(false); },
    collapseRow: r => { calls.push(r.id); r.set(true); } };
}
test('expands hidden descendants in document order; repeated call is idempotent', () => {
  const tree = fixture([true, true, false, true]);
  assert.equal(sandbox.setExpanded(tree, true), 3);
  assert.deepEqual(tree.calls, [0, 1, 3]);
  assert.equal(sandbox.setExpanded(tree, true), 0);
});
test('collapses descendants before ancestors, across multiple roots', () => {
  const tree = fixture([false, false, true, false]);
  assert.equal(sandbox.setExpanded(tree, false), 3);
  assert.deepEqual(tree.calls, [3, 1, 0]);
  assert.equal(sandbox.setExpanded(tree, false), 0);
});
test('empty tree and unsupported tree', () => {
  assert.equal(sandbox.setExpanded(fixture([]), true), 0);
  assert.throws(() => sandbox.setExpanded(null, false), /Unsupported/);
});
test('experiment rejects non-mail tabs', async () => {
  sandbox.ChromeUtils = {importESModule: () => ({ExtensionSupport:{registerWindowListener(){}}})};
  const api = new sandbox.folderControls().getAPI({callOnClose(){}, extension:{tabManager:{get:()=>({nativeTab:{mode:{name:'calendar'}}})}}});
  await assert.rejects(api.folderControls.setExpanded(1,true), /mail tab/);
});
