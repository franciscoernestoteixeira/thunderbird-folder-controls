"""Read-only contract probe for the internal Thunderbird hooks this add-on uses.

Run it after every Thunderbird update to learn, in one step, whether the
extension still has a working contract and, if not, exactly which internal hook
broke. It performs no mutation: no account creation, no add-on install, no tree
changes. Point it at a disposable profile, never your normal mail profile.

Launch the installed Thunderbird first:
  <thunderbird-binary> -no-remote -profile <absolute-disposable-profile> \
      --marionette --remote-allow-system-access
with marionette.port=2828 in the profile's user.js, then run:
  python3 tests/contract-probe.py --profile <absolute-disposable-profile>
Exit code 0 = contract intact; 1 = at least one hook missing (details printed).
"""
import socket, json, argparse, sys
from pathlib import Path

parser = argparse.ArgumentParser(description="Read-only Thunderbird internal-contract probe")
parser.add_argument('--profile', required=True, help='Absolute disposable profile path; checked against runtime')
parser.add_argument('--port', type=int, default=2828)
args = parser.parse_args()

s = socket.create_connection(('127.0.0.1', args.port), 10)
f = s.makefile('rb')

def recv():
    b = b''
    while (c := f.read(1)) != b':':
        b += c
    return json.loads(f.read(int(b)))

recv()
i = 0

def call(name, params={}):
    global i
    i += 1
    b = json.dumps([0, i, name, params]).encode()
    s.sendall(str(len(b)).encode() + b':' + b)
    r = recv()
    if r[2]:
        raise RuntimeError(r[2])
    return r[3]

session = call('WebDriver:NewSession', {'capabilities': {'alwaysMatch': {}}})
runtime = Path(session['capabilities']['moz:profile']).resolve()
assert runtime == Path(args.profile).resolve(), f'Wrong profile {runtime}: probe aborted, nothing inspected'
call('Marionette:SetContext', {'value': 'chrome'})

SCRIPT = r"""
const w = Services.wm.getMostRecentWindow('mail:3pane');
const doc = w && w.document;
const anchor = doc && doc.getElementById('button-appmenu');
const tabmail = doc && doc.getElementById('tabmail');
const pane = tabmail && tabmail.currentAbout3Pane;
const tree = pane && pane.document.getElementById('folderTree');
let rowSelector = false;
if (tree) { try { tree.querySelectorAll('li[is="folder-tree-row"].children'); rowSelector = true; } catch (e) { rowSelector = false; } }
let extSupport = false;
try { ChromeUtils.importESModule('resource:///modules/ExtensionSupport.sys.mjs'); extSupport = true; } catch (e) { extSupport = false; }
return {
  version: Services.appinfo.version,
  platform: Services.appinfo.platformVersion,
  checks: {
    ExtensionSupport: extSupport,
    toolbarAnchor: !!anchor,
    tabmail: !!tabmail,
    registerTabMonitor: typeof (tabmail && tabmail.registerTabMonitor) === 'function',
    about3Pane: !!pane,
    folderTree: !!tree,
    expandRow: typeof (tree && tree.expandRow) === 'function',
    collapseRow: typeof (tree && tree.collapseRow) === 'function',
    rowSelector: rowSelector
  }
};
"""
report = call('WebDriver:ExecuteScript', {'script': SCRIPT, 'args': [], 'newSandbox': True})['value']
call('WebDriver:DeleteSession')

checks = report['checks']
width = max(len(k) for k in checks)
print(f"Thunderbird {report['version']} (platform {report['platform']})")
print(f"Profile: {runtime}")
print('-' * (width + 10))
failed = []
for name, ok in checks.items():
    print(f"{name.ljust(width)}  {'PASS' if ok else 'FAIL'}")
    if not ok:
        failed.append(name)
print('-' * (width + 10))
if failed:
    print('Contract broken. Missing hooks: ' + ', '.join(failed))
    print('Fix the matching access point in extension/experiments/implementation.js.')
    sys.exit(1)
print('Contract intact. No implementation change required for this Thunderbird version.')
