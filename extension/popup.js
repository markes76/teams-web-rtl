const control = document.getElementById('show-toolbar');
const status = document.getElementById('status');
const autoCall = document.getElementById('auto-call-chat');
const openChat = document.getElementById('open-chat');
const windowStatus = document.getElementById('window-status');
function render(visible) {
  control.checked = visible;
  status.textContent = visible ? 'Sidebar shortcut visible across your Teams windows.' : 'Shortcut hidden. Auto direction continues.';
}
chrome.storage.local.get({ showToolbar:false, autoCallChat:true }).then(settings => {
  render(settings.showToolbar === true); autoCall.checked = settings.autoCallChat !== false;
});
control.addEventListener('change', async () => {
  control.disabled = true;
  try { await chrome.storage.local.set({ showToolbar:control.checked }); render(control.checked); }
  catch { status.textContent = 'Could not save. Please try again.'; }
  finally { control.disabled = false; }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.showToolbar) render(changes.showToolbar.newValue === true);
  if (area === 'local' && changes.autoCallChat) autoCall.checked = changes.autoCallChat.newValue !== false;
});
autoCall.addEventListener('change', async () => {
  try { await chrome.storage.local.set({autoCallChat:autoCall.checked}); }
  catch { windowStatus.textContent = 'Could not save. Please try again.'; }
});
openChat.addEventListener('click', async () => {
  openChat.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({type:'teams-rtl:open-chat'});
    windowStatus.textContent = response?.ok ? 'Separate Teams chat window is open.' : 'Could not open the chat window. Please try again.';
  } catch { windowStatus.textContent = 'Please reload the extension and try again.'; }
  finally { openChat.disabled = false; }
});
