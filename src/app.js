const { invoke, Channel } = window.__TAURI__.core;

const searchInput = document.getElementById('search');
const entitySelect = document.getElementById('entity-type');
const settingsBtn = document.getElementById('settings-btn');
const settingsPopover = document.getElementById('settings-popover');
const settingResolution = document.getElementById('setting-resolution');
const settingCountry = document.getElementById('setting-country');
const settingDefaultEntity = document.getElementById('setting-default-entity');
const statusEl = document.getElementById('status');
const grid = document.getElementById('grid');
const previewOverlay = document.getElementById('preview-overlay');
const previewImg = document.getElementById('preview-img');
const previewInfo = document.getElementById('preview-info');
const contextMenu = document.getElementById('context-menu');

let debounceTimer = null;
let contextTarget = null;
let currentResults = [];
let focusedIndex = -1;

const COUNTRIES = {
  us:'United States',gb:'United Kingdom',ca:'Canada',au:'Australia',de:'Germany',
  fr:'France',jp:'Japan',kr:'South Korea',br:'Brazil',mx:'Mexico',es:'Spain',
  it:'Italy',nl:'Netherlands',se:'Sweden',no:'Norway',dk:'Denmark',fi:'Finland',
  at:'Austria',ch:'Switzerland',be:'Belgium',ie:'Ireland',pt:'Portugal',
  pl:'Poland',cz:'Czech Republic',hu:'Hungary',ro:'Romania',gr:'Greece',
  tr:'Turkey',ru:'Russia',in:'India',cn:'China',hk:'Hong Kong',tw:'Taiwan',
  sg:'Singapore',my:'Malaysia',th:'Thailand',ph:'Philippines',id:'Indonesia',
  vn:'Vietnam',nz:'New Zealand',za:'South Africa',ng:'Nigeria',eg:'Egypt',
  sa:'Saudi Arabia',ae:'United Arab Emirates',il:'Israel',ar:'Argentina',
  cl:'Chile',co:'Colombia',pe:'Peru',cr:'Costa Rica',pa:'Panama',ec:'Ecuador',
  gt:'Guatemala',do:'Dominican Republic',jm:'Jamaica',tt:'Trinidad and Tobago',
  ke:'Kenya',ug:'Uganda',tz:'Tanzania',gh:'Ghana',ua:'Ukraine',bg:'Bulgaria',
  hr:'Croatia',sk:'Slovakia',si:'Slovenia',ee:'Estonia',lv:'Latvia',lt:'Lithuania',
  is:'Iceland',lu:'Luxembourg',mt:'Malta',cy:'Cyprus',pk:'Pakistan',bd:'Bangladesh',
  lk:'Sri Lanka',kh:'Cambodia',la:'Laos',mn:'Mongolia',kz:'Kazakhstan',
  uz:'Uzbekistan',by:'Belarus',md:'Moldova',al:'Albania',mk:'Macedonia',
  bh:'Bahrain',jo:'Jordan',kw:'Kuwait',lb:'Lebanon',om:'Oman',qa:'Qatar'
};

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function getSystemCountry() {
  const locale = navigator.language || navigator.languages?.[0] || 'en-US';
  const parts = locale.split('-');
  const code = (parts[1] || parts[0]).toLowerCase();
  return COUNTRIES[code] ? code : 'us';
}

function getSettings() {
  return {
    resolution: parseInt(localStorage.getItem('resolution')) || 600,
    country: localStorage.getItem('country') || getSystemCountry(),
    defaultEntity: localStorage.getItem('defaultEntity') || 'album'
  };
}

function saveSettings() {
  localStorage.setItem('resolution', settingResolution.value || '600');
  localStorage.setItem('country', settingCountry.value);
  localStorage.setItem('defaultEntity', settingDefaultEntity.value);
}

function artworkUrl(thumb, size) {
  return thumb.replace(/\/\d+x\d+bb\.jpg$/, `/${size}x${size}bb.jpg`);
}

function getDisplayUrl(result) {
  return artworkUrl(result.thumb, getSettings().resolution);
}

function getFullResUrl(result) {
  return result.large;
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '_');
}

// --- Drag cache ---

const dragCache = new Map();

