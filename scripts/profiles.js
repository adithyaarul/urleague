function handleLibraryPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _libraryPhoto = e.target.result;
    document.getElementById('library-photo-preview').textContent = file.name;
  };
  reader.readAsDataURL(file);
}

function addLibraryPlayer() {
  const rawName = document.getElementById('library-name-input').value.trim();
  const role = document.getElementById('library-role-input').value;
  const trivia = document.getElementById('library-trivia-input').value.trim();
  if (!rawName) { toast('Enter a player name.'); return; }
  // Case-insensitive duplicate check — use existing casing if found
  const existing = S.library.findIndex(p => p.name.toLowerCase() === rawName.toLowerCase());
  const name = existing !== -1 ? S.library[existing].name : rawName;
  if (existing !== -1) {
    // update library
    S.library[existing] = { ...S.library[existing], role, trivia, photo: _libraryPhoto || S.library[existing].photo };
    toast(name + ' updated!');
  } else {
    S.library.push({ name, role, trivia, photo: _libraryPhoto || null });
    toast(name + ' saved to registry!');
  }

  // ── Sync to global player registry ──
  const p = _getOrCreatePlayer(name);
  p.name = name;
  p.role = role;
  p.trivia = trivia;
  if (_libraryPhoto) p.photo = _libraryPhoto;

  document.getElementById('library-name-input').value = '';
  document.getElementById('library-trivia-input').value = '';
  document.getElementById('library-photo-preview').textContent = 'No photo selected';
  _libraryPhoto = null;
  save();
  renderLibrary();
  renderProfiles();
}

function editLibraryPlayer(name) {
  const p = S.library.find(lp => lp.name === name);
  if (!p) return;
  document.getElementById('library-name-input').value = p.name;
  document.getElementById('library-role-input').value = p.role || 'All-rounder';
  document.getElementById('library-trivia-input').value = p.trivia || '';
  document.getElementById('library-photo-preview').textContent = p.photo ? 'Photo set' : 'No photo selected';
  _libraryPhoto = p.photo || null;
  toast('Editing ' + name + '. Press Save to update.');
}

function deleteLibraryPlayer(name) {
  if (!confirm('Remove ' + name + ' from registry and profiles?')) return;
  S.library = S.library.filter(p => p.name !== name);
  S.players = S.players.filter(p => p.name !== name);
  S.cricket.players = S.cricket.players.filter(p => p !== name);
  // Remove from match history stats so profile disappears
  S.history = S.history.map(m => {
    if (m.cricketStats && m.cricketStats[name]) {
      delete m.cricketStats[name];
    }
    return m;
  });
  save();
  renderLibrary();
  renderCricketPlayersList();
  renderProfiles();
  toast(name + ' removed.');
}

function clearAllLibraryPlayers() {
  if (!confirm('Remove ALL players from the registry, cricket roster, and profiles?')) return;
  S.library = [];
  S.players = [];
  S.cricket.players = [];
  S.cricket.teamA = [];
  S.cricket.teamB = [];
  // Clear player stats from match history so profiles are fully gone
  S.history = S.history.map(m => {
    if (m.cricketStats) m.cricketStats = {};
    return m;
  });
  save();
  renderLibrary();
  renderCricketPlayersList();
  renderProfiles();
  if (document.getElementById('cricket-teams-output')) {
    document.getElementById('cricket-teams-output').classList.add('hidden');
  }
  toast('All players cleared.');
}

let _currentDetailPlayerName = null;

// ─── Photo Crop System ───
let _cropImg = null;
let _cropX = 0, _cropY = 0, _cropScale = 1;
let _cropDragging = false, _cropLastX = 0, _cropLastY = 0;
let _cropCanvasSize = 300; // logical canvas px

function _updateZoomUI(pct) {
  const sl = document.getElementById('crop-zoom-slider');
  const lb = document.getElementById('crop-zoom-pct');
  if (sl) sl.value = pct;
  if (lb) lb.textContent = pct + '%';
  if (sl) {
    const p = (pct - 50) / (300 - 50) * 100;
    sl.style.background = `linear-gradient(90deg, var(--sport-primary) ${p}%, rgba(255,255,255,.1) ${p}%)`;
  }
}
function _stepZoom(delta) {
  if (!_cropImg) return;
  _cropScale = Math.max(0.5, Math.min(3, _cropScale + delta));
  _updateZoomUI(Math.round(_cropScale * 100));
  drawCrop();
}
function openCropModal(name) {
  _currentDetailPlayerName = name;
  const libPlayer = S.library.find(p => p.name === name) || {};
  document.getElementById('photo-crop-modal').classList.remove('hidden');
  // Set player name in the new UI
  const nameEl = document.getElementById('pse-player-name');
  if (nameEl) nameEl.textContent = name || 'Player';
  _cropScale = 1;
  _updateZoomUI(100);

  if (libPlayer.photo) {
    const img = new Image();
    img.onload = () => {
      _cropImg = img;
      _cropX = 0; _cropY = 0;
      const fw = _cropCanvasSize / img.width;
      const fh = _cropCanvasSize / img.height;
      _cropScale = Math.max(fw, fh);
      _updateZoomUI(Math.round(_cropScale * 100));
      const zs = document.getElementById('pse-zoom-strip');
      if (zs) zs.style.display = 'flex';
      drawCrop();
    };
    img.src = libPlayer.photo;
  } else {
    _cropImg = null;
    const zs = document.getElementById('pse-zoom-strip');
    if (zs) zs.style.display = 'none';
    drawCrop();
  }
  attachCropEvents();
}

function closeCropModal() {
  document.getElementById('photo-crop-modal').classList.add('hidden');
  detachCropEvents();
}

