/* global ExtensionCommon, ChromeUtils, Services */
// Kept as a plain function so the exact production traversal can be unit tested.
function setExpanded(tree, expanded) {
  if (!tree || typeof tree.expandRow !== 'function' || typeof tree.collapseRow !== 'function') {
    throw new Error('Unsupported Thunderbird folder tree');
  }
  const rows = [...tree.querySelectorAll('li[is="folder-tree-row"].children')];
  if (!expanded) rows.reverse(); // Descendants before parents, including hidden rows.
  let changed = 0;
  for (const row of rows) {
    if (row.classList.contains('collapsed') === expanded) {
      tree[expanded ? 'expandRow' : 'collapseRow'](row);
      changed++;
    }
  }
  return changed;
}

// Single source of truth for every internal Thunderbird hook this add-on uses.
// inspect() checks each one so that a future Thunderbird change is reported by
// the exact hook name (diagnose / contract probe) instead of a silent break.
// Window-level hooks exist on any messenger window. Pane-level hooks only exist
// while a mail (3-pane) tab is active; they are null, not failed, on other tabs.
const WINDOW_HOOKS = ['toolbarAnchor', 'tabmail', 'registerTabMonitor'];
const PANE_HOOKS = ['about3Pane', 'folderTree', 'expandRow', 'collapseRow', 'rowSelector'];
function inspect(window) {
  const checks = {};
  const document = window && window.document;
  const anchor = document && document.getElementById('button-appmenu');
  checks.toolbarAnchor = !!anchor;
  const tabmail = document && document.getElementById('tabmail');
  checks.tabmail = !!tabmail;
  checks.registerTabMonitor = typeof (tabmail && tabmail.registerTabMonitor) === 'function';
  const pane = tabmail && tabmail.currentAbout3Pane;
  checks.about3Pane = !!pane;
  const tree = pane && pane.document.getElementById('folderTree');
  checks.folderTree = !!tree;
  checks.expandRow = typeof (tree && tree.expandRow) === 'function';
  checks.collapseRow = typeof (tree && tree.collapseRow) === 'function';
  let rowSelector = false;
  if (tree) {
    try { tree.querySelectorAll('li[is="folder-tree-row"].children'); rowSelector = true; } catch (e) { rowSelector = false; }
  }
  checks.rowSelector = rowSelector;
  return checks;
}

// Resolve the folder tree of a messenger window, failing with the exact missing
// hook so breakage after a Thunderbird update is self-describing.
function resolveTree(document) {
  const tabmail = document.getElementById('tabmail');
  if (!tabmail) throw new Error('Thunderbird mudou: elemento tabmail ausente');
  if (tabmail.currentTabInfo && tabmail.currentTabInfo.mode && tabmail.currentTabInfo.mode.name !== 'mail3PaneTab') {
    throw new Error('Select a mail tab first');
  }
  const pane = tabmail.currentAbout3Pane;
  if (!pane) throw new Error('Thunderbird mudou: about3Pane ausente');
  const tree = pane.document.getElementById('folderTree');
  if (!tree) throw new Error('Thunderbird mudou: elemento folderTree ausente');
  return tree;
}

var folderControls = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    const { ExtensionSupport } = ChromeUtils.importESModule("resource:///modules/ExtensionSupport.sys.mjs");
    const listenerId = context.extension.id + "-headers";
    const buttons = new Set();
    const monitors = new Map();
    function watch(window) {
      const document = window.document;
      const anchor = document.getElementById("button-appmenu");
      if (!anchor) {
        // Toolbar anchor changed: surface it instead of disappearing silently.
        console.error("Folder Expand/Collapse All: Thunderbird mudou, âncora button-appmenu ausente");
        return;
      }
      if (document.getElementById("folder-controls-expand")) return;
      const localButtons = [];
      for (const expanded of [true, false]) {
        const button = document.createElementNS("http://www.w3.org/1999/xhtml", "button");
        button.id = "folder-controls-" + (expanded ? "expand" : "collapse");
        button.className = "button toolbar-button";
        button.setAttribute("type", "button");
        button.style.cssText = "min-width:28px;width:auto;height:28px;padding:4px 8px;flex:none;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;";
        button.title = expanded ? "Expand All Folders" : "Collapse All Folders";
        button.setAttribute("aria-label", button.title);
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 16 16");
        svg.setAttribute("width", "16"); svg.setAttribute("height", "16");
        svg.setAttribute("aria-hidden", "true");
        const path = document.createElementNS(svg.namespaceURI, "path");
        path.setAttribute("d", "M2.5 2.5h11v11h-11z M5 8h6" + (expanded ? " M8 5v6" : ""));
        path.setAttribute("fill", "none"); path.setAttribute("stroke", "currentColor");
        path.setAttribute("stroke-width", "1.4");
        svg.append(path); button.append(svg);
        const label = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
        label.textContent = expanded ? "Expand All" : "Collapse All";
        button.append(label);
        button.addEventListener("click", () => {
          try {
            setExpanded(resolveTree(document), expanded);
          } catch (error) { window.alert(error.message); }
        });
        anchor.before(button);
        buttons.add(button);
        localButtons.push(button);
      }
      const tabmail = document.getElementById("tabmail");
      const monitor = {
        monitorName: listenerId,
        onTabSwitched(tab) {
          const visible = tab && tab.mode && tab.mode.name === "mail3PaneTab";
          for (const button of localButtons) {
            button.hidden = !visible;
            button.style.display = visible ? "inline-flex" : "none";
          }
        },
        onTabTitleChanged() {}, onTabOpened() {}, onTabClosing() {},
        onTabPersist() { return null; }, onTabRestored() {}
      };
      monitors.set(window, { tabmail, monitor });
      tabmail.registerTabMonitor(monitor);
    }
    ExtensionSupport.registerWindowListener(listenerId, {
      chromeURLs: ["chrome://messenger/content/messenger.xhtml"],
      onLoadWindow: watch,
      onUnloadWindow(window) {
        const entry = monitors.get(window);
        if (entry) entry.tabmail.unregisterTabMonitor(entry.monitor);
        monitors.delete(window);
        for (const button of buttons) if (button.ownerDocument === window.document) buttons.delete(button);
      }
    });
    context.callOnClose({ close() {
      ExtensionSupport.unregisterWindowListener(listenerId);
      for (const { tabmail, monitor } of monitors.values()) tabmail.unregisterTabMonitor(monitor);
      monitors.clear();
      for (const button of buttons) button.remove();
      buttons.clear();
    } });
    return { folderControls: {
      async initialize() {},
      async setExpanded(tabId, expanded) {
        const tab = context.extension.tabManager.get(tabId);
        if (tab.nativeTab.mode && tab.nativeTab.mode.name !== 'mail3PaneTab') {
          throw new Error('Select a mail tab first');
        }
        const win = tab.nativeTab.chromeBrowser && tab.nativeTab.chromeBrowser.contentWindow;
        if (!win) throw new Error('Thunderbird mudou: chromeBrowser.contentWindow ausente');
        return setExpanded(win.document.getElementById('folderTree'), expanded);
      },
      // Read-only contract report. Used by the post-update probe and available to
      // the background page. Names every internal hook that is currently broken.
      async diagnose() {
        const window = Services.wm.getMostRecentWindow('mail:3pane');
        const checks = inspect(window);
        const missing = Object.keys(checks).filter(name => checks[name] === false);
        return {
          version: Services.appinfo.version,
          platform: Services.appinfo.platformVersion,
          windowHooks: WINDOW_HOOKS,
          paneHooks: PANE_HOOKS,
          checks,
          missing
        };
      }
    } };
  }
};