function ensureDragCached(result) {
  const key = getDisplayUrl(result);
  if (dragCache.has(key)) return dragCache.get(key);
  const filename = `${sanitizeFilename(result.name)}_${getSettings().resolution}.jpg`;
  const promise = invoke('prepare_drag_image', { url: key, filename });
  dragCache.set(key, promise);
  return promise;
}

function clearDragCache() {
  dragCache.clear();
}

function setupDrag(el, result) {
  let startX, startY, dragging = false;

  el.addEventListener('mouseenter', () => { ensureDragCached(result); });

  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    startX = e.clientX;
    startY = e.clientY;
    dragging = false;
  });

  el.addEventListener('mousemove', async (e) => {
    if (startX == null || dragging) return;
    if (Math.abs(e.clientX - startX) < 5 && Math.abs(e.clientY - startY) < 5) return;

    dragging = true;
    startX = null;

    try {
      const path = await ensureDragCached(result);
      await invoke('plugin:drag|start_drag', {
        item: [path],
        image: TINY_PNG,
        options: { mode: 'copy' },
        onEvent: new Channel()
      });
    } catch {}
  });

  el.addEventListener('mouseup', () => { startX = null; });
  el.addEventListener('mouseleave', () => { startX = null; });
}

// --- Settings ---

function initSettings() {
  const settings = getSettings();
  settingResolution.value = settings.resolution;
  settingDefaultEntity.value = settings.defaultEntity;
  entitySelect.value = settings.defaultEntity;

  const sorted = Object.entries(COUNTRIES).sort((a, b) => a[1].localeCompare(b[1]));
  for (const [code, name] of sorted) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name;
    settingCountry.appendChild(opt);
  }
  settingCountry.value = settings.country;
}

settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  settingsPopover.classList.toggle('hidden');
});

settingResolution.addEventListener('change', () => {
  const val = parseInt(settingResolution.value.replace(/\D/g, '')) || 600;
  settingResolution.value = Math.max(100, Math.min(1500, val));
  saveSettings();
  clearDragCache();
  if (currentResults.length) renderGrid(currentResults);
});

settingCountry.addEventListener('change', () => {
  saveSettings();
  if (searchInput.value.trim()) searchArtwork(searchInput.value);
});

settingDefaultEntity.addEventListener('change', saveSettings);

// --- Search ---

async function searchArtwork(term) {
  if (!term.trim()) {
    grid.innerHTML = '';
    statusEl.textContent = '';
    currentResults = [];
    return;
  }

  const type = entitySelect.value;
  grid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  statusEl.textContent = 'Searching...';

  try {
    const raw = await invoke('search_artwork', { search: term, storefront: getSettings().country, kind: type });
    const data = JSON.parse(raw);
    currentResults = data.images || [];
    clearDragCache();
    renderGrid(currentResults);
    statusEl.textContent = currentResults.length
      ? `${currentResults.length} results for "${term}"`
      : '';
    document.title = `${term} — iTunes Artwork Fetcher`;
  } catch {
    grid.innerHTML = '<div class="empty">Failed to fetch results. Check your connection.</div>';
    statusEl.textContent = '';
  }
}

function renderGrid(results) {
  focusedIndex = -1;
  if (!results.length) {
    grid.innerHTML = '<div class="empty">No artwork found.</div>';
    return;
  }

  grid.innerHTML = '';
  results.forEach((result, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.tabIndex = 0;
    card.dataset.index = i;

    card.innerHTML = `
      <img src="${getDisplayUrl(result)}" alt="${result.name}" loading="lazy" draggable="false">
      <div class="card-label">${result.name}<span>${result.artist}</span></div>
    `;

    card.addEventListener('click', () => openPreview(result));
    card.addEventListener('contextmenu', (e) => showContextMenu(e, result));
    setupDrag(card, result);

    grid.appendChild(card);
  });
}

searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => searchArtwork(searchInput.value), 400);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    clearTimeout(debounceTimer);
    searchArtwork(searchInput.value);
  }
  if (e.key === 'Escape') {
    searchInput.value = '';
    grid.innerHTML = '';
    statusEl.textContent = '';
    currentResults = [];
    document.title = 'iTunes Artwork Fetcher';
  }
});

entitySelect.addEventListener('change', () => {
  if (searchInput.value.trim()) searchArtwork(searchInput.value);
});

// --- Preview ---

let previewResult = null;