function onCropFileChange(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      _cropImg = img;
      _cropX = 0; _cropY = 0;
      const fw = _cropCanvasSize / img.width;
      const fh = _cropCanvasSize / img.height;
      _cropScale = Math.max(fw, fh);
      _updateZoomUI(Math.round(_cropScale * 100));
      const zs = document.getElementById('pse-zoom-strip');
      if (zs) zs.style.display = 'flex';
      drawCrop();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function onCropZoomSlider(val) {
  if (!_cropImg) return;
  _cropScale = parseFloat(val) / 100;
  _updateZoomUI(Math.round(_cropScale * 100));
  drawCrop();
}

function drawCrop() {
  const c = document.getElementById('crop-canvas');
  if (!c) return;
  const inner = c.parentElement;
  const size = inner ? inner.offsetWidth : 142;
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  if (!_cropImg) {
    ctx.fillStyle = '#0d1420';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(148,163,184,.22)';
    ctx.font = '700 11px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No photo', size/2, size/2 + 18);
    ctx.fillStyle = 'rgba(148,163,184,.35)';
    ctx.font = '28px ti'; // tabler icon font fallback
    ctx.fillText('👤', size/2, size/2 - 8);
    return;
  }

  const ratio = size / _cropCanvasSize;
  const drawW = _cropImg.width * _cropScale * ratio;
  const drawH = _cropImg.height * _cropScale * ratio;
  const dx = (size - drawW) / 2 + _cropX * ratio;
  const dy = (size - drawH) / 2 + _cropY * ratio;

  ctx.fillStyle = '#0d1420';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(_cropImg, dx, dy, drawW, drawH);
}

function saveCroppedPhoto() {
  if (!_cropImg) { toast('No photo to save.'); return; }
  const OUT = 300;
  const c = document.createElement('canvas');
  c.width = OUT; c.height = OUT;
  const ctx = c.getContext('2d');

  const drawW = _cropImg.width * _cropScale;
  const drawH = _cropImg.height * _cropScale;
  const dx = (OUT - drawW) / 2 + _cropX;
  const dy = (OUT - drawH) / 2 + _cropY;

  ctx.fillStyle = '#0d1420';
  ctx.fillRect(0, 0, OUT, OUT);
  ctx.drawImage(_cropImg, dx, dy, drawW, drawH);

  const dataUrl = c.toDataURL('image/jpeg', 0.88);
  const name = _currentDetailPlayerName;
  const idx = S.library.findIndex(p => p.name === name);
  if (idx !== -1) {
    S.library[idx].photo = dataUrl;
  } else {
    S.library.push({ name, role: 'All-rounder', trivia: '', photo: dataUrl });
  }
  // Sync to global player registry
  const gp = _getOrCreatePlayer(name);
  gp.photo = dataUrl;
  save();
  renderProfiles();
  renderLibrary();
  closeCropModal();
  // Refresh the detail modal with new photo
  showPlayerDetail(name);
  toast('Photo updated!');
}

function removePlayerPhoto() {
  const name = _currentDetailPlayerName;
  if (!name) return;
  const idx = S.library.findIndex(p => p.name === name);
  if (idx !== -1) S.library[idx].photo = null;
  // Sync to global player registry
  const gp = _getOrCreatePlayer(name);
  gp.photo = null;
  _cropImg = null;
  drawCrop();
  save();
  renderProfiles();
  renderLibrary();
  closeCropModal();
  showPlayerDetail(name);
  toast('Photo removed.');
}

// ─── Drag events ───
function _cropPointerDown(e) {
  _cropDragging = true;
  const pt = e.touches ? e.touches[0] : e;
  _cropLastX = pt.clientX;
  _cropLastY = pt.clientY;
  const c = document.getElementById('crop-canvas');
  if (c) c.style.cursor = 'grabbing';
}
function _cropPointerMove(e) {
  if (!_cropDragging || !_cropImg) return;
  e.preventDefault();
  const pt = e.touches ? e.touches[0] : e;
  _cropX += pt.clientX - _cropLastX;
  _cropY += pt.clientY - _cropLastY;
  _cropLastX = pt.clientX;
  _cropLastY = pt.clientY;
  drawCrop();
}
function _cropPointerUp() {
  _cropDragging = false;
  const c = document.getElementById('crop-canvas');
  if (c) c.style.cursor = 'grab';
}
function _cropWheel(e) {
  e.preventDefault();
  if (!_cropImg) return;
  const delta = e.deltaY > 0 ? -0.05 : 0.05;
  _cropScale = Math.max(0.5, Math.min(3, _cropScale + delta));
  document.getElementById('crop-zoom-slider').value = Math.round(_cropScale * 100);
  drawCrop();
}

// Pinch-to-zoom
let _pinchDist = 0;
function _cropTouchStart(e) {
  if (e.touches.length === 2) {
    _pinchDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
  }
}
function _cropTouchMove(e) {
  if (e.touches.length === 2 && _cropImg) {
    e.preventDefault();
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const ratio = dist / _pinchDist;
    _cropScale = Math.max(0.5, Math.min(3, _cropScale * ratio));
    _pinchDist = dist;
    document.getElementById('crop-zoom-slider').value = Math.round(_cropScale * 100);
    drawCrop();
  }
}

function attachCropEvents() {
  const wrap = document.getElementById('crop-canvas');
  if (!wrap) return;
  wrap.addEventListener('mousedown', _cropPointerDown);
  window.addEventListener('mousemove', _cropPointerMove);
  window.addEventListener('mouseup', _cropPointerUp);
  wrap.addEventListener('touchstart', _cropPointerDown, { passive: false });
  wrap.addEventListener('touchstart', _cropTouchStart, { passive: false });
  wrap.addEventListener('touchmove', _cropPointerMove, { passive: false });
  wrap.addEventListener('touchmove', _cropTouchMove, { passive: false });
  wrap.addEventListener('touchend', _cropPointerUp);
  wrap.addEventListener('wheel', _cropWheel, { passive: false });
}
function detachCropEvents() {
  const wrap = document.getElementById('crop-canvas');
  if (!wrap) return;
  wrap.removeEventListener('mousedown', _cropPointerDown);
  window.removeEventListener('mousemove', _cropPointerMove);
  window.removeEventListener('mouseup', _cropPointerUp);
  wrap.removeEventListener('touchstart', _cropPointerDown);
  wrap.removeEventListener('touchstart', _cropTouchStart);
  wrap.removeEventListener('touchmove', _cropPointerMove);
  wrap.removeEventListener('touchmove', _cropTouchMove);
  wrap.removeEventListener('touchend', _cropPointerUp);
  wrap.removeEventListener('wheel', _cropWheel);
}

