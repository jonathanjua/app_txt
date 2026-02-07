const editor = document.getElementById('editor');
const btnNewTab = document.getElementById('btn-new-tab');
const tabBarEl = document.getElementById('tab-bar');
const statusLnCol = document.getElementById('status-ln-col');
const statusChars = document.getElementById('status-chars');
const statusMsg = document.getElementById('status-msg');
const contextMenu = document.getElementById('context-menu');
const editorWrap = document.getElementById('editor-wrap');
const virtualScrollWrap = document.getElementById('virtual-scroll-wrap');
const virtualScrollContainer = document.getElementById('virtual-scroll-container');
const virtualScrollContent = document.getElementById('virtual-scroll-content');
const virtualScrollViewport = document.getElementById('virtual-scroll-viewport');
const virtualScrollInfo = document.getElementById('virtual-scroll-info');
const virtualScrollEditBtn = document.getElementById('virtual-scroll-edit-btn');

const LINE_HEIGHT = 24;
const VIRTUAL_SCROLL_THRESHOLD = 2000;
const VISIBLE_BUFFER = 15;
let virtualMode = false;
let virtualLines = [];
let virtualScrollRaf = null;
let virtualScrollResizeObserver = null;

let tabIdCounter = 0;
let tabs = [];
let activeIndex = 0;

// Tema claro/escuro
const THEME_KEY = 'editor-theme';
// Documentos não salvos (restaurados ao reabrir o app)
const UNSAVED_TABS_KEY = 'editor-unsaved-tabs';
const UNSAVED_DEBOUNCE_MS = 2000;
const STATUS_BAR_DEBOUNCE_MS = 60;
let unsavedDebounceTimer = null;
let statusBarDebounceTimer = null;

function isDarkTheme() {
  return document.documentElement.classList.contains('dark');
}

function setTheme(dark) {
  if (dark) {
    document.documentElement.classList.add('dark');
    localStorage.setItem(THEME_KEY, 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem(THEME_KEY, 'light');
  }
}

function applySavedTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  setTheme(saved === 'dark');
}

// --- Abas ---

function getTabLabel(path) {
  return path ? path.split(/[/\\]/).pop() : 'Sem título';
}

function getCurrentTab() {
  return tabs[activeIndex] || null;
}

function getCurrentContent() {
  return virtualMode ? virtualLines.join('\n') : editor.value;
}

function saveCurrentToTab() {
  const tab = getCurrentTab();
  if (!tab) return;
  if (virtualMode) return;
  tab.content = editor.value;
}

function loadTabIntoEditor(index) {
  const tab = tabs[index];
  if (!tab) return;
  const content = tab.content;
  virtualMode = false;
  virtualLines = [];
  virtualScrollWrap.classList.add('hidden');
  virtualScrollWrap.classList.remove('flex');
  editorWrap.classList.remove('hidden');
  editor.value = content;
  updateStatus();
  updateStatusBar();
  editor.focus();
}

function initVirtualScroll() {
  virtualScrollResizeObserver?.disconnect();
  virtualScrollResizeObserver = null;
  const totalHeight = virtualLines.length * LINE_HEIGHT;
  virtualScrollContent.style.height = totalHeight + 'px';
  virtualScrollContent.style.minHeight = totalHeight + 'px';
  virtualScrollViewport.innerHTML = '';
  virtualScrollContainer.onscroll = () => {
    if (virtualScrollRaf) cancelAnimationFrame(virtualScrollRaf);
    virtualScrollRaf = requestAnimationFrame(updateVirtualView);
  };
  virtualScrollResizeObserver = new ResizeObserver(() => updateVirtualView());
  virtualScrollResizeObserver.observe(virtualScrollContainer);
  updateVirtualView();
}

