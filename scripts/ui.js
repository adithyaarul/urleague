function selectSport(sport) {
  _pendingSport = sport;

  // Show room entry popup — let user pick solo/create/join
  const icons = { cricket:'ti-cricket', football:'ti-ball-football', badminton:'ti-ping-pong', pickleball:'ti-tennis', chess:'ti-chess-knight' };
  const names = { cricket:'Cricket', football:'Football', badminton:'Badminton', pickleball:'Pickleball', chess:'Chess' };
  document.getElementById('room-entry-icon').className = 'ti ' + (icons[sport] || 'ti-trophy');
  document.getElementById('room-entry-sport-name').textContent = names[sport] || sport;
  // Reset inline panels
  document.getElementById('room-join-inline').classList.remove('visible');
  document.getElementById('room-create-inline').classList.remove('visible');
  document.getElementById('room-entry-overlay').classList.add('visible');
  // Show warning if Supabase not yet configured
  updateRoomEntryCredsBanner();
}

function _doEnterSport(sport) {
  S.sport = sport;
  save();
  applyTheme();
  document.documentElement.setAttribute('data-sport', sport);

  document.getElementById('screen-gateway').classList.remove('active');
  document.getElementById('screen-app').classList.add('active');
  document.getElementById('main-tab-bar').classList.remove('hidden-on-home');

  document.getElementById('header-sport-badge').classList.remove('hidden');
  document.getElementById('header-sport-badge').innerHTML =
    `<i class="ti ti-${sport === 'cricket' ? 'cricket' : sport === 'football' ? 'ball-football' : sport === 'pickleball' ? 'tennis' : sport === 'chess' ? 'chess-knight' : 'ping-pong'}"></i> ${sport.charAt(0).toUpperCase() + sport.slice(1)}`;
  document.getElementById('header-back-btn').classList.remove('hidden');
  document.getElementById('mode-badge').classList.remove('hidden');

  if (window.history && window.history.pushState) {
    history.pushState({ sport }, '', '#' + sport);
  }
  applyCommentarySettings();
  setupSportUI(sport);
  _prevTab = null;
  _currentTab = 'match';
  showTab('match');

  const lbl = document.getElementById('settings-sport-label');
  if (lbl) lbl.textContent = 'Currently: ' + sport.charAt(0).toUpperCase() + sport.slice(1);
}

// ── Room Entry: Solo ──
function closeRoomEntry() {
  document.getElementById('room-entry-overlay').classList.remove('visible');
  // Return to gateway without entering any sport
}

function roomEntrySolo() {
  document.getElementById('room-entry-overlay').classList.remove('visible');
  _doEnterSport(_pendingSport);
}

// ── Room Entry: Show create fields ──
function roomEntryCreate() {
  if (!ROOM_CFG.supabaseUrl || !ROOM_CFG.supabaseKey) {
    openRoomSetupModal();
    return;
  }
  document.getElementById('room-join-inline').classList.remove('visible');
  document.getElementById('room-create-inline').classList.toggle('visible');
}

// ── Room Entry: Show join fields ──
function roomEntryShowJoin() {
  if (!ROOM_CFG.supabaseUrl || !ROOM_CFG.supabaseKey) {
    openRoomSetupModal();
    return;
  }
  document.getElementById('room-create-inline').classList.remove('visible');
  document.getElementById('room-join-inline').classList.toggle('visible');
}

