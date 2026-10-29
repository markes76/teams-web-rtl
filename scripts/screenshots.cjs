// Render the real extension controls on synthetic text. No live Teams data.
const {app,BrowserWindow,nativeImage} = require('electron');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
app.on('window-all-closed',()=>{}); // Continue between the icon, demo and popup windows.
app.setPath('userData',path.join(app.getPath('temp'),`teams-rtl-images-${process.pid}`));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.whenReady().then(async()=>{
  try {
    const assets=path.join(root,'assets'),shots=path.join(root,'docs/images');
    fs.mkdirSync(shots,{recursive:true});fs.mkdirSync(path.join(root,'extension/icons'),{recursive:true});
    const icon=new BrowserWindow({width:1024,height:1024,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
    await icon.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<style>*{margin:0}html,body{width:1024px;height:1024px;overflow:hidden}svg{display:block;width:1024px;height:1024px}</style>'+fs.readFileSync(path.join(assets,'icon.svg'),'utf8')));
    await wait(200);
    const full=await icon.webContents.capturePage();
    fs.writeFileSync(path.join(assets,'icon.png'),full.resize({width:1024,height:1024}).toPNG());
    for(const size of [16,32,48,128])fs.writeFileSync(path.join(root,`extension/icons/icon${size}.png`),full.resize({width:size,height:size}).toPNG());
    icon.destroy();
    const demo=new BrowserWindow({width:1200,height:900,show:false,webPreferences:{preload:path.join(root,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
    await demo.loadFile(path.join(root,'fixture.html'));await wait(200);
    await demo.webContents.executeJavaScript(`document.querySelector('[contenteditable]').focus();document.querySelector('#teams-rtl-spike-controls').shadowRoot.querySelector('[data-action="toggle-panel"]').click()`);
    await wait(200);
    const state=await demo.webContents.executeJavaScript(`(()=>{const panel=document.querySelector('#teams-rtl-spike-controls').shadowRoot.querySelector('[data-panel]');return {open:!panel.hidden,rtl:document.querySelector('[contenteditable] p').dir}})()`);
    if(!state.open||state.rtl!=='rtl')throw Error('Screenshot controls did not render correctly');
    fs.writeFileSync(path.join(shots,'auto-direction.png'),(await demo.webContents.capturePage()).toPNG());
    fs.writeFileSync(path.join(shots,'sidebar-menu.png'),(await demo.webContents.capturePage({x:0,y:145,width:380,height:300})).toPNG());
    demo.destroy();
    const popup=new BrowserWindow({width:320,height:520,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
    const html=fs.readFileSync(path.join(root,'extension/popup.html'),'utf8').replace('<script src="popup.js"></script>',`<script>window.chrome={storage:{local:{get:async()=>({showToolbar:true,autoCallChat:true})},onChanged:{addListener:()=>{}}}};</script><script>${fs.readFileSync(path.join(root,'extension/popup.js'),'utf8')}</script>`);
    await popup.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));await wait(200);
    fs.writeFileSync(path.join(shots,'settings.png'),(await popup.webContents.capturePage()).toPNG());popup.destroy();
    console.log('Saved synthetic screenshots and original extension icons.');app.quit();
  }catch(error){console.error(error);app.exit(1);}
});