function deletePlayerFromDetail() {
  if (!_currentDetailPlayerName) return;
  const name = _currentDetailPlayerName;
  if (!confirm('Remove ' + name + ' from registry and profiles?')) return;
  S.library = S.library.filter(p => p.name !== name);
  S.players = S.players.filter(p => p.name !== name);
  S.cricket.players = S.cricket.players.filter(p => p !== name);
  S.history = S.history.map(m => {
    if (m.cricketStats && m.cricketStats[name]) {
      delete m.cricketStats[name];
    }
    return m;
  });
  save();
  renderLibrary();
  renderCricketPlayersList();
  renderProfiles();
  closeModal('player-detail-modal');
  toast(name + ' removed.');
}

function renderLibrary() {
  const el = document.getElementById('library-list');
  if (!el) return;
  const clearWrap = document.getElementById('library-clear-wrap');
  if (!S.library.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0;">No players saved yet.</div>';
    if (clearWrap) clearWrap.style.display = 'none';
    return;
  }
  if (clearWrap) clearWrap.style.display = '';
  el.innerHTML = S.library.map(p => `
    <div class="library-card" style="display:flex;align-items:center;gap:10px;margin-bottom:8px;" onclick="editLibraryPlayer('${esc(p.name)}')">
      <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#1e2a52,#2b3a7a);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">
        ${p.photo ? `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;"/>` : `<span style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;color:rgba(148,163,184,.4);">${esc(p.name.charAt(0).toUpperCase())}</span>`}
      </div>
      <div style="flex:1;min-width:0;">
        <div class="library-card-name">${esc(p.name)}</div>
        <div class="library-card-meta">${esc(p.role || 'All-rounder')}${p.trivia ? ' · ' + esc(p.trivia) : ''}</div>
      </div>
      <button class="btn xs danger" onclick="event.stopPropagation();deleteLibraryPlayer('${esc(p.name)}')">&times;</button>
    </div>`
  ).join('');
}

// ─── Profile sport filter ───
let _profileSportFilter = 'all';
function setProfileSportFilter(sport) {
  _profileSportFilter = sport;
  ['all','cricket','football','badminton'].forEach(s => {
    const btn = document.getElementById('prof-filter-' + s);
    if (btn) btn.classList.toggle('active-filter', s === sport);
  });
  renderProfiles();
}

// ─── setRosterSort ───
function setRosterSort(val) {
  _rosterSort = val;
  renderProfiles();
}

// ─── Compute sport-appropriate rating ───
function computePlayerRating(s, sport) {
  sport = sport || 'cricket';
  if (!s || s.matches === 0) return 0;
  if (sport === 'cricket') {
    const batScore = (s.runs / Math.max(1, s.matches)) * 0.18 + (s.sixes / Math.max(1, s.matches)) * 1.2 + (s.fifties / Math.max(1, s.matches)) * 6 + (s.hundreds / Math.max(1, s.matches)) * 12;
    const sr = s.balls > 0 ? (s.runs / s.balls) * 100 : 0;
    const srBonus = sr > 200 ? 2 : sr > 150 ? 1.2 : sr > 100 ? 0.5 : 0;
    const bowlScore = (s.wickets / Math.max(1, s.matches)) * 5 + (s.potm / Math.max(1, s.matches)) * 4;
    return Math.min(10, Math.max(0, parseFloat((batScore + srBonus + bowlScore).toFixed(1))));
  }
  if (sport === 'football') {
    const raw = (s.goals / Math.max(1, s.matches)) * 4 + (s.assists / Math.max(1, s.matches)) * 2 - (s.yellowCards / Math.max(1, s.matches)) * 0.5 - (s.redCards / Math.max(1, s.matches)) * 2;
    return Math.min(10, Math.max(0, parseFloat(raw.toFixed(1))));
  }
  if (sport === 'badminton') {
    const wr = s.wins / Math.max(1, s.matches);
    return Math.min(10, Math.max(0, parseFloat((wr * 8 + (s.setsWon / Math.max(1, s.matches)) * 0.5).toFixed(1))));
  }
  return 0;
}