// ── Room Entry: Do create ──
async function roomEntryDoCreate() {
  if (!initSupabase()) { showRoomSetupInline(); return; }
  const nameEl = document.getElementById('room-entry-create-name');
  const name = nameEl?.value.trim();
  if (!name) { nameEl?.focus(); toast('Enter your display name'); return; }

  const btn = document.getElementById('room-entry-create-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 1s linear infinite;"></i> Creating…'; }

  try {
    // Reuse existing session or sign in anonymously
    let authUser = (await _sb.auth.getUser()).data?.user;
    if (!authUser) {
      const { data: authData, error: authErr } = await _sb.auth.signInAnonymously();
      if (authErr || !authData?.user) {
        const msg = authErr?.message || authErr?.error_description || JSON.stringify(authErr) || 'Unknown error';
        const isAnonDisabled = msg.includes('not enabled') || msg.includes('Anonymous') || msg.includes('provider') || msg.includes('anonymous');
        toast(isAnonDisabled
          ? '⚠ Enable Anonymous Sign-ins in Supabase: Authentication → Providers → Anonymous'
          : '❌ ' + msg);
        if (isAnonDisabled) openRoomSetupModal();
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-plus"></i> Create Room &amp; Continue'; }
        return;
      }
      authUser = authData.user;
    }

    await _sb.from('profiles').upsert({ id: authUser.id, display_name: name });

    // Create ALL room records BEFORE entering sport so _roomState is fully populated
    const code = await generateUniqueCode();
    const { data: room, error: roomErr } = await _sb.from('rooms').insert({
      code, host_id: authUser.id, sport: _pendingSport,
      match_name: _pendingSport + ' Match', state: 'waiting',
    }).select().single();
    if (roomErr || !room) throw roomErr || new Error('Room insert failed');

    const { error: memberErr } = await _sb.from('room_members').insert({ room_id: room.id, user_id: authUser.id, role: 'host' });
    if (memberErr) throw memberErr;

    const { error: stateErr } = await _sb.from('match_state').insert({ room_id: room.id, sport: _pendingSport, state_data: S, version: 0 });
    if (stateErr) throw stateErr;

    _roomState = { active: true, roomId: room.id, roomCode: code, role: 'host',
      userId: authUser.id, userName: name, members: [], version: 0, auditLog: [], lobbyOpen: false };

    // Now enter sport — room is fully ready
    document.getElementById('room-entry-overlay').classList.remove('visible');
    _doEnterSport(_pendingSport);

    subscribeToRoom(room.id);
    updateRoomPill();
    // Open Room Lobby so code is always visible
    setTimeout(() => openRoomLobby(), 400);
  } catch(e) {
    console.error('roomEntryDoCreate error:', e);
    toast('❌ Failed to create room: ' + (e?.message || 'Unknown error'));
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-plus"></i> Create Room &amp; Continue'; }
  }
}

// ── Room Entry: Do join ──
async function roomEntryJoin() {
  if (!initSupabase()) { showRoomSetupInline(); return; }
  const code = (document.getElementById('room-entry-code')?.value || '').toUpperCase().trim();
  const name = document.getElementById('room-entry-name')?.value.trim();
  if (!name) { toast('Enter your display name'); return; }
  if (code.length < 6) { toast('Enter a valid 6-character room code'); return; }

  const btn = document.getElementById('room-entry-join-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2" style="animation:spin 1s linear infinite;"></i> Joining…'; }

  try {
    let user = (await _sb.auth.getUser()).data?.user;
    if (!user) {
      const { data: authData, error: authErr } = await _sb.auth.signInAnonymously();
      if (authErr || !authData?.user) {
        const msg = authErr?.message || '';
        const isAnonDisabled = msg.includes('not enabled') || msg.includes('Anonymous') || msg.includes('provider');
        toast(isAnonDisabled
          ? '⚠ Enable Anonymous Sign-ins in Supabase: Authentication → Providers → Anonymous'
          : 'Sign-in failed: ' + msg);
        if (isAnonDisabled) openRoomSetupModal();
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-arrow-right"></i> Join Room'; }
        return;
      }
      user = authData.user;
    }
    await _sb.from('profiles').upsert({ id: user.id, display_name: name });

    const { data: room, error: roomErr } = await _sb.from('rooms').select('*').eq('code', code).is('deleted_at', null).single();
    if (roomErr || !room) throw new Error('Room not found — check the code');
    if (room.state === 'locked') throw new Error('This room is locked.');

    const { data: existing } = await _sb.from('room_members')
      .select('role').eq('room_id', room.id).eq('user_id', user.id).maybeSingle();
    if (!existing) {
      const { error: joinErr } = await _sb.from('room_members').insert({ room_id: room.id, user_id: user.id, role: 'viewer' });
      if (joinErr) throw joinErr;
    }

    const { data: ms } = await _sb.from('match_state').select('*').eq('room_id', room.id).single();

    _roomState = { active: true, roomId: room.id, roomCode: code, role: existing?.role || 'viewer',
      userId: user.id, userName: name, members: [], version: ms?.version || 0, auditLog: [], lobbyOpen: false };

    if (ms?.state_data) {
      S = Object.assign(S, ms.state_data);
      _pendingSport = ms.sport;
    }

    document.getElementById('room-entry-overlay').classList.remove('visible');
    _doEnterSport(_pendingSport || room.sport);
    subscribeToRoom(room.id);
    updateRoomPill();
    toast(`✅ Joined room as ${_roomState.role}`);
    setTimeout(() => openRoomLobby(), 400);
  } catch(e) {
    console.error('roomEntryJoin error:', e);
    toast('❌ ' + (e?.message || 'Failed to join room'));
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-arrow-right"></i> Join Room'; }
  }
}

