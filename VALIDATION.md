# Validation — 2026-10-12

Tested application: Thunderbird 157.0.1, build 20261001134409, macOS Apple Silicon (aarch64-gcc3), platform 157.0. Tests used a separate disposable profile, never the normal email profile.

## Current version: passed

- Four automated Node tests pass. The production selector is asserted to exclude mode containers; traversal tests cover hidden descendants, multiple modeled roots, repeat/idempotence, empty trees, incompatible methods and non-mail tab rejection.
- Packaged XPI installed temporarily in the actual Thunderbird application.
- Two local test accounts, with nested folders to three levels, produced five actual expandable folder rows.
- Twenty expand/collapse cycles through the corrected header prototype succeeded. A further twenty cycles through the final toolbar buttons succeeded, with assertions on every actual branch row.
- Final toolbar buttons are visibly rendered, 28px wide. Measured left-to-right positions: Expand All x=1157, Collapse All x=1197, application menu x=1238. Screenshot captured and visually inspected. No header overflow in the final version.
- Folder context menu contains both extension commands. Dispatching their native command events changed every branch to the expected collapsed/expanded state.
- Prototype uninstall removed every injected button. Final toolbar implementation uses the same unload cleanup, but final-version uninstall has not been repeated because the user wants to inspect the icons.
- No native expansion/collapse TypeErrors in the retry logs. Platform GPU/sandbox warnings remain in the application log; no freeze observed during these bounded tests.
- The final temporary extension remains loaded in the isolated test window for the user to inspect. Temporary installations disappear at exit.

## Earlier failure and correction

The first broad li.children selector included mode container rows, causing TypeErrors in Thunderbird native event handlers (updateUnreadMessageCount is not a function). The user reported a freeze; causality is not established. Narrowed the selector to li[is="folder-tree-row"].children and reran the real-application tests above. Earlier assertions against the broad selector are invalid acceptance evidence. Initial header placement also overflowed a narrow pane and used reversed flex order; final buttons moved to the top toolbar before the application menu, matching the user's requested position.

The manifest minimum is 157.0: a minimum of 157.0.1 was rejected by the actual application/platform compatibility check. This does not establish compatibility with untested versions.

## Remaining limits

Not yet tested: real IMAP/offline accounts, very large trees, assigned keyboard shortcuts, unified/unread/favorite modes, new windows, final-version disable/re-enable, and restart persistence. Native collapse may promote selection from a descendant to its ancestor. No claim of compatibility with other builds or operating systems. This remains an experimental 0.1.0 preview.

## Reproduce

Run `node --test tests/*.test.cjs` and `python3 scripts/package.py`.
For integration tests, use only a disposable profile with two local accounts and nested folders. Launch Thunderbird with `-no-remote -profile <absolute-test-profile> --marionette --remote-allow-system-access` and marionette.port=2828. Run `python3 tests/thunderbird-live.py --profile <absolute-test-profile>`. The test checks the connected profile before installing or changing tree state. It leaves the temporary extension loaded for visual inspection. Never enable this test interface on your normal profile.

## 0.1.2 visibility check

In the real Thunderbird 157.0.1 disposable profile: mail tab buttons visible=true, preferences tab visible=false, switching back visible=true. Both titles verified as Expand All Folders and Collapse All Folders. Four unit tests passed. Added tab-monitor registration and cleanup.