// ─── renderProfiles ── sport-context-aware: always shows stats for the active sport ───
function renderProfiles() {
  const el = document.getElementById('profiles-list');
  if (!el) return;

  _rebuildPlayerCricketStatsFromHistory();

  const contextSport = S.sport || _profileSportFilter !== 'all' ? (_profileSportFilter !== 'all' ? _profileSportFilter : null) : null;

  const allStats = computeCricketAllStats();
  const allNames = new Set([
    ...S.players.map(p => p.name),
    ...Object.keys(allStats),
    ...S.cricket.players,
  ]);

  if (!allNames.size) {
    el.innerHTML = '<div class="alert info" style="font-size:12px;">Add players to the registry or play matches to see profiles here.</div>';
    return;
  }

  let entries = [...allNames].map(name => {
    const gp = _getOrCreatePlayer(name);
    const libPlayer = S.library.find(p => p.name === name) || {};
    const photo = gp.photo || libPlayer.photo || null;
    const role = gp.role || libPlayer.role || 'All-rounder';
    const activeCricket  = gp.cricket.matches > 0;
    const activeFootball = gp.football.matches > 0;
    const activeBadminton = gp.badminton.matches > 0;
    // Determine which sport's stats to feature on the card
    const featuredSport = contextSport || (activeCricket ? 'cricket' : activeFootball ? 'football' : activeBadminton ? 'badminton' : 'cricket');
    const rating = computePlayerRating(gp[featuredSport] || gp.cricket, featuredSport);
    return { name, gp, libPlayer, photo, role, activeCricket, activeFootball, activeBadminton, featuredSport, rating };
  });

  // Filter by sport context
  if (_profileSportFilter !== 'all') {
    entries = entries.filter(e => {
      if (_profileSportFilter === 'cricket') return e.activeCricket;
      if (_profileSportFilter === 'football') return e.activeFootball;
      if (_profileSportFilter === 'badminton') return e.activeBadminton;
      return true;
    });
  } else if (S.sport) {
    // Inside a sport arena — show all players but sort by that sport's activity
    entries.sort((a, b) => {
      const aActive = a['active' + S.sport.charAt(0).toUpperCase() + S.sport.slice(1)] ? 1 : 0;
      const bActive = b['active' + S.sport.charAt(0).toUpperCase() + S.sport.slice(1)] ? 1 : 0;
      return bActive - aActive || a.name.localeCompare(b.name);
    });
  }

  if (!entries.length) {
    el.innerHTML = `<div class="alert info" style="font-size:12px;">No players with ${_profileSportFilter} data yet.</div>`;
    return;
  }

  if (_rosterSort === 'rating') {
    entries.sort((a, b) => b.rating - a.rating);
  } else if (!S.sport) {
    entries.sort((a, b) => a.name.localeCompare(b.name));
  }

  const topRated = entries[0]?.name;

  el.innerHTML = `<div class="profiles-grid">${entries.map(({ name, gp, libPlayer, photo, role, activeCricket, activeFootball, activeBadminton, featuredSport, rating }) => {
    const initial = name.charAt(0).toUpperCase();
    const isTop = name === topRated && rating > 0 && _rosterSort === 'rating';

    const avatarHtml = photo
      ? `<img src="${photo}" alt="${esc(name)}"/>`
      : `<div class="profile-card-initial">${esc(initial)}</div>`;

    // Sport activity dots
    const sportDots = `<div class="profile-sport-dots">
      <div class="psport-dot ${activeCricket ? 'c' : 'off'}" title="Cricket">C</div>
      <div class="psport-dot ${activeFootball ? 'f' : 'off'}" title="Football">F</div>
      <div class="psport-dot ${activeBadminton ? 'b' : 'off'}" title="Badminton">B</div>
    </div>`;

    // Build stat row for the FEATURED SPORT ONLY — no mixing
    let statRow, badges = '';
    if (featuredSport === 'cricket' && activeCricket) {
      const s = gp.cricket;
      const sr = s.balls > 0 ? Math.round((s.runs / s.balls) * 100) : 0;
      const potmBadge = s.potm > 0 ? `<span class="profile-badge-potm"><i class="ti ti-star-filled" style="color:#ffd700;font-size:10px;vertical-align:-1px;margin-right:2px;"></i>POTM</span>` : '';
      const threewBadge = s.threefers > 0 ? `<span class="profile-badge-threew"><i class="ti ti-bowling" style="color:#a78bfa;font-size:10px;vertical-align:-1px;margin-right:2px;"></i>3W</span>` : '';
      if (potmBadge || threewBadge) badges = `<div class="profile-card-badges">${potmBadge}${threewBadge}</div>`;
      statRow = `<div class="profile-stat-row">
        <div class="profile-stat-box"><div class="profile-stat-val">${s.runs}</div><div class="profile-stat-lbl">Runs</div></div>
        <div class="profile-stat-box"><div class="profile-stat-val">${s.wickets}</div><div class="profile-stat-lbl">Wkts</div></div>
        <div class="profile-stat-box"><div class="profile-stat-val">${sr}</div><div class="profile-stat-lbl">SR</div></div>
        <div class="profile-stat-box"><div class="profile-stat-val">${s.matches}</div><div class="profile-stat-lbl">M</div></div>
      </div>`;
    } else if (featuredSport === 'football' && activeFootball) {
      const s = gp.football;
      statRow = `<div class="profile-stat-row">
        <div class="profile-stat-box"><div class="profile-stat-val" style="color:var(--football-primary)">${s.goals}</div><div class="profile-stat-lbl">Goals</div></div>
        <div class="profile-stat-box"><div class="profile-stat-val">${s.assists}</div><div class="profile-stat-lbl">Asst</div></div>
        <div class="profile-stat-box"><div class="profile-stat-val">${s.matches}</div><div class="profile-stat-lbl">M</div></div>
        <div class="profile-stat-box"><div class="profile-stat-val" style="color:var(--amber)">${s.yellowCards}</div><div class="profile-stat-lbl">YC</div></div>
      </div>`;
    } else if (featuredSport === 'badminton' && activeBadminton) {
      const s = gp.badminton;
      const wr = s.matches > 0 ? Math.round((s.wins / s.matches) * 100) : 0;
      statRow = `<div class="profile-stat-row">
        <div class="profile-stat-box"><div class="profile-stat-val" style="color:var(--badminton-primary)">${s.wins}</div><div class="profile-stat-lbl">Wins</div></div>
        <div class="profile-stat-box"><div class="profile-stat-val">${s.losses}</div><div class="profile-stat-lbl">Loss</div></div>
        <div class="profile-stat-box"><div class="profile-stat-val">${s.setsWon}</div><div class="profile-stat-lbl">Sets W</div></div>
        <div class="profile-stat-box"><div class="profile-stat-val">${wr}%</div><div class="profile-stat-lbl">W%</div></div>
      </div>`;
    } else {
      statRow = `<div style="font-size:11px;color:var(--text3);padding:6px 0;text-align:center;">No ${featuredSport} data yet</div>`;
    }

    // Sport label chip on card — show which sport these stats belong to
    const sportChip = `<div style="font-size:9px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--text3);margin-bottom:3px;">${featuredSport} profile</div>`;

    // When tapped, open directly to the correct sport tab
    return `
      <div class="profile-card ${isTop ? 'top-rated' : ''}" onclick="showPlayerDetail('${esc(name)}','${featuredSport}')">
        <div class="profile-card-avatar">
          ${avatarHtml}
          <div class="profile-card-rating"><i class="ti ti-star-filled"></i>${rating > 0 ? rating.toFixed(1) : '—'}</div>
        </div>
        <div class="profile-card-body">
          <div class="profile-card-name">${esc(name)}</div>
          <div class="profile-card-role">${esc(role)}</div>
          ${sportDots}
          ${badges}
          ${sportChip}
          ${statRow}
        </div>
      </div>`;
  }).join('')}</div>`;
}