function updateVirtualView() {
  virtualScrollRaf = null;
  if (!virtualLines.length) return;
  const scrollTop = virtualScrollContainer.scrollTop;
  const containerHeight = virtualScrollContainer.clientHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - VISIBLE_BUFFER);
  const visibleCount = Math.ceil(containerHeight / LINE_HEIGHT) + VISIBLE_BUFFER * 2;
  const endIndex = Math.min(virtualLines.length, startIndex + visibleCount);
  virtualScrollViewport.style.top = startIndex * LINE_HEIGHT + 'px';
  virtualScrollViewport.style.height = (endIndex - startIndex) * LINE_HEIGHT + 'px';
  const fragment = document.createDocumentFragment();
  for (let i = startIndex; i < endIndex; i++) {
    const div = document.createElement('div');
    div.className = 'virtual-line';
    div.textContent = virtualLines[i];
    div.dataset.lineIndex = String(i + 1);
    fragment.appendChild(div);
  }
  virtualScrollViewport.innerHTML = '';
  virtualScrollViewport.appendChild(fragment);
  updateVirtualStatusBar();
}

function updateVirtualStatusBar() {
  if (!virtualMode || !virtualLines.length) return;
  const scrollTop = virtualScrollContainer ? virtualScrollContainer.scrollTop : 0;
  const firstVisibleLine = Math.floor(scrollTop / LINE_HEIGHT) + 1;
  statusLnCol.textContent = `Ln ${firstVisibleLine}–${Math.min(firstVisibleLine + Math.ceil((virtualScrollContainer?.clientHeight || 0) / LINE_HEIGHT), virtualLines.length)} de ${virtualLines.length.toLocaleString()}`;
  statusChars.textContent = `${virtualLines.join('\n').length.toLocaleString()} caracteres`;
}

function switchVirtualToEditor() {
  if (!virtualMode || !virtualLines.length) return;
  const content = virtualLines.join('\n');
  const tab = getCurrentTab();
  if (tab) tab.content = content;
  virtualMode = false;
  virtualLines = [];
  virtualScrollWrap.classList.add('hidden');
  virtualScrollWrap.classList.remove('flex');
  editorWrap.classList.remove('hidden');
  editor.value = content;
  updateStatus();
  updateStatusBar();
  editor.focus();
  showStatus('Conteúdo carregado no editor (pode travar em arquivos muito grandes)');
}

virtualScrollEditBtn?.addEventListener('click', switchVirtualToEditor);

