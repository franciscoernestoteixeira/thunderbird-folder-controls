import socket,json,argparse
from pathlib import Path
parser=argparse.ArgumentParser(description="Opt-in test against an already running disposable Thunderbird profile")
parser.add_argument('--profile',required=True,help='Absolute disposable profile path; checked against runtime')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
s=socket.create_connection(('127.0.0.1',2828),10)
f=s.makefile('rb')
def recv():
 b=b''
 while (c:=f.read(1))!=b':': b+=c
 return json.loads(f.read(int(b)))
print(recv())
i=0
def call(name,args={}):
 global i
 i+=1;b=json.dumps([0,i,name,args]).encode();s.sendall(str(len(b)).encode()+b':'+b)
 r=recv()
 if r[2]: raise RuntimeError(r[2])
 return r[3]
session=call('WebDriver:NewSession',{'capabilities':{'alwaysMatch':{}}})
assert Path(session['capabilities']['moz:profile']).resolve()==Path(args.profile).resolve(), 'Wrong profile: no mutations performed'
print(session['capabilities']['browserVersion'])
print(call('Marionette:SetContext',{'value':'chrome'}))

import time,base64

def execute(script):
 return call('WebDriver:ExecuteScript',{'script':script,'args':[],'newSandbox':True})['value']
execute("""if (!Services.prefs.getBoolPref('folderControls.disposableTest', false)) throw Error('Disposable test opt-in missing');
const {MailServices}=ChromeUtils.importESModule('resource:///modules/MailServices.sys.mjs');
if (!MailServices.accounts.accounts.length) {
 for (let i=0;i<2;i++) { const server=MailServices.accounts.createIncomingServer('test'+i,'localhost','none'); server.prettyName='Test '+i;
 const account=MailServices.accounts.createAccount(); account.incomingServer=server;
 server.rootFolder.createSubfolder('Parent',null); const parent=server.rootFolder.getChildNamed('Parent'); parent.createSubfolder('Child',null); }
} return true;""")
time.sleep(2)
print(call('Addon:Install' ,{'path':str(root/'dist'/f"thunderbird-folder-controls-{json.loads((root/'extension'/'manifest.json').read_text())['version']}.xpi"),'temporary':True}))
time.sleep(1)
print(execute("""const w=Services.wm.getMostRecentWindow('mail:3pane'),p=w.document.getElementById('tabmail').currentAbout3Pane;
const rows=()=>[...p.folderTree.querySelectorAll('li[is="folder-tree-row"].children')]; if(rows().length<2)throw Error('Create local test accounts with nested folders first');
for(let i=0;i<20;i++){w.document.getElementById('folder-controls-collapse').click();if(!rows().every(r=>r.classList.contains('collapsed')))throw Error('collapse');w.document.getElementById('folder-controls-expand').click();if(!rows().every(r=>!r.classList.contains('collapsed')))throw Error('expand');}
return {cycles:20,branches:rows().length,buttons:['folder-controls-expand','folder-controls-collapse','button-appmenu'].map(id=>{const b=w.document.getElementById(id),r=b.getBoundingClientRect();return {id,x:r.x,width:r.width,visible:r.width>0&&r.height>0};})};"""))
print(execute("""const w=Services.wm.getMostRecentWindow('mail:3pane'), t=w.document.getElementById('tabmail');
const buttons=['folder-controls-expand','folder-controls-collapse'].map(id=>w.document.getElementById(id));
if (!buttons.every(b=>b && b.getBoundingClientRect().width>0)) throw Error('Toolbar not visible');
const mail=t.currentTabInfo; t.openTab('contentTab',{url:'about:preferences'});
if (!buttons.every(b=>b.hidden && b.style.display==='none')) throw Error('Toolbar visible on non-mail tab');
t.switchToTab(mail); if (!buttons.every(b=>!b.hidden && b.getBoundingClientRect().width>0)) throw Error('Toolbar not restored');
const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
return {tabVisibility:true, version:Services.appinfo.version, platform:Services.appinfo.platformVersion};"""))
status=call('WebDriver:ExecuteAsyncScript',{'script':"""const done=arguments[arguments.length-1];
const {AddonManager}=ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
AddonManager.getAddonByID('folder-controls@franciscoernestoteixeira.github.io').then(a=>done({version:a.version,isCompatible:a.isCompatible,isActive:a.isActive,appDisabled:a.appDisabled}));""",'args':[],'newSandbox':True})['value']
assert status['isCompatible'] and status['isActive'] and not status['appDisabled'], status
print(status)
shot=call('WebDriver:TakeScreenshot',{'id':None,'full':False,'hash':False})['value'];open(root/'dist'/'toolbar-test.png','wb').write(base64.b64decode(shot))
print(call('WebDriver:DeleteSession'))