// ─── showPlayerDetail — opens to correct sport tab based on context ───
let _currentDetailTab = 'overview';

function showPlayerDetail(name, openSport) {
  _currentDetailPlayerName = name;
  _rebuildPlayerCricketStatsFromHistory();

  const gp = _getOrCreatePlayer(name);
  const libPlayer = S.library.find(p => p.name === name) || {};
  const photo = gp.photo || libPlayer.photo || null;
  const role = gp.role || libPlayer.role || 'All-rounder';

  const activeSports = [];
  if (gp.cricket.matches > 0) activeSports.push('cricket');
  if (gp.football.matches > 0) activeSports.push('football');
  if (gp.badminton.matches > 0) activeSports.push('badminton');

  // Choose which sport to open to:
  // 1. Explicit arg (from card tap), 2. Current arena sport, 3. Only active sport, 4. Overview
  const arenaSport = S.sport;
  let defaultTab = 'overview';
  if (openSport && (activeSports.includes(openSport) || openSport === 'overview')) {
    defaultTab = openSport;
  } else if (arenaSport && activeSports.includes(arenaSport)) {
    defaultTab = arenaSport;
  } else if (activeSports.length === 1) {
    defaultTab = activeSports[0];
  }
  _currentDetailTab = defaultTab;

  const avatarHtml = photo
    ? `<img src="${photo}" alt="${esc(name)}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;"/>`
    : `<div class="pdetail-identity-initial">${esc(name.charAt(0).toUpperCase())}</div>`;

  const colMap = { cricket:'var(--cricket-primary)', football:'var(--football-primary)', badminton:'var(--badminton-primary)' };
  const bgMap  = { cricket:'var(--cricket-pl)', football:'var(--football-pl)', badminton:'var(--badminton-pl)' };
  const bdMap  = { cricket:'var(--cricket-border)', football:'var(--football-border)', badminton:'var(--badminton-border)' };

  const sportTagsHtml = activeSports.length
    ? activeSports.map(sp => `<span onclick="showPlayerDetailTab('${sp}')" style="font-size:10px;font-weight:800;letter-spacing:.04em;padding:2px 7px;border-radius:999px;background:${bgMap[sp]};color:${colMap[sp]};border:1px solid ${bdMap[sp]};text-transform:uppercase;cursor:pointer;">${sp}</span>`).join('')
    : '<span style="font-size:10px;color:var(--text3);">No matches yet</span>';

  document.getElementById('player-detail-identity').innerHTML = `
    <div class="pdetail-identity-wrap">
      <div class="pdetail-identity-avatar" onclick="openCropModal('${esc(name)}')" title="Edit photo">
        ${avatarHtml}
        <div class="pdetail-identity-avatar-edit"><i class="ti ti-camera"></i></div>
      </div>
      <div class="pdetail-identity-info">
        <div class="pdetail-identity-name">${esc(name)}</div>
        <div class="pdetail-identity-meta">${esc(role)}${libPlayer.trivia ? ' · ' + esc(libPlayer.trivia) : ''}</div>
        <div class="pdetail-identity-sports" style="margin-top:5px;">${sportTagsHtml}</div>
      </div>
    </div>`;

  // Show/hide sport tabs — only show tabs for sports the player actually plays
  ['cricket','football','badminton'].forEach(sp => {
    const tabEl = document.getElementById('pdt-' + sp);
    if (tabEl) tabEl.style.display = activeSports.includes(sp) ? '' : 'none';
  });
  // Hide Overview tab if player only plays one sport (go straight to it)
  const overviewTab = document.getElementById('pdt-overview');
  if (overviewTab) overviewTab.style.display = activeSports.length <= 1 ? 'none' : '';

  showPlayerDetailTab(defaultTab);
  openModal('player-detail-modal');
}

function showPlayerDetailTab(tab) {
  _currentDetailTab = tab;
  ['overview','cricket','football','badminton'].forEach(t => {
    const el = document.getElementById('pdt-' + t);
    if (el) { el.classList.toggle('active', t === tab); el.setAttribute('data-sport', t); }
  });
  const name = _currentDetailPlayerName;
  if (!name) return;
  const gp = _getOrCreatePlayer(name);
  const libPlayer = S.library.find(p => p.name === name) || {};
  const contentEl = document.getElementById('player-detail-content');
  if (tab === 'overview')       _renderPlayerDetailOverview(name, gp, libPlayer, contentEl);
  else if (tab === 'cricket')   _renderPlayerDetailCricket(name, gp, libPlayer, contentEl);
  else if (tab === 'football')  _renderPlayerDetailFootball(name, gp, contentEl);
  else if (tab === 'badminton') _renderPlayerDetailBadminton(name, gp, contentEl);
}