function renderTabBar() {
  tabBarEl.innerHTML = '';
  tabs.forEach((tab, index) => {
    const isActive = index === activeIndex;
    const label = getTabLabel(tab.path);
    const dot = tab.isDirty ? ' •' : '';
    const tabEl = document.createElement('button');
    tabEl.type = 'button';
    tabEl.className =
      'tab flex items-center gap-1.5 px-3 py-2 text-sm shrink-0 max-w-[160px] min-w-0 transition rounded-t ' +
      (isActive
        ? 'bg-stone-700 dark:bg-stone-800 text-white dark:text-stone-100 font-medium'
        : 'hover:bg-stone-600/50 dark:hover:bg-stone-700/50 text-stone-300 dark:text-stone-400');
    tabEl.dataset.index = String(index);
    tabEl.title = tab.path || 'Documento sem título';
    tabEl.innerHTML = `
      <span class="truncate">${escapeHtml(label)}${dot}</span>
      <span class="tab-close w-4 h-4 rounded hover:bg-stone-400 dark:hover:bg-stone-500 flex items-center justify-center shrink-0" data-index="${index}" aria-label="Fechar">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </span>
    `;
    tabEl.querySelector('.tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(index);
    });
    tabEl.addEventListener('click', (e) => {
      if (!e.target.closest('.tab-close')) switchToTab(index);
    });
    tabBarEl.appendChild(tabEl);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function switchToTab(index) {
  if (index === activeIndex || index < 0 || index >= tabs.length) return;
  saveCurrentToTab();
  activeIndex = index;
  loadTabIntoEditor(activeIndex);
  renderTabBar();
  if (!virtualMode) editor.focus();
}

function createNewTab(path, content) {
  saveCurrentToTab();
  const tab = {
    id: ++tabIdCounter,
    path: path,
    content: content,
    isDirty: !path,
  };
  tabs.push(tab);
  activeIndex = tabs.length - 1;
  loadTabIntoEditor(activeIndex);
  renderTabBar();
  editor.focus();
}

function closeTab(index) {
  const tab = tabs[index];
  saveCurrentToTab();
  const hasContent = tab.content.trim() !== '';
  if (tab.isDirty && hasContent && !confirm(`Fechar "${getTabLabel(tab.path)}" sem salvar?`)) return;
  tabs.splice(index, 1);
  if (tabs.length === 0) {
    createNewTab(null, '');
    return;
  }
  if (index < activeIndex) activeIndex--;
  else if (index === activeIndex) activeIndex = Math.min(activeIndex, tabs.length - 1);
  loadTabIntoEditor(activeIndex);
  renderTabBar();
  if (!virtualMode) editor.focus();
}

function getCursorLineCol() {
  const val = editor.value;
  const pos = editor.selectionStart;
  const before = val.substring(0, pos);
  const line = (before.match(/\n/g) || []).length + 1;
  const lastLn = before.lastIndexOf('\n');
  const col = (lastLn === -1 ? before.length : before.length - lastLn - 1) + 1;
  return { line, col };
}

function updateStatusBar() {
  const { line, col } = getCursorLineCol();
  const len = editor.value.length;
  const selLen = editor.selectionEnd - editor.selectionStart;
  statusLnCol.textContent = `Ln ${line}, Col ${col}`;
  statusChars.textContent = selLen > 0 ? `${selLen} de ${len} caracteres` : `${len} caracteres`;
}

function debouncedUpdateStatusBar() {
  if (statusBarDebounceTimer) clearTimeout(statusBarDebounceTimer);
  statusBarDebounceTimer = setTimeout(() => {
    statusBarDebounceTimer = null;
    updateStatusBar();
  }, STATUS_BAR_DEBOUNCE_MS);
}

function updateStatus() {
  const tab = getCurrentTab();
  statusMsg.textContent = !tab ? '' : tab.isDirty ? 'Não salvo' : (tab.path ? 'Salvo' : '');
}

function showStatus(msg, duration = 2000) {
  statusMsg.textContent = msg;
  if (duration) setTimeout(() => updateStatus(), duration);
}

// --- Persistência de documentos não salvos ---

function getUnsavedTabsData() {
  saveCurrentToTab();
  return tabs
    .filter((t) => !t.path || t.isDirty)
    .map((t) => ({ path: t.path, content: t.content }));
}

function saveUnsavedToStorage() {
  const data = getUnsavedTabsData();
  if (data.length === 0) {
    localStorage.removeItem(UNSAVED_TABS_KEY);
    return;
  }
  try {
    localStorage.setItem(UNSAVED_TABS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Não foi possível guardar documentos não salvos:', e);
  }
}

function restoreUnsavedFromStorage() {
  let raw;
  try {
    raw = localStorage.getItem(UNSAVED_TABS_KEY);
  } catch (e) {
    return false;
  }
  if (!raw) return false;
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return false;
  }
  if (!Array.isArray(data) || data.length === 0) return false;
  data.forEach((item) => {
    createNewTab(item.path ?? null, item.content ?? '');
    const tab = getCurrentTab();
    if (tab) tab.isDirty = true;
  });
  localStorage.removeItem(UNSAVED_TABS_KEY);
  return true;
}

function scheduleUnsavedSave() {
  if (unsavedDebounceTimer) clearTimeout(unsavedDebounceTimer);
  unsavedDebounceTimer = setTimeout(() => {
    unsavedDebounceTimer = null;
    saveUnsavedToStorage();
  }, UNSAVED_DEBOUNCE_MS);
}

editor.addEventListener('input', () => {
  const tab = getCurrentTab();
  if (tab) tab.isDirty = true;
  updateStatus();
  debouncedUpdateStatusBar();
  renderTabBar();
  scheduleUnsavedSave();
});

editor.addEventListener('select', updateStatusBar);
editor.addEventListener('keyup', updateStatusBar);
editor.addEventListener('click', updateStatusBar);

// --- Menus dropdown ---
function closeAllMenus() {
  document.querySelectorAll('.menu-dropdown.open').forEach((el) => el.classList.remove('open'));
}
document.querySelectorAll('[id^="menu-"]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = btn.id.replace('menu-', 'dropdown-');
    const dropdown = document.getElementById(id);
    const isOpen = dropdown.classList.toggle('open');
    document.querySelectorAll('.menu-dropdown').forEach((d) => { if (d !== dropdown) d.classList.remove('open'); });
    if (isOpen) setTimeout(() => document.addEventListener('click', closeAllMenus, { once: true }), 0);
  });
});
document.querySelectorAll('.menu-dropdown [data-action]').forEach((item) => {
  item.addEventListener('click', () => {
    closeAllMenus();
    const action = item.dataset.action;
    if (action === 'new') createNewTab(null, '');
    else if (action === 'open') doOpen();
    else if (action === 'save') save();
    else if (action === 'save-as') saveAs();
    else if (action === 'undo') editor.focus() && document.execCommand('undo');
    else if (action === 'cut') editor.focus() && document.execCommand('cut');
    else if (action === 'copy') editor.focus() && document.execCommand('copy');
    else if (action === 'paste') editor.focus() && document.execCommand('paste');
    else if (action === 'select-all') editor.focus() && editor.select();
    else if (action === 'theme-light') setTheme(false);
    else if (action === 'theme-dark') setTheme(true);
    else if (action === 'shortcuts') showShortcutsModal();
    else if (action === 'sort-lines') runSortLinesInWorker();
  });
});

