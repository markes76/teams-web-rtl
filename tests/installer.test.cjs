const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
test('Mac installer creates a signed launcher, stable extension folder, and supports updates',{skip:process.platform!=='darwin'},()=>{
  const dest=fs.mkdtempSync(path.join(os.tmpdir(),'teams-web-install-'));
  const options={env:{...process.env,TEAMS_WEB_DEST:dest,TEAMS_WEB_NO_OPEN:'1'},encoding:'utf8'};
  // The source-layout installer expects the same flat payload as the release.
  const source=path.join(dest,'payload');fs.mkdirSync(source);
  for(const name of ['Install.command','launcher.applescript','START-HERE.html'])fs.copyFileSync(path.join(root,'installer',name),path.join(source,name));
  fs.cpSync(path.join(root,'extension'),path.join(source,'extension'),{recursive:true});
  fs.mkdirSync(path.join(source,'assets'));fs.copyFileSync(path.join(root,'assets/app.icns'),path.join(source,'assets/app.icns'));
  const install=()=>spawnSync('/bin/bash',[path.join(source,'Install.command')],options);
  const app=path.join(dest,'Applications/teams-web.app'),support=path.join(dest,'Library/Application Support/teams-web');
  try {
    let result=install();assert.equal(result.status,0,result.stdout+result.stderr);
    assert.equal(execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleIdentifier',path.join(app,'Contents/Info.plist')],{encoding:'utf8'}).trim(),'io.github.markes76.teams-web-rtl');
    execFileSync('/usr/bin/codesign',['--verify','--strict',app]);
    assert.equal(fs.readFileSync(path.join(support,'extension/direction.js'),'utf8'),fs.readFileSync(path.join(root,'extension/direction.js'),'utf8'));
    assert.ok(fs.existsSync(path.join(support,'START-HERE.html')));
    result=install();assert.equal(result.status,0,'update: '+result.stdout+result.stderr);
    assert.deepEqual(fs.readdirSync(support).sort(),['START-HERE.html','extension']);
    const before=fs.readFileSync(path.join(app,'Contents/Info.plist'));
    fs.writeFileSync(path.join(source,'launcher.applescript'),'This is deliberately invalid AppleScript !!!');
    result=install();assert.notEqual(result.status,0);
    assert.deepEqual(fs.readFileSync(path.join(app,'Contents/Info.plist')),before,'failed build preserves prior app');
    assert.deepEqual(fs.readdirSync(support).sort(),['START-HERE.html','extension']);
  } finally {fs.rmSync(dest,{recursive:true,force:true});}
});
test('Mac installer refuses an unrelated app',{skip:process.platform!=='darwin'},()=>{
  const dest=fs.mkdtempSync(path.join(os.tmpdir(),'teams-web-refuse-'));
  try {
    // Use a valid flat payload so the destination ownership check is reached.
    const source=path.join(dest,'payload');fs.mkdirSync(source);
    for(const name of ['Install.command','launcher.applescript','START-HERE.html'])fs.copyFileSync(path.join(root,'installer',name),path.join(source,name));
    fs.cpSync(path.join(root,'extension'),path.join(source,'extension'),{recursive:true});
    fs.mkdirSync(path.join(source,'assets'));fs.copyFileSync(path.join(root,'assets/app.icns'),path.join(source,'assets/app.icns'));
    const app=path.join(dest,'Applications/teams-web.app');fs.mkdirSync(app,{recursive:true});fs.writeFileSync(path.join(app,'keep.txt'),'keep');
    const result=spawnSync('/bin/bash',[path.join(source,'Install.command')],{env:{...process.env,TEAMS_WEB_DEST:dest,TEAMS_WEB_NO_OPEN:'1'},encoding:'utf8'});
    assert.notEqual(result.status,0);assert.match(result.stderr,/unrelated app/);assert.equal(fs.readFileSync(path.join(app,'keep.txt'),'utf8'),'keep');
  }finally{fs.rmSync(dest,{recursive:true,force:true});}
});