function _renderPlayerDetailOverview(name, gp, libPlayer, el) {
  const activeSportRows = [
    { sport:'cricket',   icon:'ti-cricket',      label:'Cricket',
      active:gp.cricket.matches>0,
      summary:gp.cricket.matches>0 ? `${gp.cricket.matches}M · ${gp.cricket.runs} runs · ${gp.cricket.wickets} wkts` : null },
    { sport:'football',  icon:'ti-ball-football', label:'Football',
      active:gp.football.matches>0,
      summary:gp.football.matches>0 ? `${gp.football.matches}M · ${gp.football.goals} goals · ${gp.football.yellowCards} YC` : null },
    { sport:'badminton', icon:'ti-ping-pong',     label:'Badminton',
      active:gp.badminton.matches>0,
      summary:gp.badminton.matches>0 ? `${gp.badminton.matches}M · ${gp.badminton.wins}W–${gp.badminton.losses}L` : null },
  ].filter(r => r.active);
  const totalMatches = gp.cricket.matches + gp.football.matches + gp.badminton.matches;
  el.innerHTML = `
    <div style="font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text3);margin-bottom:10px;">${activeSportRows.length} Sport Profile${activeSportRows.length!==1?'s':''} · ${totalMatches} Total Matches</div>
    ${activeSportRows.map(r=>`
      <div class="pdetail-overview-sport-row" onclick="showPlayerDetailTab('${r.sport}')" style="cursor:pointer;">
        <div class="pdetail-overview-sport-icon ${r.sport}"><i class="ti ${r.icon}"></i></div>
        <div class="pdetail-overview-sport-body">
          <div class="pdetail-overview-sport-name">${r.label}</div>
          <div class="pdetail-overview-sport-sub">${r.summary}</div>
        </div>
        <div class="pdetail-overview-sport-badge active">Active</div>
        <i class="ti ti-chevron-right" style="color:var(--text3);font-size:14px;flex-shrink:0;"></i>
      </div>`).join('')}
    ${activeSportRows.length===0?'<div class="pdetail-no-stats"><i class="ti ti-user"></i>No matches played yet in any sport.</div>':''}
    <div style="font-size:10px;color:var(--text3);margin-top:10px;padding:8px;background:var(--surface-3);border-radius:8px;border:1px solid var(--border);">
      <i class="ti ti-lock" style="vertical-align:-2px;margin-right:4px;"></i>Each sport profile is fully isolated — stats are never mixed.
    </div>`;
}

