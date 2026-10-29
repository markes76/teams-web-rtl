const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const version=JSON.parse(fs.readFileSync(path.join(root,'extension/manifest.json'))).version;
const dist=path.join(root,'dist'),name=`teams-web-rtl-${version}-mac`,stage=path.join(dist,name);
fs.mkdirSync(dist,{recursive:true});fs.rmSync(stage,{recursive:true,force:true});fs.mkdirSync(stage);
// Explicit allowlist. No profiles, test results, Electron runtime, or private notes.
for(const item of ['extension','assets/app.icns','installer/Install.command','installer/launcher.applescript','installer/START-HERE.html','LICENSE','README.md','PRIVACY.md','docs']){
  const target=path.join(stage,item.startsWith('installer/')?path.basename(item):item);
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.cpSync(path.join(root,item),target,{recursive:true});
}
fs.chmodSync(path.join(stage,'Install.command'),0o755);
const macZip=path.join(dist,`${name}.zip`),extZip=path.join(dist,`teams-rtl-${version}-extension.zip`);
for(const file of [macZip,extZip])fs.rmSync(file,{force:true});
execFileSync('/usr/bin/ditto',['-c','-k','--norsrc','--noextattr','--keepParent',stage,macZip]);
execFileSync('/usr/bin/ditto',['-c','-k','--norsrc','--noextattr','--keepParent',path.join(root,'extension'),extZip]);
const crypto=require('node:crypto');
fs.writeFileSync(path.join(dist,'SHA256SUMS.txt'),[macZip,extZip].map(file=>`${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}  ${path.basename(file)}`).join('\n')+'\n');
console.log([macZip,extZip,path.join(dist,'SHA256SUMS.txt')].join('\n'));
