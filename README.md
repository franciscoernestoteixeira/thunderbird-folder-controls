# Folder Expand/Collapse All

Extension for Thunderbird 157–162: **Expand All** and **Collapse All** in the top toolbar (immediately before the application menu) and folder context menu. Commands can also be assigned shortcuts through Thunderbird's add-on shortcut manager; none are reserved by default.

## Install

Build with `python3 scripts/package.py`, then open Add-ons Manager → gear → Install Add-on From File and select `dist/thunderbird-folder-controls-0.1.6.xpi`. Alternatively, use Debug Add-ons → Load Temporary Add-on and select `extension/manifest.json` for development.

This extension uses a privileged Experiment API and Thunderbird will request full access. Its code only changes folder-tree UI state; it contains no network requests or message/folder modification calls. Collapsing a selected descendant can promote the selection to its ancestor, as Thunderbird's native collapse operation does. Native expanded-state persistence is used.

The toolbar buttons are ⊞ (Expand All) and ⊟ (Collapse All), with tooltips and accessible labels. Right-click a folder for the context-menu commands. In All Folders mode the commands cover every displayed account, Local Folders and nested folders, including descendants hidden beneath collapsed ancestors. Other modes only expose their own rows: filtered, hidden, unsubscribed or disabled accounts are not enumerated and the extension does not change your view mode. The operation affects the current mail tab, not every open tab/window.

## Technical feasibility

Reviewed the public mailTabs and menus documentation and the source bundled in the actual installed Thunderbird 157.0.1 (`omni.ja`). Public mailTabs exposes view/selection operations but no expand/collapse-all API. menus supports `folder_pane` context. Consequently a small parent Experiment API bridges to `tab.nativeTab.chromeBrowser.contentWindow` and the native `folderTree.expandRow` / `collapseRow` methods. These methods emit native events that update counts and FolderTreeProperties persistence. Descendants are collapsed before their parents; expansion follows document order. There are runtime checks for non-mail tabs and missing methods. Window listeners attach toolbar buttons to existing and new mail windows and remove them on extension unload. Toolbar actions resolve the active mail tab at click time.

Internal APIs may change. Experiment APIs require an explicit maximum version, which is why each Thunderbird major release previously disabled the add-on. Version 0.1.6 sets `strict_max_version` to `162.*` (minimum `157.0` and the extension ID preserved), so routine monthly releases no longer disable it, and widens the margin for review instead of forcing a rebuild on every bump. Each internal hook is now resolved through a single checked path: a missing hook raises a message naming it (for example, folderTree ausente) instead of a generic or silent failure, and the add-on exposes a read-only `diagnose()` that reports the state of every hook. After each update, run the contract probe (below) to confirm, in one step, that the internal contract survived or to see exactly which hook changed. See VALIDATION.md for exact scope.

To update a disabled installation, install the new XPI through Add-ons Manager → gear → Install Add-on From File, approve the full-access permission, and enable the add-on if needed. This build has only been installed in a disposable test profile by automation; install it in your normal profile yourself.

Primary references:
- https://webextension-api.thunderbird.net/en/latest/mailTabs.html
- https://webextension-api.thunderbird.net/en/latest/menus.html
- https://developer.thunderbird.net/add-ons/mailextensions/experiments
- Installed source: `about3Pane.js`, `about3Pane.xhtml`, `folder-tree-row.mjs`, `tree-listbox-mixin.mjs`, `parent/ext-mailTabs.js`.

## Test and package

Requirements: Node.js 18+ and Python 3.9+; no dependencies to install.

```
node --test tests/*.test.cjs
python3 scripts/package.py
python3 -m unittest discover -s tests -p "test_*.py"
```

### After a Thunderbird update (runbook)

1. Run the read-only contract probe against a disposable profile (see VALIDATION.md for the launch line):
   `python3 tests/contract-probe.py --profile <absolute-disposable-profile>`
2. If every hook is PASS: bump `strict_max_version` in `extension/manifest.json` to cover the new version, bump `version`, rebuild, and reinstall the XPI. No code change is required.
3. If a hook is FAIL: fix only the matching access point in `extension/experiments/implementation.js` (each is isolated and named), then repeat from step 1.

Packaging uses an explicit four-file allowlist and fixed timestamps, excluding profiles, tests, credentials and development files.

See [VALIDATION.md](VALIDATION.md) for actual results and the remaining manual checks. MIT license.

Toolbar controls are visible only when the active tab is the main mail (3-pane) tab; switching to Settings, Add-ons, Calendar or other tabs hides them.
