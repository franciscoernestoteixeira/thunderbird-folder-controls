import socket,json,argparse,os
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
import os,time,base64
print(call('Addon:Install',{'path':str(root/'dist'/'thunderbird-folder-controls-0.1.0.xpi'),'temporary':True}))
time.sleep(1)
print(execute("""const w=Services.wm.getMostRecentWindow('mail:3pane'),p=w.document.getElementById('tabmail').currentAbout3Pane;
const rows=()=>[...p.folderTree.querySelectorAll('li[is="folder-tree-row"].children')]; if(rows().length<2)throw Error('Create local test accounts with nested folders first');
for(let i=0;i<20;i++){w.document.getElementById('folder-controls-collapse').click();if(!rows().every(r=>r.classList.contains('collapsed')))throw Error('collapse');w.document.getElementById('folder-controls-expand').click();if(!rows().every(r=>!r.classList.contains('collapsed')))throw Error('expand');}
return {cycles:20,branches:rows().length,buttons:['folder-controls-expand','folder-controls-collapse','button-appmenu'].map(id=>{const b=w.document.getElementById(id),r=b.getBoundingClientRect();return {id,x:r.x,width:r.width,visible:r.width>0&&r.height>0};})};"""))
shot=call('WebDriver:TakeScreenshot',{'id':None,'full':False,'hash':False})['value'];open(root/'dist'/'toolbar-test.png','wb').write(base64.b64decode(shot))
print(call('WebDriver:DeleteSession'))
