/* global ExtensionCommon */
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
var folderControls = class extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    const { ExtensionSupport } = ChromeUtils.importESModule("resource:///modules/ExtensionSupport.sys.mjs");
    const listenerId = context.extension.id + "-headers";
    const buttons = new Set();
    const monitors = new Map();
    function watch(window) {
      const document = window.document;
      const anchor = document.getElementById("button-appmenu");
      if (!anchor || document.getElementById("folder-controls-expand")) return;
      const localButtons = [];
      for (const expanded of [true, false]) {
        const button = document.createElementNS("http://www.w3.org/1999/xhtml", "button");
        button.id = "folder-controls-" + (expanded ? "expand" : "collapse");
        button.className = "button toolbar-button";
        button.setAttribute("type", "button");
        button.style.cssText = "min-width:28px;width:28px;height:28px;padding:4px;flex:none;";
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
        button.addEventListener("click", () => {
          try {
            const tabmail = document.getElementById("tabmail");
            if (tabmail.currentTabInfo?.mode?.name !== "mail3PaneTab") throw new Error("Select a mail tab first");
            setExpanded(tabmail.currentAbout3Pane?.document.getElementById("folderTree"), expanded);
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
          const visible = tab?.mode?.name === "mail3PaneTab";
          for (const button of localButtons) {
            button.hidden = !visible;
            button.style.display = visible ? "" : "none";
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
        entry?.tabmail.unregisterTabMonitor(entry.monitor);
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
        if (tab.nativeTab.mode?.name !== 'mail3PaneTab') {
          throw new Error('Select a mail tab first');
        }
        const pane = tab.nativeTab.chromeBrowser?.contentWindow;
        return setExpanded(pane?.document.getElementById('folderTree'), expanded);
      }
    } };
  }
};
