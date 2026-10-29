/* Teams RTL. No IPC, credentials, message collection or Node API exposure. */
(() => {
  const rtlLetter = /[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Adlam}]/u;
  const letter = /\p{Letter}/u;
  function direction(text, fallback = 'ltr') {
    for (const character of text) {
      if (letter.test(character)) return rtlLetter.test(character) ? 'rtl' : 'ltr';
    }
    return fallback;
  }
  function labelOf(element) {
    return (element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || '').trim().toLowerCase();
  }
  function isCallAction(element) {
    if (!element) return false;
    const tid = element.getAttribute('data-tid');
    return ['default-chat-call-video-button','default-chat-call-audio-button','chat-call-video-button','chat-call-audio-button'].includes(tid)
      || /^(video call|audio call|call now|join now|accept call|accept with video|accept with audio)$/.test(labelOf(element));
  }
  function hasCallControls(doc) {
    const labels = [...doc.querySelectorAll('button,[role="button"]')]
      .filter(button => button.getClientRects().length > 0).map(labelOf);
    return labels.some(label => /^(leave|leave call|hang up|end call)$/.test(label))
      && labels.some(label => /^(mute mic|unmute mic|mute microphone|unmute microphone|turn camera on|turn camera off)$/.test(label));
  }
  function createRuntimeAccess(api, onInvalid) {
    let invalid = false;
    function stop() { if (!invalid) { invalid = true; onInvalid(); } }
    function available() {
      if (invalid) return false;
      try { if (api.runtime?.id) return true; } catch {}
      stop(); return false;
    }
    async function invoke(operation) {
      if (!available()) return undefined;
      try { return await operation(api); }
      catch (error) {
        if (/extension context invalidated/i.test(error?.message || '') || !available()) { stop(); return undefined; }
        throw error;
      }
    }
    return {available, invoke};
  }
  if (typeof document === 'undefined') { module.exports = { direction, isCallAction, hasCallControls, createRuntimeAccess }; return; }
  if (window !== window.top) return;
  const teams = ['teams.microsoft.com', 'teams.cloud.microsoft'].includes(location.hostname)
    && location.protocol === 'https:';
  const fixture = location.protocol === 'file:' && location.pathname.endsWith('/fixture.html');
  if (!teams && !fixture) return;

  const editorSelector = [
    '[contenteditable="true"][data-tid="ckeditor"]',
    '.ck-editor__editable[contenteditable="true"]',
    '[contenteditable="true"][role="textbox"][aria-multiline="true"]',
  ].join(',');
  const blockSelector = 'p,li,h1,h2,h3,h4,h5,h6,blockquote,div';
  const overrides = new WeakMap();
  const composing = new WeakSet();
  const extensionStorage = typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage?.local;
  let showToolbar = !extensionStorage;
  let autoCallChat = true, callNotified = false;
  let callPending = false, callAttempts = 0, lastCallAttempt = 0, callIntentUntil = 0;
  let current = null, pending = false, host, shadow, status, shortcut, panel;
  let panelOpen = false, savedRange = null;
  let disabled = false, observer, callTimer, frame;
  const events = new AbortController();
  const runtime = extensionStorage ? createRuntimeAccess(chrome, () => {
    disabled = true;
    observer?.disconnect();
    if (callTimer) clearInterval(callTimer);
    if (frame) cancelAnimationFrame(frame);
    events.abort();
    host?.remove();
  }) : null;
  function live() { return !disabled && (!runtime || runtime.available()); }
  function listen(target, name, handler, capture = false) {
    target.addEventListener(name, handler, {capture, signal:events.signal});
  }

  function blocks(editor) {
    const result = [...editor.querySelectorAll(blockSelector)].filter(block =>
      !block.closest('pre,code,[contenteditable="false"]') &&
      !block.querySelector(blockSelector));
    return result.length ? result : [editor];
  }
  function activeBlock(editor) {
    const selection = window.getSelection();
    const node = selection?.anchorNode;
    if (!node || !editor.contains(node)) return blocks(editor)[0];
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    const candidates = blocks(editor);
    if (element === editor) {
      const child = editor.childNodes[Math.min(selection.anchorOffset, editor.childNodes.length - 1)];
      return candidates.find(block => block === child || block.contains(child)) || candidates[0];
    }
    return candidates.find(block => block === element || block.contains(element)) || candidates[0];
  }
  function setStyle(element, key, value) {
    if (element.style[key] !== value) element.style[key] = value;
  }
  function apply(editor) {
    if (composing.has(editor)) return;
    const candidates = blocks(editor);
    const managed = editor.matches('.ck-editor__editable');
    const rootMode = overrides.get(editor) || 'auto';
    const base = candidates[0] === editor && rootMode !== 'auto' ? rootMode : direction(editor.textContent);
    // CKEditor owns its DOM attributes and normalizes alignment values. Writing
    // unsupported attrs/styles back every frame fights its rendering observer.
    if (!managed || candidates[0] === editor) {
      if (!managed && editor.getAttribute('dir') !== base) editor.setAttribute('dir', base);
      setStyle(editor, 'textAlign', managed ? (base === 'rtl' ? 'right' : 'initial') : 'start');
      setStyle(editor, 'direction', base);
    }
    for (const block of candidates) {
      const mode = overrides.get(block) || 'auto';
      const value = mode === 'auto' ? direction(block.textContent) : mode;
      if (!managed && block.getAttribute('dir') !== value) block.setAttribute('dir', value);
      setStyle(block, 'direction', value);
      setStyle(block, 'textAlign', managed ? (value === 'rtl' ? 'right' : 'initial') : 'start');
      if (!managed) {
        setStyle(block, 'unicodeBidi', 'isolate');
        if (block.dataset.rtlMode !== mode) block.dataset.rtlMode = mode;
      }
    }
  }
  function place() {
    if (!host || !live()) return;
    host.hidden = !showToolbar;
    if (!showToolbar) panelOpen = false;
    const more = document.querySelector('[data-tid="appbar-flyout-button"]')
      || document.querySelector('button[aria-label="View more apps"]');
    const item = more?.parentElement;
    if (item?.parentElement && !host.contains(item)) {
      if (host.parentElement !== item.parentElement || host.previousElementSibling !== item) item.after(host);
      setStyle(host, 'position', 'relative'); setStyle(host, 'width', '100%');
      setStyle(host, 'top', ''); setStyle(host, 'left', ''); setStyle(host, 'bottom', '');
      host.dataset.dock = 'app-rail';
    } else {
      // Keep the control off the composer even while the app rail is loading.
      if (host.parentElement !== document.documentElement) document.documentElement.append(host);
      setStyle(host, 'position', 'fixed'); setStyle(host, 'width', '56px');
      setStyle(host, 'left', '6px'); setStyle(host, 'bottom', '16px'); setStyle(host, 'top', '');
      host.dataset.dock = 'left-edge';
    }
    panel.hidden = !panelOpen;
    shortcut.setAttribute('aria-expanded', String(panelOpen));
    if (panelOpen) {
      const anchor = shortcut.getBoundingClientRect();
      const height = panel.getBoundingClientRect().height || 220;
      const left = Math.max(8, Math.min(anchor.right + 12, innerWidth - 286));
      let top = Math.max(8, Math.min(anchor.top, innerHeight - height - 12));
      if (current?.isConnected) {
        const editor = current.getBoundingClientRect();
        const intersects = left < editor.right && left + 272 > editor.left && top < editor.bottom && top + height > editor.top;
        if (intersects && editor.top - height - 12 >= 8) top = editor.top - height - 12;
        else if (intersects && editor.bottom + height + 24 <= innerHeight) top = editor.bottom + 12;
      }
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    }
    const hasEditor = Boolean(current?.isConnected);
    for (const button of shadow.querySelectorAll('button[data-mode]')) button.disabled = !hasEditor;
    if (!hasEditor) {
      status.textContent = 'Open a chat'; return;
    }
    const block = activeBlock(current);
    const mode = overrides.get(block) || 'auto';
    const value = direction(block.textContent);
    status.textContent = mode === 'auto' ? `Auto · ${value.toUpperCase()}` : `${mode.toUpperCase()} override`;
    for (const button of shadow.querySelectorAll('button[data-mode]')) {
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    }
  }
  function run() {
    pending = false;
    if (!live()) return;
    for (const editor of document.querySelectorAll(editorSelector)) apply(editor);
    if (!current?.isConnected) current = document.querySelector(editorSelector);
    place();
    monitorCall();
  }
  function monitorCall() {
    if (!live()) return;
    const active = hasCallControls(document);
    host.dataset.callState = active ? 'active' : 'idle';
    if (!extensionStorage) return;
    if (!active && Date.now() > callIntentUntil && !callPending) {
      callNotified = false; callAttempts = 0; return;
    }
    if (!autoCallChat || callNotified || callPending || callAttempts >= 3 || Date.now() - lastCallAttempt < 750) return;
    callPending = true; callAttempts++; lastCallAttempt = Date.now();
    host.dataset.callWindow = 'requesting';
    // No native call action is invoked, cancelled, moved, or reloaded here.
    runtime.invoke(api => api.runtime.sendMessage({type:'teams-rtl:call-active'})).then(response => {
      if (disabled) return;
      callNotified = response?.ok === true && !response.skipped;
      host.dataset.callWindow = callNotified ? 'open' : 'failed';
    }, () => { host.dataset.callWindow = 'failed'; }).finally(() => { callPending = false; });
  }
  function schedule() {
    if (live() && !pending) { pending = true; frame = requestAnimationFrame(run); }
  }
  function choose(mode) {
    if (!live() || !current?.isConnected || composing.has(current)) return;
    const selection = window.getSelection();
    const selected = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const range = selected && current.contains(selected.commonAncestorContainer) ? selected
      : savedRange && current.contains(savedRange.commonAncestorContainer) ? savedRange : null;
    if (range) {
      const restored = range.cloneRange();
      current.focus({preventScroll:true});
      selection.removeAllRanges(); selection.addRange(restored);
    }
    const targets = range && !range.collapsed && current.contains(range.commonAncestorContainer)
      ? blocks(current).filter(block => range.intersectsNode(block)) : [activeBlock(current)];
    for (const block of targets) overrides.set(block, mode);
    apply(current);
    panelOpen = false;
    place();
  }
  function rememberSelection() {
    const selection = window.getSelection();
    if (current?.isConnected && selection?.rangeCount) {
      const range = selection.getRangeAt(0);
      if (current.contains(range.commonAncestorContainer)) savedRange = range.cloneRange();
    }
  }
  function init() {
    if (!live()) return;
    host = document.createElement('div');
    host.id = 'teams-rtl-spike-controls';
    host.dataset.rtlVersion = '0.1.0';
    host.dataset.runtimeGuard = '1';
    host.hidden = !showToolbar;
    host.style.cssText = 'position:relative;z-index:2147483647;direction:ltr;width:100%;height:56px;flex:0 0 56px;';
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
      :host { font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:var(--colorNeutralForeground1,#242424); }
      :host([hidden]),[hidden]{display:none!important}
      button{font:inherit;cursor:pointer;border:0;background:transparent;color:inherit}
      button:focus-visible{outline:2px solid #5b5fc7;outline-offset:2px}button:disabled{opacity:.45;cursor:default}
      .rail{display:flex;justify-content:center;padding-top:6px}
      .shortcut{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:48px;height:48px;border-radius:5px;color:var(--colorNeutralForeground2,#616161)}
      .shortcut:hover,.shortcut[aria-expanded=true]{background:var(--colorSubtleBackgroundHover,#e4e4ec);color:#5b5fc7}
      .shortcut span{font-size:10px;line-height:12px}.shortcut svg{width:22px;height:22px}
      .panel{position:fixed;width:272px;box-sizing:border-box;padding:16px;border:1px solid var(--colorNeutralStroke2,#e0e0e0);border-radius:8px;background:var(--colorNeutralBackground1,#fff);box-shadow:0 8px 28px #00000026}
      .head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}.head h2{font-size:14px;margin:0;font-weight:600}
      .close{font-size:20px;line-height:20px;width:24px;height:24px;border-radius:4px}.close:hover{background:var(--colorSubtleBackgroundHover,#efeff4)}
      .modes{display:flex;gap:3px;padding:3px;border-radius:6px;background:var(--colorNeutralBackground3,#f3f3f7)}
      [data-mode]{flex:1;border-radius:4px;padding:9px 5px;font-weight:500}[data-mode][aria-pressed=true]{background:#5b5fc7;color:#fff}
      output{display:block;margin-top:12px;font-size:12px;color:var(--colorNeutralForeground2,#616161)}
      .note{font-size:12px;line-height:1.5;color:var(--colorNeutralForeground2,#616161);margin:8px 0 12px}
      .hide{padding:0;font-size:12px;color:#5b5fc7}.hide:hover{text-decoration:underline}
    </style><div class="rail">
      <button type="button" class="shortcut" data-action="toggle-panel" aria-label="Text direction" title="Text direction" aria-haspopup="dialog" aria-expanded="false" aria-controls="teams-rtl-panel">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16M8 9h12M12 13h8M5 11l-3 3 3 3M2 14h7M4 21h16"/></svg><span>Text</span>
      </button></div>
      <section class="panel" id="teams-rtl-panel" data-panel role="dialog" aria-label="Text direction" hidden>
        <div class="head"><h2>Text direction</h2><button type="button" class="close" data-action="close-panel" aria-label="Close text direction menu">×</button></div>
        <div class="modes" role="toolbar" aria-label="Paragraph direction">
          <button type="button" data-mode="auto" title="Detect each paragraph from its first letter">Auto</button>
          <button type="button" data-mode="rtl" title="Right-to-left paragraph">RTL</button>
          <button type="button" data-mode="ltr" title="Left-to-right paragraph">LTR</button>
        </div><output aria-live="polite"></output>
        <p class="note">Applies to the current or selected paragraphs. Auto keeps working when this menu is closed.</p>
        <button type="button" class="hide" data-action="hide">Hide shortcut</button>
      </section>`;
    status = shadow.querySelector('output');
    shortcut = shadow.querySelector('[data-action="toggle-panel"]');
    panel = shadow.querySelector('[data-panel]');
    listen(shortcut, 'pointerdown', event => {rememberSelection();event.preventDefault();});
    listen(shortcut, 'click', () => {rememberSelection();panelOpen=!panelOpen;place();});
    listen(shadow.querySelector('[data-action="close-panel"]'), 'click', () => {panelOpen=false;place();shortcut.focus({preventScroll:true});});
    for (const button of shadow.querySelectorAll('button[data-mode]')) {
      listen(button, 'pointerdown', event => event.preventDefault());
      listen(button, 'click', () => choose(button.dataset.mode));
    }
    listen(shadow.querySelector('[data-action="hide"]'), 'click', () => {
      if (!live()) return;
      showToolbar = false; place();
      if (runtime) runtime.invoke(api => api.storage.local.set({ showToolbar:false })).catch(() => {});
    });
    document.documentElement.append(host);
    if (extensionStorage) {
      runtime.invoke(api => api.storage.local.get({ showToolbar:false, autoCallChat:true })).then(settings => {
        if (!settings || disabled) return;
        showToolbar = settings.showToolbar === true; autoCallChat = settings.autoCallChat !== false; schedule();
      }).catch(() => {});
      runtime.invoke(api => api.storage.onChanged.addListener((changes, area) => {
        if (!live()) return;
        if (area === 'local' && changes.showToolbar) {
          showToolbar = changes.showToolbar.newValue === true; place();
        }
        if (area === 'local' && changes.autoCallChat) {
          autoCallChat = changes.autoCallChat.newValue !== false;
          callNotified = false; callAttempts = 0; schedule();
        }
      })).catch(() => {});
    }
    if (!live()) return;
    observer = new MutationObserver(records => {
      if (records.some(record => record.target !== host && !host.contains(record.target))) schedule();
    });
    observer.observe(document.body, { subtree:true, childList:true, characterData:true,
      attributes:true, attributeFilter:['contenteditable', 'dir', 'style', 'aria-label', 'aria-labelledby', 'role', 'hidden'] });
    listen(document, 'click', event => {
      if (!live()) return;
      const action = event.target.closest?.('button,[role="button"],[role="menuitem"]');
      if (event.isTrusted && extensionStorage && autoCallChat && isCallAction(action)) {
        callIntentUntil = Date.now() + 15000; callNotified = false; callAttempts = 0; lastCallAttempt = 0;
        monitorCall();
      }
    }, true);
    listen(document, 'pointerdown', event => {
      if (panelOpen && !event.composedPath().includes(host)) {panelOpen=false;place();}
    }, true);
    listen(document, 'keydown', event => {
      if (panelOpen && event.key === 'Escape') {
        event.preventDefault();event.stopPropagation();panelOpen=false;place();shortcut.focus({preventScroll:true});
      }
    }, true);
    // Covers call UI changes that use native semantic roles, attributes, or
    // background rendering rather than the exact ARIA structure of one build.
    if (extensionStorage) callTimer = setInterval(monitorCall, 1000);
    listen(document, 'focusin', event => {
      const editor = event.target.closest?.(editorSelector);
      if (editor) { current = editor; schedule(); }
    });
    listen(document, 'input', schedule, true);
    listen(document, 'selectionchange', () => {rememberSelection();if (!composing.has(current)) place();});
    listen(document, 'compositionstart', event => {
      const editor = event.target.closest?.(editorSelector);
      if (editor) composing.add(editor);
    }, true);
    listen(document, 'compositionend', event => {
      const editor = event.target.closest?.(editorSelector);
      if (editor) composing.delete(editor);
      schedule();
    }, true);
    listen(window, 'resize', schedule);
    listen(document, 'scroll', schedule, true);
    // An editor may be replaced by Teams after chat navigation.
    run();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true, signal:events.signal });
  else init();
})();