function openPreview(result) {
  previewResult = result;
  previewImg.src = getDisplayUrl(result);
  previewImg.draggable = false;
  previewInfo.innerHTML = `${result.name}<span>${result.artist}</span>`;
  previewOverlay.classList.remove('hidden');
  ensureDragCached(result);
}

function closePreview() {
  previewOverlay.classList.add('hidden');
  previewImg.src = '';
  previewResult = null;
}

previewOverlay.addEventListener('click', (e) => {
  if (e.target === previewOverlay) closePreview();
});

setupDrag(previewImg, { get name() { return previewResult?.name || ''; }, get artist() { return previewResult?.artist || ''; }, get thumb() { return previewResult?.thumb || ''; }, get large() { return previewResult?.large || ''; } });

// --- Context Menu ---

function showContextMenu(e, result) {
  e.preventDefault();
  e.stopPropagation();
  contextTarget = result;
  contextMenu.classList.remove('hidden');

  const x = Math.min(e.clientX, window.innerWidth - 200);
  const y = Math.min(e.clientY, window.innerHeight - 200);
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
}

function hideContextMenu() {
  contextMenu.classList.add('hidden');
  contextTarget = null;
}

contextMenu.addEventListener('click', async (e) => {
  const action = e.target.dataset.action;
  if (!action || !contextTarget) return;

  const target = contextTarget;
  const title = sanitizeFilename(target.name);
  const res = getSettings().resolution;

  hideContextMenu();

  try {
    switch (action) {
      case 'copy':
        statusEl.textContent = 'Copying image...';
        await invoke('copy_image', { url: getDisplayUrl(target) });
        statusEl.textContent = 'Image copied to clipboard.';
        break;
      case 'copy-full':
        statusEl.textContent = 'Copying full resolution image...';
        await invoke('copy_image', { url: getFullResUrl(target) });
        statusEl.textContent = 'Full resolution image copied.';
        break;
      case 'save':
        await invoke('save_image', { url: getDisplayUrl(target), filename: `${title}_${res}.jpg` });
        statusEl.textContent = 'Image saved.';
        break;
      case 'save-full':
        await invoke('save_image', { url: getFullResUrl(target), filename: `${title}_full.jpg` });
        statusEl.textContent = 'Full resolution image saved.';
        break;
      case 'open':
        invoke('plugin:shell|open', { path: getFullResUrl(target) });
        break;
    }
  } catch (err) {
    if (err !== 'Save cancelled') {
      statusEl.textContent = `Error: ${err}`;
    }
  }
});

// --- Keyboard ---

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!contextMenu.classList.contains('hidden')) return hideContextMenu();
    if (!previewOverlay.classList.contains('hidden')) return closePreview();
    if (!settingsPopover.classList.contains('hidden')) {
      return settingsPopover.classList.add('hidden');
    }
  }

  if (e.key === 'Tab' && !e.target.closest('header, .popover')) {
    e.preventDefault();
    searchInput.focus();
  }

  if (document.activeElement === searchInput) return;
  if (document.activeElement.closest('.popover')) return;
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) return;

  const cards = [...grid.querySelectorAll('.card')];
  if (!cards.length) return;

  if (e.key === 'Enter' && focusedIndex >= 0) {
    openPreview(currentResults[focusedIndex]);
    return;
  }

  const cols = Math.floor(grid.clientWidth / cards[0].offsetWidth) || 1;

  if (focusedIndex < 0) {
    focusedIndex = 0;
  } else {
    switch (e.key) {
      case 'ArrowRight': focusedIndex = Math.min(focusedIndex + 1, cards.length - 1); break;
      case 'ArrowLeft': focusedIndex = Math.max(focusedIndex - 1, 0); break;
      case 'ArrowDown': focusedIndex = Math.min(focusedIndex + cols, cards.length - 1); break;
      case 'ArrowUp': focusedIndex = Math.max(focusedIndex - cols, 0); break;
    }
  }

  cards[focusedIndex]?.focus();
  e.preventDefault();
});

document.addEventListener('click', (e) => {
  if (!contextMenu.contains(e.target)) hideContextMenu();
  if (!settingsPopover.contains(e.target) && e.target !== settingsBtn) {
    settingsPopover.classList.add('hidden');
  }
});

// --- Init ---
initSettings();
