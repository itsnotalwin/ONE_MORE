'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('native app bundles original HTML CSS JS without remote game server',()=>{
  const copy=read('ios/scripts/copy-web.sh');
  for(const file of ['index.html','manifest.webmanifest','css','js']){
    assert.ok(copy.includes('"$ROOT/'+file+'"'),file+' is bundled');
    assert.ok(fs.existsSync(path.join(root,file)));
  }
  for(const m of read('index.html').matchAll(/(?:src|href)="\.\/((?:css|js)\/[^"]+)"/g)){
    assert.ok(fs.existsSync(path.join(root,m[1])),m[1]+' exists');
  }
  const swift=read('ios/ONE_MORE/InkGameViewController.swift');
  assert.ok(swift.includes('webView.loadFileURL('));
  assert.ok(!swift.includes('https://itsnotalwin.github.io'));
});
test('canvas runs under the island while the UI receives safe area',()=>{
  const app=read('ios/ONE_MORE/OneMoreApp.swift');
  const swift=read('ios/ONE_MORE/InkGameViewController.swift');
  assert.ok(app.includes('.ignoresSafeArea(.all)'));
  assert.ok(app.includes('.statusBarHidden()'));
  assert.ok(swift.includes('webView.topAnchor.constraint(equalTo: view.topAnchor)'));
  assert.ok(swift.includes('webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)'));
  assert.ok(swift.includes('view.safeAreaInsets.top'));
  assert.ok(swift.includes('html.om-native #hud'));
  assert.ok(swift.includes('html.om-native #openingSkip'));
  assert.ok(swift.includes('html.om-native #stage > .screen:not(.screen-intro)'));
  assert.ok(read('ios/ONE_MORE/Info.plist').includes('<key>UIStatusBarHidden</key><true/>'));
});
test('Xcode project includes Swift files and source-bundling phase',()=>{
  const pbx=read('ios/ONE_MORE.xcodeproj/project.pbxproj');
  assert.ok(pbx.includes('OneMoreApp.swift'));
  assert.ok(pbx.includes('InkGameViewController.swift'));
  assert.ok(pbx.includes('Copy Game Web Assets'));
  assert.ok(pbx.includes('scripts/copy-web.sh'));
  assert.ok(pbx.includes('IPHONEOS_DEPLOYMENT_TARGET=16.0'));
});