function _renderPlayerDetailCricket(name, gp, libPlayer, el) {
  const s = gp.cricket;
  if (s.matches === 0) {
    el.innerHTML = `<div class="pdetail-no-stats"><i class="ti ti-cricket"></i>No cricket profile yet.<br><span style="font-size:10px;opacity:.6;">Play cricket matches with ${esc(name)} to build this profile.</span></div>
      ${_buildOtherSportsHtml(name, gp, 'cricket')}`;
    return;
  }
  const sr = s.balls>0 ? ((s.runs/s.balls)*100).toFixed(1) : '0';
  const avg = s.outs>0 ? (s.runs/s.outs).toFixed(1) : s.runs>0 ? s.runs : '—';
  const boundaries = (s.fours||0)+(s.sixes||0);
  const boundaryPct = s.balls>0&&s.runs>0 ? (((s.fours*4+s.sixes*6)/s.runs)*100).toFixed(0) : 0;
  const bowlBalls = s.wickets>0 ? (s.wickets*12) : 0;
  const economy = s.runsConceded>0&&bowlBalls>0 ? ((s.runsConceded/bowlBalls)*6).toFixed(2) : '—';
  const bowlAvg = s.wickets>0 ? (s.runsConceded/s.wickets).toFixed(1) : '—';
  const srColor = parseFloat(sr)>=200?'hi':parseFloat(sr)>=150?'green':parseFloat(sr)>=100?'blue':'';
  const rating = computePlayerRating(s);
  const achievements = [];
  if (s.potm>0)      achievements.push({icon:'<i class="ti ti-star-filled" style="color:#ffd700"></i>',title:'Player of the Match',sub:`${s.potm} award${s.potm>1?'s':''}`});
  if (s.threefers>0) achievements.push({icon:'<i class="ti ti-bowling" style="color:#a78bfa"></i>',title:'Three-fer',sub:`${s.threefers} haul${s.threefers>1?'s':''}`});
  if (s.hundreds>0)  achievements.push({icon:'<i class="ti ti-circle-check" style="color:#4ade80"></i>',title:'Century',sub:`${s.hundreds}`});
  if (s.fifties>0)   achievements.push({icon:'5️⃣0️⃣',title:'Half-Century',sub:`${s.fifties}`});
  if (s.sixes>=5)    achievements.push({icon:'<i class="ti ti-bolt" style="color:#fbbf24"></i>',title:'Six Machine',sub:`${s.sixes} sixes`});
  if (libPlayer.trivia) achievements.push({icon:'<i class="ti ti-bulb" style="color:#38bdf8"></i>',title:'Fun Fact',sub:libPlayer.trivia});
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div style="background:var(--cricket-pl);color:var(--cricket-primary);border:1px solid var(--cricket-border);padding:3px 10px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;">Cricket Profile</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:1.4rem;font-weight:900;color:var(--amber);">★ ${rating>0?rating.toFixed(1):'—'}</div>
    </div>
    <div class="pdetail-section-title"><i class="ti ti-cricket"></i> BATTING</div>
    <div class="pdetail-stats-grid">
      <div class="pdetail-stat-box"><div class="pdetail-stat-val green">${s.runs}</div><div class="pdetail-stat-lbl">Runs</div></div>
      <div class="pdetail-stat-box"><div class="pdetail-stat-val">${s.matches}</div><div class="pdetail-stat-lbl">Matches</div></div>
      <div class="pdetail-stat-box"><div class="pdetail-stat-val">${s.innings||s.matches}</div><div class="pdetail-stat-lbl">Innings</div></div>
      <div class="pdetail-stat-box"><div class="pdetail-stat-val">${s.balls||0}</div><div class="pdetail-stat-lbl">Balls</div></div>
      <div class="pdetail-stat-box"><div class="pdetail-stat-val ${srColor}">${sr}</div><div class="pdetail-stat-lbl">Strike Rate</div></div>
      <div class="pdetail-stat-box"><div class="pdetail-stat-val">${avg}</div><div class="pdetail-stat-lbl">Average</div></div>
      <div class="pdetail-stat-box"><div class="pdetail-stat-val green">${s.bestScore||0}</div><div class="pdetail-stat-lbl">Best</div></div>
      <div class="pdetail-stat-box"><div class="pdetail-stat-val hi">${s.sixes||0}</div><div class="pdetail-stat-lbl">Sixes</div></div>
      <div class="pdetail-stat-box"><div class="pdetail-stat-val blue">${s.fours||0}</div><div class="pdetail-stat-lbl">Fours</div></div>
      <div class="pdetail-stat-box"><div class="pdetail-stat-val">${boundaries}</div><div class="pdetail-stat-lbl">Boundaries</div></div>
      <div class="pdetail-stat-box"><div class="pdetail-stat-val hi">${s.fifties||0}</div><div class="pdetail-stat-lbl">50s</div></div>
      <div class="pdetail-stat-box"><div class="pdetail-stat-val hi">${s.hundreds||0}</div><div class="pdetail-stat-lbl">100s</div></div>
      <div class="pdetail-stat-box"><div class="pdetail-stat-val">${s.outs||0}</div><div class="pdetail-stat-lbl">Outs</div></div>
      <div class="pdetail-stat-box"><div class="pdetail-stat-val">${boundaryPct>0?boundaryPct+'%':'—'}</div><div class="pdetail-stat-lbl">Bdry %</div></div>
    </div>
    <div class="pdetail-section-title"><i class="ti ti-target-arrow"></i> BOWLING</div>
    <div class="pdetail-stats-grid">
      <div class="pdetail-stat-box"><div class="pdetail-stat-val green">${s.wickets||0}</div><div class="pdetail-stat-lbl">Wickets</div></div>
      <div class="pdetail-stat-box"><div class="pdetail-stat-val">${s.runsConceded||0}</div><div class="pdetail-stat-lbl">Runs Given</div></div>
      <div class="pdetail-stat-box"><div class="pdetail-stat-val">${economy}</div><div class="pdetail-stat-lbl">Economy</div></div>
      <div class="pdetail-stat-box"><div class="pdetail-stat-val">${bowlAvg}</div><div class="pdetail-stat-lbl">Bowl Avg</div></div>
      <div class="pdetail-stat-box"><div class="pdetail-stat-val hi">${s.threefers||0}</div><div class="pdetail-stat-lbl">3-Fers</div></div>
      <div class="pdetail-stat-box"><div class="pdetail-stat-val hi">${s.fifers||0}</div><div class="pdetail-stat-lbl">5-Fers</div></div>
    </div>
    ${achievements.length?`<div class="pdetail-section-title"><i class="ti ti-medal"></i> ACHIEVEMENTS</div>
    <div class="pdetail-achieve-list">${achievements.map(a=>`<div class="pdetail-achieve"><div class="pdetail-achieve-icon">${a.icon}</div><div class="pdetail-achieve-info"><div class="pdetail-achieve-title">${esc(a.title)}</div><div class="pdetail-achieve-sub">${esc(a.sub)}</div></div></div>`).join('')}</div>`:''}
    ${_buildOtherSportsHtml(name, gp, 'cricket')}`;
}

function _renderPlayerDetailFootball(name, gp, el) {
  const s = gp.football;
  if (s.matches === 0) {
    el.innerHTML = `<div class="pdetail-no-stats"><i class="ti ti-ball-football"></i>No football profile yet.<br><span style="font-size:10px;opacity:.6;">Add ${esc(name)} to a squad and play football matches.</span></div>
      ${_buildOtherSportsHtml(name, gp, 'football')}`;
    return;
  }
  const gpg = s.matches>0 ? (s.goals/s.matches).toFixed(2) : '0';
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div style="background:var(--football-pl);color:var(--football-primary);border:1px solid var(--football-border);padding:3px 10px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;">Football Profile</div>
      <div style="font-size:11px;color:var(--text3);">${s.matches} match${s.matches!==1?'es':''}</div>
    </div>
    <div class="pdetail-section-title"><i class="ti ti-ball-football"></i> ATTACKING</div>
    <div class="pdetail-fb-stats-grid">
      <div class="pdetail-fb-stat-box"><div class="pdetail-fb-stat-val goal">${s.goals}</div><div class="pdetail-fb-stat-lbl">Goals</div></div>
      <div class="pdetail-fb-stat-box"><div class="pdetail-fb-stat-val">${s.assists}</div><div class="pdetail-fb-stat-lbl">Assists</div></div>
      <div class="pdetail-fb-stat-box"><div class="pdetail-fb-stat-val" style="color:var(--football-primary)">${gpg}</div><div class="pdetail-fb-stat-lbl">Goals/M</div></div>
    </div>
    <div class="pdetail-section-title"><i class="ti ti-cards"></i> DISCIPLINE</div>
    <div class="pdetail-fb-stats-grid">
      <div class="pdetail-fb-stat-box"><div class="pdetail-fb-stat-val" style="color:var(--amber)">${s.yellowCards}</div><div class="pdetail-fb-stat-lbl">Yellow Cards</div></div>
      <div class="pdetail-fb-stat-box"><div class="pdetail-fb-stat-val" style="color:var(--red)">${s.redCards}</div><div class="pdetail-fb-stat-lbl">Red Cards</div></div>
      <div class="pdetail-fb-stat-box"><div class="pdetail-fb-stat-val">${s.fouls}</div><div class="pdetail-fb-stat-lbl">Fouls</div></div>
    </div>
    ${s.goals>=5?`<div class="pdetail-section-title"><i class="ti ti-medal"></i> ACHIEVEMENTS</div>
    <div class="pdetail-achieve-list">
      ${s.goals>=10?'<div class="pdetail-achieve"><div class="pdetail-achieve-icon"><i class="ti ti-ball-football" style="color:var(--football-primary)"></i></div><div class="pdetail-achieve-info"><div class="pdetail-achieve-title">Double Figures</div><div class="pdetail-achieve-sub">'+s.goals+' goals scored</div></div></div>':''}
      ${s.goals>=5?'<div class="pdetail-achieve"><div class="pdetail-achieve-icon"><i class="ti ti-flame" style="color:#fb923c"></i></div><div class="pdetail-achieve-info"><div class="pdetail-achieve-title">Goal Machine</div><div class="pdetail-achieve-sub">'+s.goals+' goals across '+s.matches+' matches</div></div></div>':''}
    </div>`:''}
    ${_buildOtherSportsHtml(name, gp, 'football')}`;
}