// --- Web Worker: processamento pesado (ordenar linhas) ---
function runSortLinesInWorker() {
  const text = getCurrentContent();
  if (!text.trim()) {
    showStatus('Nada para ordenar', 2000);
    return;
  }
  showStatus('Ordenando linhas… (não feche a janela)', 0);
  const worker = new Worker('worker-text.js');
  worker.postMessage({ type: 'sortLines', text });
  worker.onmessage = (e) => {
    const { type, result, message } = e.data || {};
    worker.terminate();
    if (type === 'done') {
      if (virtualMode) {
        virtualLines = result.split(/\r?\n/);
        updateVirtualView();
      } else {
        editor.value = result;
      }
      const tab = getCurrentTab();
      if (tab) tab.isDirty = true;
      renderTabBar();
      showStatus('Linhas ordenadas');
    } else {
      showStatus(message || 'Erro ao ordenar', 4000);
    }
  };
  worker.onerror = () => {
    worker.terminate();
    showStatus('Erro no worker ao ordenar', 4000);
  };
}

// --- Modal Atalhos ---
const shortcutsModal = document.getElementById('shortcuts-modal');
const shortcutsCloseBtn = document.getElementById('shortcuts-close');

function showShortcutsModal() {
  shortcutsModal.classList.remove('hidden');
  shortcutsModal.classList.add('flex');
  shortcutsModal.setAttribute('aria-hidden', 'false');
  shortcutsCloseBtn?.focus();
}

function hideShortcutsModal() {
  shortcutsModal.classList.add('hidden');
  shortcutsModal.classList.remove('flex');
  shortcutsModal.setAttribute('aria-hidden', 'true');
}

shortcutsCloseBtn?.addEventListener('click', hideShortcutsModal);
shortcutsModal?.addEventListener('click', (e) => {
  if (e.target === shortcutsModal) hideShortcutsModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && shortcutsModal && !shortcutsModal.classList.contains('hidden')) hideShortcutsModal();
});

// --- Menu de contexto (clique direito) ---
let contextMenuClose = null;
editor.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  contextMenuClose?.();
  contextMenu.classList.remove('hidden');
  const x = Math.min(e.clientX, window.innerWidth - contextMenu.offsetWidth - 8);
  const y = Math.min(e.clientY, window.innerHeight - contextMenu.offsetHeight - 8);
  contextMenu.style.left = `${Math.max(8, x)}px`;
  contextMenu.style.top = `${Math.max(8, y)}px`;
  contextMenuClose = () => {
    contextMenu.classList.add('hidden');
    document.removeEventListener('click', contextMenuClose);
    contextMenuClose = null;
  };
  setTimeout(() => document.addEventListener('click', contextMenuClose), 0);
});
contextMenu.querySelectorAll('[data-ctx]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    contextMenuClose?.();
    contextMenu.classList.add('hidden');
    const ctx = btn.dataset.ctx;
    editor.focus();
    if (ctx === 'cut') document.execCommand('cut');
    else if (ctx === 'copy') document.execCommand('copy');
    else if (ctx === 'paste') document.execCommand('paste');
    else if (ctx === 'select-all') editor.select();
    else if (ctx === 'delete') document.execCommand('delete', false, null);
    else if (ctx === 'undo') document.execCommand('undo');
  });
});

