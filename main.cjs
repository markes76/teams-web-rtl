// Local development harness only. The distributed app uses the user's Chrome.
const {app, BrowserWindow, session} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
app.setName('Teams RTL Local Demo');
app.setPath('userData', path.join(app.getPath('temp'), `teams-rtl-test-${process.pid}`));
const smoke = process.argv.includes('--smoke-test');
app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_web, _permission, answer) => answer(false));
  const window = new BrowserWindow({width:1200,height:900,show:!smoke,webPreferences:{
    preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false,
  }});
  window.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  window.webContents.on('will-navigate', event => event.preventDefault());
  try {
    await window.loadFile(path.join(__dirname,'fixture.html'));
    if (!smoke) return;
    const result = await Promise.race([
      window.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'tests/browser-checks.js'),'utf8')),
      new Promise((_resolve,reject)=>setTimeout(()=>reject(Error('Browser checks timed out')),20000)),
    ]);
    fs.mkdirSync(path.join(__dirname,'test-results'),{recursive:true});
    fs.writeFileSync(path.join(__dirname,'test-results/chromium.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result,null,2));
    app.exit(result.failures.length ? 1 : 0);
  } catch(error) { console.error(error.message); app.exit(1); }
});
app.on('window-all-closed',()=>app.quit());
