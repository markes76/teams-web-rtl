/* Fixed Teams URL only. No message/call content, media, credentials, or network APIs. */
function createWindowController(api) {
  const pending = new Map();
  let queue = Promise.resolve();
  function locked(action) {
    const next = queue.then(action, action);
    queue = next.catch(() => {}); return next;
  }
  async function openChat(owner, focused) {
    const key = String(owner);
    if (pending.has(key)) return pending.get(key);
    const task = locked(async () => {
      const {callChatWindows = {}} = await api.storage.session.get('callChatWindows');
      const existing = callChatWindows[key];
      if (Number.isInteger(existing)) {
        try {
          const win = await api.windows.get(existing);
          if (focused) await api.windows.update(existing, {focused:true, ...(win.state === 'minimized' ? {state:'normal'} : {})});
          return win.id;
        } catch { delete callChatWindows[key]; }
      }
      const created = await api.windows.create({url:'https://teams.cloud.microsoft/', type:'popup', width:1200, height:880, focused});
      if (!Number.isInteger(created?.id)) throw new Error('Window creation failed');
      callChatWindows[key] = created.id;
      await api.storage.session.set({callChatWindows});
      return created.id;
    });
    pending.set(key, task);
    try { return await task; } finally { pending.delete(key); }
  }
  async function handle(message, sender) {
    if (sender.id !== api.runtime.id) return {ok:false};
    const isPopup = sender.url === api.runtime.getURL('popup.html');
    let isTeams = false;
    try { isTeams = ['https://teams.microsoft.com','https://teams.cloud.microsoft'].includes(new URL(sender.url).origin); } catch {}
    if (!isPopup && !(isTeams && Number.isInteger(sender.tab?.id))) return {ok:false};
    if (!['teams-rtl:call-active','teams-rtl:open-chat'].includes(message?.type)) return {ok:false};
    const automatic = message.type === 'teams-rtl:call-active';
    if (automatic && (!isTeams || !Number.isInteger(sender.tab?.id))) return {ok:false};
    const {autoCallChat = true} = await api.storage.local.get({autoCallChat:true});
    if (automatic && autoCallChat === false) return {ok:true,skipped:true};
    let owner = sender.tab?.id;
    if (!Number.isInteger(owner)) {
      const active = await api.tabs.query({active:true,lastFocusedWindow:true});
      owner = active[0]?.id ?? 'manual';
    }
    return {ok:true,windowId:await openChat(owner, true)};
  }
  return {handle};
}
if (typeof module !== 'undefined') module.exports = {createWindowController};
else {
  const controller = createWindowController(chrome);
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    controller.handle(message, sender).then(sendResponse, () => sendResponse({ok:false}));
    return true;
  });
}
