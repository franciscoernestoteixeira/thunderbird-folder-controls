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
test('experiment resolves the native mail tab tree and reports changed rows', async () => {
  const tree = fixture([true, true, false]);
  let closed;
  sandbox.ChromeUtils = {importESModule: () => ({ExtensionSupport:{registerWindowListener(){}, unregisterWindowListener(){}}})};
  const api = new sandbox.folderControls().getAPI({callOnClose(value){closed=value;}, extension:{id:'test',tabManager:{get:id=>{
    assert.equal(id,42);
    return {nativeTab:{mode:{name:'mail3PaneTab'},chromeBrowser:{contentWindow:{document:{getElementById:id=>{assert.equal(id,'folderTree');return tree;}}}}}};
  }}}});
  assert.equal(await api.folderControls.setExpanded(42,true),2);
  assert.equal(await api.folderControls.setExpanded(42,true),0);
  assert.equal(await api.folderControls.setExpanded(42,false),3);
  closed.close();
});
test('experiment rejects missing native pane methods', async () => {
  const api = new sandbox.folderControls().getAPI({callOnClose(){},extension:{id:'test',tabManager:{get:()=>({nativeTab:{mode:{name:'mail3PaneTab'}}})}}});
  await assert.rejects(api.folderControls.setExpanded(42,true),/Unsupported Thunderbird folder tree/);
});
test('release retains extension identity and declares Thunderbird 158 compatibility', () => {
  const manifest=JSON.parse(fs.readFileSync('extension/manifest.json','utf8'));
  assert.equal(manifest.browser_specific_settings.gecko.id,'folder-controls@franciscoernestoteixeira.github.io');
  assert.equal(manifest.browser_specific_settings.gecko.strict_max_version,'158.*');
  assert.equal(manifest.browser_specific_settings.gecko.strict_min_version,'157.0');
  assert.ok(manifest.experiment_apis.folderControls);
});