function _renderPlayerDetailBadminton(name, gp, el) {
  const s = gp.badminton;
  if (s.matches === 0) {
    el.innerHTML = `<div class="pdetail-no-stats"><i class="ti ti-ping-pong"></i>No badminton profile yet.<br><span style="font-size:10px;opacity:.6;">Play badminton matches with ${esc(name)} to build this profile.</span></div>
      ${_buildOtherSportsHtml(name, gp, 'badminton')}`;
    return;
  }
  const winRate = s.matches>0 ? Math.round((s.wins/s.matches)*100) : 0;
  const totalSets = s.setsWon+s.setsLost;
  const setWinRate = totalSets>0 ? Math.round((s.setsWon/totalSets)*100) : 0;
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div style="background:var(--badminton-pl);color:var(--badminton-primary);border:1px solid var(--badminton-border);padding:3px 10px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;">Badminton Profile</div>
      <div style="font-size:11px;color:var(--text3);">${s.matches} match${s.matches!==1?'es':''}</div>
    </div>
    <div class="pdetail-section-title"><i class="ti ti-ping-pong"></i> MATCH RECORD</div>
    <div class="pdetail-bd-stats-grid">
      <div class="pdetail-bd-stat-box"><div class="pdetail-bd-stat-val win">${s.wins}</div><div class="pdetail-bd-stat-lbl">Wins</div></div>
      <div class="pdetail-bd-stat-box"><div class="pdetail-bd-stat-val">${s.losses}</div><div class="pdetail-bd-stat-lbl">Losses</div></div>
      <div class="pdetail-bd-stat-box"><div class="pdetail-bd-stat-val win">${winRate}%</div><div class="pdetail-bd-stat-lbl">Win Rate</div></div>
    </div>
    <div class="pdetail-section-title"><i class="ti ti-chart-bar"></i> SETS</div>
    <div class="pdetail-bd-stats-grid">
      <div class="pdetail-bd-stat-box"><div class="pdetail-bd-stat-val win">${s.setsWon}</div><div class="pdetail-bd-stat-lbl">Sets Won</div></div>
      <div class="pdetail-bd-stat-box"><div class="pdetail-bd-stat-val">${s.setsLost}</div><div class="pdetail-bd-stat-lbl">Sets Lost</div></div>
      <div class="pdetail-bd-stat-box"><div class="pdetail-bd-stat-val">${setWinRate}%</div><div class="pdetail-bd-stat-lbl">Set Win %</div></div>
    </div>
    ${winRate>=70?`<div class="pdetail-section-title"><i class="ti ti-medal"></i> ACHIEVEMENTS</div>
    <div class="pdetail-achieve-list"><div class="pdetail-achieve"><div class="pdetail-achieve-icon"><i class="ti ti-trophy" style="color:#ffd700"></i></div><div class="pdetail-achieve-info"><div class="pdetail-achieve-title">Dominant Player</div><div class="pdetail-achieve-sub">${winRate}% win rate · ${s.wins}W–${s.losses}L</div></div></div></div>`:''}
    ${_buildOtherSportsHtml(name, gp, 'badminton')}`;
}

// ── "Also plays" section at the bottom of each sport profile ──
function _buildOtherSportsHtml(name, gp, currentSport) {
  const others = [];
  if (currentSport!=='cricket'   && gp.cricket.matches>0)   others.push({sp:'cricket',  icon:'ti-cricket',      label:'Cricket',   sub:`${gp.cricket.runs} runs · ${gp.cricket.wickets} wkts`});
  if (currentSport!=='football'  && gp.football.matches>0)  others.push({sp:'football', icon:'ti-ball-football', label:'Football',  sub:`${gp.football.goals} goals · ${gp.football.matches}M`});
  if (currentSport!=='badminton' && gp.badminton.matches>0) others.push({sp:'badminton',icon:'ti-ping-pong',     label:'Badminton', sub:`${gp.badminton.wins}W–${gp.badminton.losses}L`});
  if (!others.length) return '';
  return `
    <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);">
      <div style="font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text3);margin-bottom:8px;"><i class="ti ti-layers-intersect" style="vertical-align:-2px;margin-right:4px;"></i>Also Plays</div>
      ${others.map(o=>`
        <div onclick="showPlayerDetailTab('${o.sp}')" style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface-2);border-radius:10px;border:1px solid var(--border);margin-bottom:6px;cursor:pointer;" onmouseover="this.style.opacity='.75'" onmouseout="this.style.opacity='1'">
          <div style="width:28px;height:28px;border-radius:8px;background:var(--surface-3);display:grid;place-items:center;font-size:14px;flex-shrink:0;"><i class="ti ${o.icon}"></i></div>
          <div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:800;color:var(--text);">${o.label}</div><div style="font-size:10px;color:var(--text3);">${o.sub}</div></div>
          <i class="ti ti-chevron-right" style="color:var(--text3);font-size:13px;"></i>
        </div>`).join('')}
    </div>`;
}

// ═══════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// MATCH SUMMARY MODAL
// ═══════════════════════════════════════════════════════