// --- Ações ---

btnNewTab.addEventListener('click', () => createNewTab(null, ''));

const openFileLoadingEl = document.getElementById('open-file-loading');
const openFileLoadingText = document.getElementById('open-file-loading-text');
const openFileLoadingBar = document.getElementById('open-file-loading-bar');

function showOpenFileLoading() {
  openFileLoadingEl?.classList.remove('hidden');
  openFileLoadingEl?.classList.add('flex');
  openFileLoadingEl?.setAttribute('aria-hidden', 'false');
  openFileLoadingText.textContent = 'Carregando…';
  openFileLoadingBar.style.width = '0%';
}

function updateOpenFileProgress(bytesRead, totalBytes) {
  if (!openFileLoadingText || !openFileLoadingBar) return;
  const formatBytes = (n) => (n < 1024 ? n + ' B' : (n / 1024 / 1024).toFixed(1) + ' MB');
  openFileLoadingText.textContent = totalBytes
    ? `Lendo: ${formatBytes(bytesRead)} de ${formatBytes(totalBytes)}`
    : `Lendo: ${formatBytes(bytesRead)}…`;
  const pct = totalBytes && totalBytes > 0 ? Math.min(100, Math.round((bytesRead / totalBytes) * 100)) : 0;
  openFileLoadingBar.style.width = pct + '%';
}

function hideOpenFileLoading() {
  openFileLoadingEl?.classList.add('hidden');
  openFileLoadingEl?.classList.remove('flex');
  openFileLoadingEl?.setAttribute('aria-hidden', 'true');
}

async function doOpen() {
  const filePath = await window.api.openFile();
  if (!filePath) return;
  const existing = tabs.findIndex((t) => t.path === filePath);
  if (existing >= 0) {
    switchToTab(existing);
    showStatus('Arquivo já aberto');
    return;
  }
  showOpenFileLoading();
  try {
    const result = await window.api.readFileStream(filePath, (p) => {
      updateOpenFileProgress(p.bytesRead, p.totalBytes ?? null);
    });
    createNewTab(filePath, result.content);
    const tab = getCurrentTab();
    if (tab) tab.isDirty = false;
    renderTabBar();
    updateStatus();
    if (result.truncated) {
      showStatus('Arquivo truncado a 200 MB (muito grande).', 6000);
    } else {
      showStatus('Arquivo aberto');
    }
  } catch (err) {
    showStatus('Erro ao abrir', 4000);
    console.error(err);
  } finally {
    hideOpenFileLoading();
  }
}

async function save(pathOverride) {
  const tab = getCurrentTab();
  if (!tab) return;
  const toSave = pathOverride || tab.path;
  if (!toSave) return saveAs();
  try {
    await window.api.writeFile(toSave, editor.value);
    tab.path = toSave;
    tab.content = editor.value;
    tab.isDirty = false;
    renderTabBar();
    updateStatus();
    showStatus('Salvo');
    return true;
  } catch (err) {
    showStatus('Erro ao salvar', 4000);
    console.error(err);
    return false;
  }
}

async function saveAs() {
  const tab = getCurrentTab();
  if (!tab) return;
  const path = await window.api.saveFile(tab.path);
  if (!path) return;
  await save(path);
}

// Atalhos
editor.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 's') {
      e.preventDefault();
      save();
    }
    if (e.key === 'o') {
      e.preventDefault();
      btnOpen.click();
    }
    if (e.key === 'n') {
      e.preventDefault();
      btnNew.click();
    }
    if (e.key === 'w') {
      e.preventDefault();
      closeTab(activeIndex);
    }
  }
});

// Persistir não salvos ao fechar
window.addEventListener('beforeunload', () => saveUnsavedToStorage());

// Inicialização: restaurar não salvos ou uma aba vazia
applySavedTheme();
if (!restoreUnsavedFromStorage()) {
  createNewTab(null, '');
}
updateStatus();
updateStatusBar();
editor.focus();