// ── Show created banner on live/match tab ──
function showRoomCreatedBanner(code) {
  const link = location.origin + location.pathname + '?room=' + code;
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:450;width:min(420px,calc(100%-24px));';
  el.innerHTML = `<div style="background:linear-gradient(135deg,rgba(99,102,241,.95),rgba(79,70,229,.9));border:1px solid rgba(99,102,241,.5);border-radius:18px;padding:16px 18px;backdrop-filter:blur(12px);box-shadow:0 8px 32px rgba(0,0,0,.4);">
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="background:rgba(255,255,255,.15);border-radius:10px;padding:8px 12px;font-family:'Barlow Condensed',sans-serif;font-size:1.8rem;font-weight:900;letter-spacing:.12em;color:#fff;flex-shrink:0;">${code}</div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:800;color:#fff;margin-bottom:2px;">Room Created!</div>
        <div style="font-size:11px;color:rgba(255,255,255,.7);">Share this code with scorers &amp; viewers</div>
      </div>
      <button onclick="navigator.clipboard?.writeText('${code}').then(()=>toast('Copied!'))" style="background:rgba(255,255,255,.15);border:none;border-radius:10px;padding:8px 10px;color:#fff;cursor:pointer;font-size:12px;font-weight:700;">Copy</button>
    </div>
    <div style="margin-top:10px;font-size:10px;color:rgba(255,255,255,.5);word-break:break-all;cursor:pointer;" onclick="navigator.clipboard?.writeText('${link}').then(()=>toast('Link copied!'))">
      <i class="ti ti-link" style="margin-right:3px;"></i>${link}
    </div>
  </div>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 7000);
}

// ── Show setup modal ──
function showRoomSetupInline() { openRoomSetupModal(); }

// ── Update no-creds banner visibility ──
function updateRoomEntryCredsBanner() {
  const banner = document.getElementById('room-entry-no-creds-banner');
  if (!banner) return;
  const hasCreds = !!(ROOM_CFG.supabaseUrl && ROOM_CFG.supabaseKey);
  banner.style.display = hasCreds ? 'none' : 'block';
}

function setupSportUI(sport) {
  ['cricket','football','badminton','pickleball','chess'].forEach(s => {
    document.getElementById(`match-${s}`).classList.toggle('hidden', s !== sport);
    document.getElementById(`live-${s}`).classList.toggle('hidden', s !== sport);
  });

  // Live tab icon
  const liveTab = document.getElementById('tab-live');
  if (sport === 'cricket') liveTab.querySelector('i').className = 'ti ti-cricket';
  else if (sport === 'football') liveTab.querySelector('i').className = 'ti ti-ball-football';
  else if (sport === 'pickleball') liveTab.querySelector('i').className = 'ti ti-tennis';
  else if (sport === 'chess') liveTab.querySelector('i').className = 'ti ti-chess-knight';
  else liveTab.querySelector('i').className = 'ti ti-ping-pong';

  // Restore match state
  if (sport === 'cricket') {
    refreshCricketSetupUI();
  }
  if (sport === 'cricket') {
    refreshCricketSetupUI();
    if (S.cricket.matchStarted) {
      document.getElementById('cricket-no-match').classList.add('hidden');
      document.getElementById('cricket-live-ui').classList.remove('hidden');
      updateCricketUI();
    }
  }
  if (sport === 'football' && S.football.matchStarted) {
    document.getElementById('football-no-match').classList.add('hidden');
    document.getElementById('football-live-ui').classList.remove('hidden');
    renderFootballLive();
  }
  if (sport === 'badminton' && S.badminton.matchStarted) {
    document.getElementById('badminton-no-match').classList.add('hidden');
    document.getElementById('badminton-live-ui').classList.remove('hidden');
    renderBadmintonLive();
  }
  if (sport === 'pickleball') {
    // Restore input values
    const pbA = document.getElementById('pb-player-a');
    const pbB = document.getElementById('pb-player-b');
    const pbFmt = document.getElementById('pb-format');
    const pbPts = document.getElementById('pb-points');
    const pbGames = document.getElementById('pb-games');
    if (pbA) pbA.value = S.pickleball.playerA || 'Player A';
    if (pbB) pbB.value = S.pickleball.playerB || 'Player B';
    if (pbFmt) pbFmt.value = S.pickleball.format || 'singles';
    if (pbPts) pbPts.value = String(S.pickleball.pointsToWin || 11);
    if (pbGames) pbGames.value = String(S.pickleball.gamesToWin || 1);
    if (S.pickleball.matchStarted) {
      document.getElementById('pickleball-no-match').classList.add('hidden');
      document.getElementById('pickleball-live-ui').classList.remove('hidden');
      renderPickleballLive();
    }
  }
  if (sport === 'chess') {
    // Restore input values
    const chW = document.getElementById('ch-player-white');
    const chB = document.getElementById('ch-player-black');
    const chTime = document.getElementById('ch-time');
    const chInc = document.getElementById('ch-increment');
    if (chW) chW.value = S.chess.playerWhite || 'White';
    if (chB) chB.value = S.chess.playerBlack || 'Black';
    if (chTime) chTime.value = S.chess.timeControl || 'none';
    if (chInc) chInc.value = String(S.chess.increment || 0);
    if (S.chess.matchStarted) {
      document.getElementById('chess-no-match').classList.add('hidden');
      document.getElementById('chess-live-ui').classList.remove('hidden');
      renderChessLive();
      startChessClock();
    }
  }

  renderHistory();
  renderGallery();
}

function goHome() {
  if (_fbTimerInterval) { clearInterval(_fbTimerInterval); _fbTimerInterval = null; }
  if (_chClockInterval) { clearInterval(_chClockInterval); _chClockInterval = null; }
  _prevTab = null;
  _currentTab = 'match';

  document.getElementById('screen-app').classList.remove('active');
  document.getElementById('screen-gateway').classList.add('active');
  document.getElementById('header-sport-badge').classList.add('hidden');
  document.getElementById('header-back-btn').classList.add('hidden');
  document.getElementById('mode-badge').classList.add('hidden');
  document.getElementById('main-tab-bar').classList.add('hidden-on-home');

  // Push home state so forward/back browser nav works
  if (window.history && window.history.pushState) {
    history.pushState({ home: true }, '', window.location.pathname);
  }
  // Refresh the "Jump back in" strip
  renderGatewayRecent();
updateGreeting();
}

// ═══════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════
let _prevTab = null;
let _currentTab = 'match';

function showTab(tab) {
  const tabMap = {
    match: 'section-match',
    live: 'section-live',
    history: 'section-history',
  };
  if (tab !== _currentTab) {
    _prevTab = _currentTab;
    _currentTab = tab;
  }
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  if (tabMap[tab]) document.getElementById(tabMap[tab]).classList.add('active');
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const activeTabEl = document.getElementById('tab-' + tab);
  if (activeTabEl) activeTabEl.classList.add('active');

  // Scroll to top whenever switching tabs
  window.scrollTo({ top: 0, behavior: 'instant' });

  // Re-render history with current sport filter whenever history tab opens
  if (tab === 'history') showHistoryView('list');

  // Resize chess board when switching to live tab
  if (tab === 'live' && S.sport === 'chess') {
    setTimeout(_resizeChessCanvas, 50);
    setTimeout(_resizeChessCanvas, 200);
  }
}

function goBack() {
  if (_prevTab && _prevTab !== _currentTab) {
    const dest = _prevTab;
    _prevTab = null;
    showTab(dest);
  } else {
    goHome();
  }
}

function openMore() {
  document.getElementById('more-overlay').classList.remove('hidden');
}

function closeMore() {
  document.getElementById('more-overlay').classList.add('hidden');
  stopRoomSectionRefresh();
}

let _roomSectionRefreshTimer = null;

function stopRoomSectionRefresh() {
  if (_roomSectionRefreshTimer) { clearInterval(_roomSectionRefreshTimer); _roomSectionRefreshTimer = null; }
}

function navigateMore(section) {
  closeMore();
  // Room opens as overlay — never touch sections or tabs
  if (section === 'room') {
    openRoomLobby();
    return;
  }
  // Only navigate to sections that exist in the DOM
  const sectionEl = document.getElementById('section-' + section);
  if (!sectionEl) return;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  sectionEl.classList.add('active');
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if (section === 'profiles') { renderLibrary(); renderProfiles(); }
}

function renderRoomSection() {
  const el = document.getElementById('room-section-body');
  if (!el) return;

  if (!_roomState.active) {
    el.innerHTML = `
      <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:16px;padding:24px;text-align:center;">
        <div style="font-size:40px;margin-bottom:10px;">🏠</div>
        <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px;">No Active Room</div>
        <div style="font-size:12px;color:var(--text3);margin-bottom:16px;">Create or join a room to score live with friends.</div>
        <button onclick="navigateMore=navigateMore; document.querySelectorAll('.section').forEach(s=>s.classList.remove('active')); openRoomOverlay();"
          class="btn primary full" style="font-size:14px;padding:12px;">
          <i class="ti ti-plus"></i> Create / Join a Room
        </button>
      </div>`;
    return;
  }

  const isHost = _roomState.role === 'host';
  const link = location.origin + location.pathname + '?room=' + _roomState.roomCode;

  el.innerHTML = `
    <!-- Room Code Card -->
    <div style="background:var(--sport-gradient);border:1.5px solid var(--sport-border);border-radius:18px;padding:20px;text-align:center;margin-bottom:14px;">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--sport-primary);margin-bottom:8px;">🔑 Your Room Code</div>
      <div onclick="navigator.clipboard?.writeText('${_roomState.roomCode}').then(()=>toast('Code copied!'))"
        style="font-family:'Barlow Condensed',sans-serif;font-size:3.2rem;font-weight:900;letter-spacing:.22em;color:var(--text);cursor:pointer;line-height:1;text-shadow:0 2px 12px rgba(0,0,0,.3);">
        ${_roomState.roomCode}
      </div>
      <div style="font-size:11px;color:var(--text3);margin-top:6px;margin-bottom:14px;">Tap code to copy • Share with friends to join</div>
      <div style="display:flex;gap:8px;">
        <button onclick="navigator.clipboard?.writeText('${_roomState.roomCode}').then(()=>toast('Code copied!'))"
          class="btn sm" style="flex:1;background:var(--sport-primary-l);color:var(--sport-primary);border-color:var(--sport-border);">
          <i class="ti ti-copy"></i> Copy Code
        </button>
        <button onclick="navigator.clipboard?.writeText('${link}').then(()=>toast('Link copied!'))"
          class="btn sm" style="flex:1;background:var(--surface-2);color:var(--text2);border-color:var(--border);">
          <i class="ti ti-link"></i> Copy Link
        </button>
      </div>
    </div>

    <!-- Role badge -->
    <div style="display:flex;gap:10px;margin-bottom:14px;">
      <div style="flex:1;background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center;">
        <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:4px;">Your Role</div>
        <div style="font-size:14px;font-weight:800;color:var(--sport-primary);text-transform:uppercase;">${_roomState.role}</div>
      </div>
      <div style="flex:1;background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:12px;text-align:center;">
        <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:4px;">Your Name</div>
        <div style="font-size:14px;font-weight:800;color:var(--text);">${_roomState.userName || '—'}</div>
      </div>
    </div>

    <!-- Members -->
    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:8px;">
      <i class="ti ti-users" style="margin-right:4px;"></i> Members in Room
    </div>
    <div id="room-section-members" style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:14px;">
      <div style="padding:14px;color:var(--text3);font-size:12px;text-align:center;">Loading members…</div>
    </div>

    ${isHost ? `
    <!-- Host Controls -->
    <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:8px;">
      <i class="ti ti-crown" style="margin-right:4px;color:#fbbf24;"></i> Host Controls
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
      <button class="btn sm" onclick="toggleRoomLock()" style="background:rgba(245,158,11,.15);color:#f59e0b;border-color:rgba(245,158,11,.3);padding:12px;">
        <i class="ti ti-lock"></i> Lock Scoring
      </button>
      <button class="btn sm danger" onclick="deleteRoom()" style="padding:12px;">
        <i class="ti ti-trash"></i> Delete Room
      </button>
    </div>` : ''}

    <!-- Leave -->
    <button class="btn sm neutral full" onclick="leaveRoom();renderRoomSection();" style="padding:12px;">
      <i class="ti ti-logout"></i> Leave Room
    </button>
  `;

  // Load members into the section
  _sb.from('room_members')
    .select('user_id, role, profiles(display_name)')
    .eq('room_id', _roomState.roomId)
    .then(({ data }) => {
      const el2 = document.getElementById('room-section-members');
      if (!el2) return;
      if (!data || !data.length) {
        el2.innerHTML = '<div style="padding:14px;color:var(--text3);font-size:12px;text-align:center;">No members yet.</div>';
        return;
      }
      el2.innerHTML = data.map((m, i) => {
        const name = m.profiles?.display_name || 'Unknown';
        const isYou = m.user_id === _roomState.userId;
        const roleColor = m.role === 'host' ? '#a78bfa' : m.role === 'scorer' ? '#38bdf8' : '#94a3b8';
        return `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;${i > 0 ? 'border-top:1px solid var(--border);' : ''}">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--sport-primary-l);border:1.5px solid var(--sport-border);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;color:var(--sport-primary);flex-shrink:0;">${name.charAt(0).toUpperCase()}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:14px;color:var(--text);">${name}${isYou ? ' <span style="font-size:10px;background:rgba(56,189,248,.15);color:#38bdf8;border-radius:6px;padding:1px 6px;font-weight:800;">YOU</span>' : ''}</div>
          </div>
          <span style="font-size:10px;font-weight:800;text-transform:uppercase;background:${roleColor}22;color:${roleColor};border:1px solid ${roleColor}44;border-radius:8px;padding:3px 8px;">${m.role}</span>
        </div>`;
      }).join('');
    });
}

// ═══════════════════════════════════════════════════════
// ROOM
// ═══════════════════════════════════════════════════════
function joinRoom() {
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (!code) { toast('Enter a room code first.'); return; }
  S.roomCode = code;
  document.getElementById('room-code-pill').textContent = 'Code: ' + code;
  document.getElementById('room-status').textContent = 'Connected to room ' + code;
  toast('Joined room ' + code);
  save();
}

function createRoom() {
  const pass = document.getElementById('room-pass-input').value.trim();
  if (!pass) { toast('Enter a password to create a room.'); return; }
  const code = Math.random().toString(36).substring(2,8).toUpperCase();
  S.roomCode = code;
  document.getElementById('room-code-input').value = code;
  document.getElementById('room-code-pill').textContent = 'Code: ' + code;
  document.getElementById('room-status').textContent = 'Room ' + code + ' created — share the code!';
  toast('Room ' + code + ' created!');
  save();
}

function generateRoomCode() {
  const code = Math.random().toString(36).substring(2,8).toUpperCase();
  document.getElementById('room-code-input').value = code;
}

function leaveRoom() {
  S.roomCode = '';
  document.getElementById('room-code-pill').textContent = 'Code: —';
  document.getElementById('room-status').textContent = 'Join a room to sync across devices.';
  toast('Left room.');
  save();
}

function copyRoomLink() {
  if (!S.roomCode) { toast('No active room.'); return; }
  const txt = `Join my Arena room: ${S.roomCode}`;
  navigator.clipboard.writeText(txt).then(() => toast('Link copied!')).catch(() => toast('Room code: ' + S.roomCode));
}

// ═══════════════════════════════════════════════════════
// ══════ CRICKET ══════
// ═══════════════════════════════════════════════════════
const SAMPLE_PLAYERS = ['Rohit','Virat','Dhoni','Bumrah','Jadeja','Shami','KL','Pant','Hardik','Siraj','Ashwin'];

let _suggestionIndex = -1;

function onPlayerInputChange(val) {
  const query = val.trim().toLowerCase();
  const allStats = computeCricketAllStats();

  // Build candidate list: library + past cricket players, excluding already-added
  const candidates = [];
  const seen = new Set();

  // Library players first
  S.library.forEach(p => {
    if (seen.has(p.name.toLowerCase())) return;
    seen.add(p.name.toLowerCase());
    const s = allStats[p.name] || {};
    candidates.push({ name: p.name, role: p.role || 'All-rounder', photo: p.photo || null, fromLib: true, stats: s });
  });

  // Past cricket players not in library
  Object.keys(allStats).forEach(name => {
    if (seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    candidates.push({ name, role: 'Player', photo: null, fromLib: false, stats: allStats[name] });
  });

  const alreadyAdded = new Set(S.cricket.players.map(p => p.toLowerCase()));

  // Filter by query
  let matches = candidates.filter(c => {
    if (alreadyAdded.has(c.name.toLowerCase())) return false;
    return !query || c.name.toLowerCase().includes(query);
  }).slice(0, 8);

  // If query doesn't match anyone, offer "Add new"
  const exactMatch = candidates.some(c => c.name.toLowerCase() === query);
  const showNew = query && !exactMatch && !alreadyAdded.has(query);

  const box = document.getElementById('player-suggestions');
  if (!matches.length && !showNew) { hideSuggestions(); return; }

  _suggestionIndex = -1;
  box.classList.remove('hidden');
  box.innerHTML = matches.map((c, i) => {
    const rating = computePlayerRating(c.stats);
    const ratingHtml = rating > 0
      ? `<div class="suggestion-rating"><i class="ti ti-star-filled"></i>${rating.toFixed(1)}</div>`
      : '';
    const avatarHtml = c.photo
      ? `<img src="${c.photo}" alt="${esc(c.name)}"/>`
      : `<div class="suggestion-avatar-init">${esc(c.name.charAt(0).toUpperCase())}</div>`;
    const matchCount = c.stats.matches || 0;
    const meta = c.fromLib
      ? `${esc(c.role)}${matchCount ? ' · ' + matchCount + ' match' + (matchCount > 1 ? 'es' : '') : ''}`
      : `${matchCount} match${matchCount > 1 ? 'es' : ''}`;
    return `<div class="suggestion-item" data-name="${esc(c.name)}" onclick="selectSuggestion('${esc(c.name)}')">
      <div class="suggestion-avatar">${avatarHtml}</div>
      <div class="suggestion-info">
        <div class="suggestion-name">${esc(c.name)}</div>
        <div class="suggestion-meta">${meta}</div>
      </div>
      ${ratingHtml}
    </div>`;
  }).join('') + (showNew ? `
    <div class="suggestion-item" data-name="${esc(val.trim())}" onclick="selectSuggestion('${esc(val.trim())}', true)">
      <div class="suggestion-avatar"><div class="suggestion-avatar-init">+</div></div>
      <div class="suggestion-info">
        <div class="suggestion-name">${esc(val.trim())}</div>
        <div class="suggestion-meta">Add new player</div>
      </div>
      <div class="suggestion-new-badge">NEW</div>
    </div>` : '');
}

function onPlayerInputKeydown(e) {
  const box = document.getElementById('player-suggestions');
  const items = box.querySelectorAll('.suggestion-item');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _suggestionIndex = Math.min(_suggestionIndex + 1, items.length);
    items.forEach((el, i) => el.classList.toggle('focused', i === _suggestionIndex));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _suggestionIndex = Math.max(_suggestionIndex - 1, -1);
    items.forEach((el, i) => el.classList.toggle('focused', i === _suggestionIndex));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (_suggestionIndex >= 0 && items[_suggestionIndex]) {
      const name = items[_suggestionIndex].dataset.name;
      const isNew = items[_suggestionIndex].querySelector('.suggestion-new-badge') !== null;
      selectSuggestion(name, isNew);
    } else {
      addCricketPlayer();
    }
  } else if (e.key === 'Escape') {
    hideSuggestions();
  }
}

function selectSuggestion(name, isNew) {
  if (!name) return;
  hideSuggestions();
  document.getElementById('cricket-player-input').value = '';

  // Case-insensitive check
  if (S.cricket.players.find(p => p.toLowerCase() === name.toLowerCase())) { toast(name + ' already in squad.'); return; }
  S.cricket.players.push(name);

  // If new (not in library), add to library too
  if (isNew && !S.library.find(p => p.name.toLowerCase() === name.toLowerCase())) {
    S.library.push({ name, role: 'All-rounder', trivia: '', photo: null });
  }

  renderCricketPlayersList();
  renderLibrary();
  renderProfiles();
  save();
  toast(name + ' added to squad!');
}

function hideSuggestions() {
  const box = document.getElementById('player-suggestions');
  if (box) box.classList.add('hidden');
  _suggestionIndex = -1;
}
