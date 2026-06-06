function roomCan(action) {
  if (!_roomState.active) return true; // solo mode: always allowed
  return (ROOM_PERMISSIONS[_roomState.role] || []).includes(action);
}
function requirePerm(action) {
  if (roomCan(action)) return true;
  toast('⛔ No permission: ' + action.replace('.',' '));
  const el = document.querySelector('#section-live .card');
  if (el) { el.classList.add('perm-denied'); setTimeout(()=>el.classList.remove('perm-denied'),400); }
  return false;
}

// ── Init Supabase ──
function initSupabase() {
  if (!ROOM_CFG.supabaseUrl || !ROOM_CFG.supabaseKey) return false;
  if (_sb) return true;
  try {
    _sb = supabase.createClient(ROOM_CFG.supabaseUrl, ROOM_CFG.supabaseKey);
    return true;
  } catch(e) {
    console.error('Supabase init failed', e);
    return false;
  }
}

// ── Silent init on page load (no error if not configured) ──
function initSupabaseSilent() {
  if (ROOM_CFG.supabaseUrl && ROOM_CFG.supabaseKey) {
    try { initSupabase(); } catch(e) {}
  }
}

// ── Room Code Generator ──
function generateCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length: len}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
async function generateUniqueCode() {
  let code, exists = true, attempts = 0;
  while (exists && attempts < 20) {
    code = generateCode(6);
    const { data } = await _sb.from('rooms').select('id').eq('code', code).is('deleted_at', null).maybeSingle();
    exists = !!data;
    attempts++;
  }
  return code;
}

// ── Auth helpers ──
async function ensureAuth() {
  if (!_sb) { toast('Configure Supabase first (Settings → Room Setup)'); return null; }
  const { data: { user } } = await _sb.auth.getUser();
  if (user) return user;

  // Show sign-in
  renderRoomSignIn();
  return null;
}
async function signInAnon() {
  const { data, error } = await _sb.auth.signInAnonymously();
  if (error) { toast('Sign-in failed: ' + error.message); return null; }
  // Save display name
  const name = document.getElementById('room-display-name')?.value.trim() || 'Player';
  await _sb.from('profiles').upsert({ id: data.user.id, display_name: name });
  return data.user;
}

// ── Create Room ──
async function createRoom() {
  const user = await ensureAuth();
  if (!user) return;

  const btn = document.getElementById('room-create-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }

  try {
    const code = await generateUniqueCode();
    const sport = S.sport || 'cricket';

    // 1. Create room
    const { data: room, error: re } = await _sb.from('rooms').insert({
      code,
      host_id: user.id,
      sport,
      match_name: `${sport.charAt(0).toUpperCase()+sport.slice(1)} Match`,
      state: 'waiting',
    }).select().single();
    if (re) throw re;

    // 2. Add host as member
    await _sb.from('room_members').insert({ room_id: room.id, user_id: user.id, role: 'host' });

    // 3. Create initial match state
    await _sb.from('match_state').insert({ room_id: room.id, sport, state_data: S, version: 0 });

    // 4. Get profile
    const { data: profile } = await _sb.from('profiles').select('display_name').eq('id', user.id).single();

    _roomState.roomId = room.id;
    _roomState.roomCode = code;
    _roomState.role = 'host';
    _roomState.userId = user.id;
    _roomState.userName = profile?.display_name || 'Host';
    _roomState.version = 0;
    _roomState.active = true;

    subscribeToRoom(room.id);
    logActivity('room_created');
    applyMode();
    renderRoomCreated(code, room.id);
    updateRoomPill();
  } catch(e) {
    toast('Failed to create room: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Create Room'; }
  }
}

// ── Join Room ──
async function joinRoom() {
  const input = document.getElementById('join-code-input');
  const code = (input?.value || '').toUpperCase().trim();
  if (code.length < 6) { toast('Enter a valid room code'); return; }

  const user = await ensureAuth();
  if (!user) return;

  const btn = document.getElementById('room-join-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Joining…'; }

  try {
    // Find room
    const { data: room, error: re } = await _sb.from('rooms')
      .select('*').eq('code', code).is('deleted_at', null).single();
    if (re || !room) throw new Error('Room not found. Check the code and try again.');
    if (room.state === 'locked') throw new Error('This room is locked and not accepting members.');

    // Check already member
    const { data: existing } = await _sb.from('room_members')
      .select('role').eq('room_id', room.id).eq('user_id', user.id).maybeSingle();

    if (!existing) {
      await _sb.from('room_members').insert({ room_id: room.id, user_id: user.id, role: 'viewer' });
    }

    // Load match state
    const { data: ms } = await _sb.from('match_state').select('*').eq('room_id', room.id).single();
    const { data: profile } = await _sb.from('profiles').select('display_name').eq('id', user.id).single();

    _roomState.roomId = room.id;
    _roomState.roomCode = code;
    _roomState.role = existing?.role || 'viewer';
    _roomState.userId = user.id;
    _roomState.userName = profile?.display_name || 'Player';
    _roomState.version = ms?.version || 0;
    _roomState.active = true;

    if (ms?.state_data) {
      S = Object.assign(S, ms.state_data);
      updateCricketUI?.();
    }

    subscribeToRoom(room.id);
    logActivity('member_joined');
    applyMode();
    renderRoomLobby();
    updateRoomPill();
    toast(`Joined room as ${_roomState.role}`);
  } catch(e) {
    toast(e.message || 'Failed to join room');
    if (btn) { btn.disabled = false; btn.textContent = 'Join Room'; }
  }
}

// ── Real-Time Subscription ──
function subscribeToRoom(roomId) {
  if (_roomChannel) { _roomChannel.unsubscribe(); _roomChannel = null; }

  _roomChannel = _sb.channel(`room:${roomId}`)
    // Match state changes
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'match_state',
      filter: `room_id=eq.${roomId}`
    }, (payload) => {
      const incoming = payload.new;
      if (incoming.version > _roomState.version) {
        _roomState.version = incoming.version;
        // Don't apply own updates (we already have them)
        if (incoming.updated_by !== _roomState.userId) {
          S = Object.assign(S, incoming.state_data);
          save(true); // local save only
          updateCricketUI?.();
          showLastUpdate(incoming.updated_by_name || 'Someone');
        }
      }
    })
    // Member changes (join/leave/role)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'room_members',
      filter: `room_id=eq.${roomId}`
    }, async (payload) => {
      // If our own row was updated (role change by host), refresh badge
      if (payload.new && payload.new.user_id === _roomState.userId && payload.new.role) {
        _roomState.role = payload.new.role;
        applyMode();
        toast(`Your role was changed to ${payload.new.role} by the host.`);
      }
      loadRoomMembers();
    })
    // Room state changes (match lifecycle)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'rooms',
      filter: `id=eq.${roomId}`
    }, (payload) => {
      const r = payload.new;
      if (r.deleted_at) {
        leaveRoom(true);
        toast('Room was deleted by the host.');
        return;
      }
      updateRoomLobbyState(r.state);
    })
    // Presence — who's online
    .on('presence', { event: 'sync' }, () => {
      updateOnlinePresence();
    })
    .on('presence', { event: 'join' }, ({ newPresences }) => {
      updateOnlinePresence();
      // Refresh audit log so join activity appears
      if (_roomState.lobbyOpen) setTimeout(loadAuditLog, 600);
    })
    .on('presence', { event: 'leave' }, ({ leftPresences }) => {
      updateOnlinePresence();
      // Refresh audit log so leave activity appears
      if (_roomState.lobbyOpen) setTimeout(loadAuditLog, 600);
    })
    // Broadcast — instant low-latency signals
    .on('broadcast', { event: 'score_update' }, (msg) => {
      if (msg.payload.userId === _roomState.userId) return;
      showLastUpdate(msg.payload.userName);
    })
    .on('broadcast', { event: 'room_deleted' }, () => {
      leaveRoom(true);
      toast('Room was deleted by the host.');
    })
    .on('broadcast', { event: 'member_kicked' }, (msg) => {
      if (msg.payload.kickedUserId === _roomState.userId) {
        leaveRoom(true);
        toast('⛔ You have been removed from the room by the host.');
      } else {
        // Refresh member list for everyone else
        loadRoomMembers();
      }
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setConnStatus('connected');
        await _roomChannel.track({
          user_id: _roomState.userId,
          user_name: _roomState.userName,
          online_at: new Date().toISOString(),
        });
        loadRoomMembers();
      } else if (status === 'CHANNEL_ERROR') {
        setConnStatus('offline');
      } else if (status === 'TIMED_OUT') {
        setConnStatus('reconnecting');
        setTimeout(() => subscribeToRoom(roomId), 3000);
      }
    });
}

// ── Push state update ──
async function roomPushState(actionType = 'update') {
  if (!_roomState.active || !_sb) return;
  if (!roomCan('score.edit')) return;

  try {
    // Optimistic lock: read version, write version+1
    const { data: current, error } = await _sb.from('match_state')
      .select('version').eq('room_id', _roomState.roomId).single();
    if (error) throw error;

    if (current.version !== _roomState.version) {
      // Conflict — fetch latest and rebase
      const { data: latest } = await _sb.from('match_state')
        .select('*').eq('room_id', _roomState.roomId).single();
      _roomState.version = latest.version;
      toast('Score updated by another user — applying latest state.');
      S = Object.assign(S, latest.state_data);
      updateCricketUI?.();
      return;
    }

    const newVersion = current.version + 1;
    const { error: we } = await _sb.from('match_state').update({
      state_data: S,
      version: newVersion,
      updated_at: new Date().toISOString(),
      updated_by: _roomState.userId,
    }).eq('room_id', _roomState.roomId).eq('version', current.version);

    if (we) { // Write conflict
      toast('Sync conflict — retrying…');
      setTimeout(() => roomPushState(actionType), 400);
      return;
    }

    _roomState.version = newVersion;

    // Write audit log entry
    _sb.from('audit_log').insert({
      room_id: _roomState.roomId,
      user_id: _roomState.userId,
      action: actionType,
      new_value: { sport: S.sport, cricket_runs: S.cricket?.innings?.[0]?.runs },
    }).then(() => {});

    // Broadcast low-latency signal to all members
    _roomChannel?.send({
      type: 'broadcast', event: 'score_update',
      payload: { userId: _roomState.userId, userName: _roomState.userName, action: actionType }
    });

  } catch(e) {
    console.error('Room push error', e);
    setConnStatus('reconnecting');
  }
}

// ── Load members ──
async function loadRoomMembers() {
  if (!_sb || !_roomState.roomId) return;
  const { data } = await _sb.from('room_members')
    .select('user_id, role, profiles(display_name)')
    .eq('room_id', _roomState.roomId);
  _roomState.members = (data || []).map(m => ({
    userId: m.user_id,
    name: m.profiles?.display_name || 'Player',
    role: m.role,
    online: false,
  }));
  if (_roomState.lobbyOpen) renderMemberList();
}

// ── Update online presence ──
function updateOnlinePresence() {
  if (!_roomChannel) return;
  const state = _roomChannel.presenceState();
  const onlineIds = new Set(Object.values(state).flat().map(p => p.user_id));
  _roomState.members.forEach(m => m.online = onlineIds.has(m.userId));
  if (_roomState.lobbyOpen) renderMemberList();
}

// ── Role management ──
async function changeRole(targetUserId, newRole) {
  if (!roomCan('room.manage')) return;
  await _sb.from('room_members').update({ role: newRole })
    .eq('room_id', _roomState.roomId).eq('user_id', targetUserId);
  // If host changed their own role (edge case) or this user's role, update badge
  if (targetUserId === _roomState.userId) {
    _roomState.role = newRole;
    applyMode();
  }
  loadRoomMembers();
  toast(`Role updated to ${newRole}`);
}

// ── Kick member ──
async function kickMember(targetUserId, targetName) {
  if (_roomState.role !== 'host') { toast('Only the host can remove members.'); return; }
  if (targetUserId === _roomState.userId) { toast("You can't kick yourself."); return; }
  if (!confirm(`Remove "${targetName}" from the room?`)) return;
  const { error } = await _sb.from('room_members')
    .delete()
    .eq('room_id', _roomState.roomId)
    .eq('user_id', targetUserId);
  if (error) { toast('Failed to remove member.'); return; }
  // Broadcast kick so the removed user's device reacts immediately
  _roomChannel?.send({
    type: 'broadcast', event: 'member_kicked',
    payload: { kickedUserId: targetUserId }
  });
  // Log kick as host's action (we store the kicked user's name in new_value)
  if (_sb && _roomState.roomId && _roomState.userId) {
    _sb.from('audit_log').insert({
      room_id: _roomState.roomId,
      user_id: _roomState.userId,
      action: 'member_kicked',
      new_value: { name: _roomState.userName, kicked_name: targetName },
    }).then(() => { if (_roomState.lobbyOpen) loadAuditLog(); });
  }
  loadRoomMembers();
  toast(`✅ ${targetName} has been removed from the room.`);
}

// ── Lock/Unlock scoring ──
async function toggleRoomLock() {
  if (!roomCan('room.lock')) return;
  const { data: room } = await _sb.from('rooms').select('scoring_locked').eq('id', _roomState.roomId).single();
  const newLock = !room.scoring_locked;
  await _sb.from('rooms').update({ scoring_locked: newLock }).eq('id', _roomState.roomId);
  toast(newLock ? '🔒 Scoring locked' : '🔓 Scoring unlocked');
}

// ── Delete room ──
async function deleteRoom() {
  if (_roomState.role !== 'host') { toast('Only the host can delete the room.'); return; }
  if (!confirm('Delete this room? All match data will be archived. This cannot be undone.')) return;
  await _sb.from('rooms').update({ deleted_at: new Date().toISOString(), state: 'deleted' })
    .eq('id', _roomState.roomId).eq('host_id', _roomState.userId);
  _roomChannel?.send({ type: 'broadcast', event: 'room_deleted', payload: {} });
  leaveRoom(false);
  toast('Room deleted.');
}

// ── Leave room ──
function leaveRoom(kicked = false) {
  if (!kicked && _roomState.active) {
    // Log the departure before clearing state
    logActivity('member_left').catch(() => {});
  }
  if (_roomChannel) { _roomChannel.unsubscribe(); _roomChannel = null; }
  _roomState = { active:false, roomId:null, roomCode:null, role:null, userId:null,
    userName:null, members:[], matchState:null, version:0, auditLog:[], lobbyOpen:false };
  updateRoomPill();
  applyMode();
  closeRoomOverlay();
  document.getElementById('room-lock-banner').style.display = 'none';
  document.getElementById('room-connection-bar').className = '';
}

// ── Connection status ──
function setConnStatus(s) {
  _connStatus = s;
  const bar = document.getElementById('room-connection-bar');
  bar.className = s === 'connected' ? '' : s;
  bar.textContent = s === 'reconnecting' ? '🔄 Reconnecting to room…' : '⚠ Offline — changes may not sync';
}

function showLastUpdate(name) {
  const el = document.querySelector('.room-last-update');
  if (!el) return;
  el.textContent = `${name} made an update`;
  setTimeout(() => { if (el) el.textContent = ''; }, 3000);
}

// ── UI helpers ──
function updateRoomPill() {
  const pill = document.getElementById('room-status-pill');
  const label = document.getElementById('room-pill-label');
  if (_roomState.active) {
    pill.classList.add('active');
    label.textContent = '🏠 ' + _roomState.roomCode + ' · ' + _roomState.role.toUpperCase();
  } else {
    pill.classList.remove('active');
  }
}

function openRoomOverlay() {
  if (!initSupabase()) {
    renderRoomSetup();
    document.getElementById('room-overlay').classList.add('visible');
    return;
  }
  renderRoomHome();
  document.getElementById('room-overlay').classList.add('visible');
}
function closeRoomOverlay() {
  document.getElementById('room-overlay').classList.remove('visible');
  _roomState.lobbyOpen = false;
}
function openRoomLobby() {
  if (!_roomState.active) { return; }
  _roomState.lobbyOpen = true;
  renderRoomLobby();
  document.getElementById('room-overlay').classList.add('visible');
}

// ── Render: Home ──
function renderRoomHome() {
  document.getElementById('room-sheet-body').innerHTML = `
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;margin-bottom:4px;">
      <i class="ti ti-users" style="color:var(--sport-primary);"></i> Live Rooms
    </div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:4px;">
      Play together in real time. Share a room code with friends to score live matches together.
    </div>
    <div class="room-choice-grid">
      <div class="room-choice-card create" onclick="renderRoomCreateFlow()">
        <div class="room-choice-icon"><i class="ti ti-plus"></i></div>
        <div class="room-choice-title">Create Room</div>
        <div class="room-choice-sub">Host a live match</div>
      </div>
      <div class="room-choice-card join" onclick="renderRoomJoinFlow()">
        <div class="room-choice-icon"><i class="ti ti-door-enter"></i></div>
        <div class="room-choice-title">Join Room</div>
        <div class="room-choice-sub">Enter a room code</div>
      </div>
    </div>
    <div style="margin-top:18px;">
      <button class="btn sm neutral full" onclick="closeRoomOverlay();openRoomSetupModal()">
        <i class="ti ti-settings"></i> Room Setup (Supabase)
      </button>
    </div>
  `;
}

// ── Render: Create flow ──
function renderRoomCreateFlow() {
  document.getElementById('room-sheet-body').innerHTML = `
    <button onclick="renderRoomHome()" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:0 0 12px;font-size:13px;display:flex;align-items:center;gap:4px;">
      <i class="ti ti-arrow-left"></i> Back
    </button>
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;margin-bottom:4px;">Create a Room</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:14px;">You'll be the host with full control.</div>
    <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);">Your Name</label>
    <input id="room-display-name" class="input" style="margin:6px 0 14px;" placeholder="Enter your display name"
      value="${_roomState.userName || ''}" />
    <button id="room-create-btn" class="btn primary full" onclick="createRoom()" style="font-size:15px;padding:13px;">
      <i class="ti ti-plus"></i> Create Room
    </button>
  `;
}

// ── Render: Created ──
function renderRoomCreated(code, roomId) {
  const link = `${location.origin}${location.pathname}?room=${code}`;
  document.getElementById('room-sheet-body').innerHTML = `
    <div style="text-align:center;padding:8px 0 4px;">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--sport-primary);margin-bottom:6px;">Room Created!</div>
      <div class="room-code-display" onclick="copyRoomCode('${code}')">
        <div style="font-size:10px;color:var(--text3);margin-bottom:4px;">ROOM CODE</div>
        <div class="room-code-value">${code}</div>
        <div class="room-code-copy"><i class="ti ti-copy"></i> Tap to copy</div>
      </div>
      <div class="room-invite-link" onclick="copyRoomLink('${link}')">
        <i class="ti ti-link" style="color:var(--sport-primary);flex-shrink:0;"></i>
        <span>${link}</span>
      </div>
    </div>
    <div style="margin-top:14px;display:flex;flex-direction:column;gap:8px;">
      <button class="btn primary full" onclick="renderRoomLobby()">
        <i class="ti ti-users"></i> Open Lobby
      </button>
      <button class="btn sm neutral full" onclick="closeRoomOverlay()">
        <i class="ti ti-x"></i> Close & Start Scoring
      </button>
    </div>
  `;
}

// ── Render: Join flow ──
function renderRoomJoinFlow() {
  document.getElementById('room-sheet-body').innerHTML = `
    <button onclick="renderRoomHome()" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:0 0 12px;font-size:13px;display:flex;align-items:center;gap:4px;">
      <i class="ti ti-arrow-left"></i> Back
    </button>
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;margin-bottom:4px;">Join a Room</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:14px;">Enter the 6-character code shared by the host.</div>
    <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);">Your Name</label>
    <input id="room-display-name" class="input" style="margin:6px 0 14px;" placeholder="Enter your display name" value="${_roomState.userName || ''}" />
    <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);">Room Code</label>
    <input id="join-code-input" class="room-code-input" style="margin:6px 0 14px;" placeholder="A7K9P2"
      maxlength="8" oninput="this.value=this.value.toUpperCase()" />
    <button id="room-join-btn" class="btn success full" onclick="joinRoom()" style="font-size:15px;padding:13px;">
      <i class="ti ti-door-enter"></i> Join Room
    </button>
  `;
}

// ── Render: Lobby ──
function renderRoomLobby() {
  _roomState.lobbyOpen = true;
  const isHost = _roomState.role === 'host';
  document.getElementById('room-sheet-body').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;">Room Lobby</div>
      <button onclick="closeRoomOverlay()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:20px;"><i class="ti ti-x"></i></button>
    </div>

    <!-- Code + state -->
    <div style="background:var(--sport-gradient);border:1px solid var(--sport-border);border-radius:16px;padding:14px 16px;margin-bottom:12px;text-align:center;">
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--sport-primary);margin-bottom:6px;">📋 Room Code — Share with friends</div>
      <div onclick="copyRoomCode('${_roomState.roomCode}')" style="font-family:'Barlow Condensed',sans-serif;font-size:2.8rem;font-weight:900;letter-spacing:.18em;color:var(--text);cursor:pointer;line-height:1;">${_roomState.roomCode}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:4px;">Tap code to copy</div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button onclick="copyRoomCode('${_roomState.roomCode}')" class="btn sm full" style="background:var(--sport-primary-l);color:var(--sport-primary);border-color:var(--sport-border);flex:1;">
          <i class="ti ti-copy"></i> Copy Code
        </button>
        <button onclick="copyRoomLink('${location.origin}${location.pathname}?room=${_roomState.roomCode}')" class="btn sm full" style="background:var(--surface-2);color:var(--text2);border-color:var(--border);flex:1;">
          <i class="ti ti-link"></i> Copy Link
        </button>
      </div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div style="font-size:10px;color:var(--text3);">Status</div>
      <div id="lobby-state-badge" class="room-lobby-state waiting">waiting</div>
    </div>

    <!-- Members -->
    <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);margin-bottom:6px;">Members</div>
    <div class="room-lobby" id="room-member-list-wrap">
      <div class="room-member-list" id="room-member-list"><div style="padding:12px;color:var(--text3);font-size:12px;">Loading…</div></div>
    </div>

    <!-- Host controls -->
    ${isHost ? `
    <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);margin-bottom:6px;margin-top:14px;">Host Controls</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
      <button class="btn sm" onclick="toggleRoomLock()" style="background:rgba(245,158,11,.15);color:#f59e0b;border-color:rgba(245,158,11,.3);">
        <i class="ti ti-lock"></i> Lock Scoring
      </button>
      <button class="btn sm danger" onclick="deleteRoom()">
        <i class="ti ti-trash"></i> Delete Room
      </button>
    </div>` : ''}

    <!-- Audit log -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);">Recent Activity</div>
      <button onclick="loadAuditLog()" style="background:none;border:none;color:var(--sport-primary);font-size:11px;cursor:pointer;">Refresh</button>
    </div>
    <div class="room-lobby" id="audit-log-wrap" style="max-height:180px;overflow-y:auto;">
      <div style="padding:12px;color:var(--text3);font-size:12px;">Loading…</div>
    </div>

    <div style="margin-top:14px;">
      <button class="btn sm neutral full" onclick="leaveRoom()">
        <i class="ti ti-logout"></i> Leave Room
      </button>
    </div>
  `;
  loadRoomMembers();
  loadAuditLog();
}

// ── Render: Members list ──
function renderMemberList() {
  const el = document.getElementById('room-member-list');
  if (!el) return;
  if (!_roomState.members.length) { el.innerHTML = '<div style="padding:12px;color:var(--text3);font-size:12px;">No members yet.</div>'; return; }
  const isHost = _roomState.role === 'host';
  el.innerHTML = _roomState.members.map(m => `
    <div class="room-member-row">
      <div class="room-member-avatar">${(m.name||'?').charAt(0).toUpperCase()}</div>
      <div class="room-member-name">${esc(m.name)}${m.userId===_roomState.userId?'<span class="room-member-you">you</span>':''}</div>
      <span class="room-role-badge ${m.role}">${m.role}</span>
      ${isHost && m.userId !== _roomState.userId ? `
        <select onchange="changeRole('${m.userId}',this.value)"
          style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:10px;padding:2px 4px;cursor:pointer;">
          <option value="scorer" ${m.role==='scorer'?'selected':''}>Scorer</option>
          <option value="viewer" ${m.role==='viewer'?'selected':''}>Viewer</option>
        </select>
        <button onclick="kickMember('${m.userId}','${esc(m.name)}')"
          title="Remove from room"
          style="background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.35);color:#f87171;border-radius:8px;padding:3px 7px;font-size:11px;cursor:pointer;line-height:1;flex-shrink:0;">
          <i class="ti ti-user-x"></i>
        </button>` : ''}
      <div class="${m.online ? 'room-member-online' : 'room-member-offline'}" title="${m.online?'Online':'Offline'}"></div>
    </div>`).join('');
}

// ── Render: Audit log ──
async function loadAuditLog() {
  if (!_sb || !_roomState.roomId) return;
  const wrap = document.getElementById('audit-log-wrap');
  if (!wrap) return;
  const { data } = await _sb.from('audit_log').select('*, profiles(display_name)')
    .eq('room_id', _roomState.roomId).order('created_at', { ascending: false }).limit(30);
  if (!data?.length) {
    wrap.innerHTML = '<div style="padding:12px;color:var(--text3);font-size:12px;text-align:center;">No activity yet.</div>';
    return;
  }
  // Colour coding per activity category
  const actionColor = {
    member_joined: '#4ade80', member_left: '#f87171', member_kicked: '#f87171',
    room_created: '#a78bfa', ball_added: '#38bdf8', wicket: '#fbbf24',
    update: '#38bdf8', innings_end: '#fb923c', match_end: '#fbbf24', full_sync: '#94a3b8',
  };
  wrap.innerHTML = '<div class="room-member-list">' + data.map((entry, i) => {
    const who = esc(entry.profiles?.display_name || entry.new_value?.name || '?');
    const action = entry.action;
    const label = formatAuditAction(action);
    const color = actionColor[action] || '#94a3b8';
    // For kicks, show who was kicked
    const extra = (action === 'member_kicked' && entry.new_value?.kicked_name)
      ? ` <span style="color:#f87171;font-weight:700;">${esc(entry.new_value.kicked_name)}</span>`
      : '';
    return `<div class="audit-row" style="${i > 0 ? 'border-top:1px solid var(--border);' : ''}">
      <div style="width:6px;height:6px;border-radius:50%;background:${color};flex-shrink:0;margin-top:4px;"></div>
      <div style="flex:1;min-width:0;">
        <span style="font-weight:700;color:var(--text);font-size:12px;">${who}</span>
        <span style="color:var(--text3);font-size:12px;"> — ${label}${extra}</span>
      </div>
      <div class="audit-time">${formatRelTime(entry.created_at)}</div>
    </div>`;
  }).join('') + '</div>';
}

// ── Activity logging helper ──
async function logActivity(action, meta = {}) {
  if (!_sb || !_roomState.roomId || !_roomState.userId) return;
  try {
    await _sb.from('audit_log').insert({
      room_id: _roomState.roomId,
      user_id: _roomState.userId,
      action,
      new_value: { name: _roomState.userName, ...meta },
    });
    if (_roomState.lobbyOpen) loadAuditLog();
  } catch(e) { /* silently ignore */ }
}

function formatAuditAction(action) {
  const map = {
    ball_added:    '\ud83c\udfd1 Added a ball',
    wicket:        '\ud83c\udfaf Took a wicket',
    update:        '\ud83d\udcca Updated score',
    full_sync:     '\ud83d\udd04 Synced state',
    innings_end:   '\ud83c\udfc1 Ended innings',
    match_end:     '\ud83c\udfc6 Ended match',
    member_joined: '\ud83d\udfe2 Joined the room',
    member_left:   '\ud83d\udd34 Left the room',
    member_kicked: '\u26d4 Was removed by host',
    room_created:  '\ud83c\udfe0 Created the room',
  };
  return map[action] || action;
}
function formatRelTime(ts) {
  const d = new Date(ts), n = Date.now(), diff = n - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
  return d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}

// ── Render: Setup ──
function renderRoomSetup() {
  document.getElementById('room-sheet-body').innerHTML = `
    <button onclick="renderRoomHome()" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:0 0 12px;font-size:13px;display:flex;align-items:center;gap:4px;">
      <i class="ti ti-arrow-left"></i> Back
    </button>
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;margin-bottom:4px;">Room Setup</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:14px;">
      Rooms use <b>Supabase</b> for real-time sync. Create a free project at
      <a href="https://supabase.com" target="_blank" style="color:var(--sport-primary);">supabase.com</a>,
      then paste your Project URL and anon key below.
    </div>
    <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);">Project URL</label>
    <input id="setup-sb-url" class="input" style="margin:6px 0 12px;" placeholder="https://xxxx.supabase.co"
      value="${ROOM_CFG.supabaseUrl}" />
    <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);">Anon Key</label>
    <input id="setup-sb-key" class="input" style="margin:6px 0 14px;" placeholder="eyJhbGciOiJIUzI1…"
      value="${ROOM_CFG.supabaseKey}" type="password" />
    <button class="btn primary full" onclick="saveRoomSetup()" style="font-size:15px;padding:13px;">
      <i class="ti ti-check"></i> Save & Connect
    </button>
    <div style="margin-top:16px;background:var(--surface-2);border-radius:12px;padding:12px;font-size:11px;color:var(--text3);">
      <b style="color:var(--text2);">SQL to run in Supabase SQL editor:</b><br><br>
      <code style="font-size:10px;line-height:1.7;display:block;white-space:pre-wrap;">CREATE TABLE profiles (id UUID PRIMARY KEY REFERENCES auth.users(id), display_name TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE rooms (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code TEXT UNIQUE NOT NULL, host_id UUID REFERENCES profiles(id), sport TEXT, match_name TEXT, state TEXT DEFAULT 'waiting', scoring_locked BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ);
CREATE TABLE room_members (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), room_id UUID REFERENCES rooms(id) ON DELETE CASCADE, user_id UUID REFERENCES profiles(id), role TEXT DEFAULT 'viewer', joined_at TIMESTAMPTZ DEFAULT now(), UNIQUE(room_id,user_id));
CREATE TABLE match_state (room_id UUID PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE, sport TEXT, state_data JSONB DEFAULT '{}', version BIGINT DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT now(), updated_by UUID REFERENCES profiles(id));
CREATE TABLE audit_log (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), room_id UUID REFERENCES rooms(id) ON DELETE CASCADE, user_id UUID REFERENCES profiles(id), action TEXT, old_value JSONB, new_value JSONB, created_at TIMESTAMPTZ DEFAULT now());
-- Helper function (SECURITY DEFINER bypasses RLS to prevent infinite recursion)
CREATE OR REPLACE FUNCTION is_room_member(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM room_members WHERE room_id = p_room_id AND user_id = p_user_id);
$$;
CREATE OR REPLACE FUNCTION is_room_member_role(p_room_id UUID, p_user_id UUID, p_roles TEXT[])
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM room_members WHERE room_id = p_room_id AND user_id = p_user_id AND role = ANY(p_roles));
$$;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms_select" ON rooms FOR SELECT USING (is_room_member(id, auth.uid()));
CREATE POLICY "rooms_insert" ON rooms FOR INSERT WITH CHECK (host_id = auth.uid());
CREATE POLICY "rooms_update" ON rooms FOR UPDATE USING (host_id = auth.uid());
CREATE POLICY "members_select" ON room_members FOR SELECT USING (user_id = auth.uid() OR is_room_member(room_id, auth.uid()));
CREATE POLICY "members_insert" ON room_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "state_insert" ON match_state FOR INSERT WITH CHECK (is_room_member_role(room_id, auth.uid(), ARRAY['host']));
CREATE POLICY "state_update" ON match_state FOR UPDATE USING (is_room_member_role(room_id, auth.uid(), ARRAY['host','scorer']));
CREATE POLICY "state_select" ON match_state FOR SELECT USING (is_room_member(room_id, auth.uid()));
CREATE POLICY "audit_insert" ON audit_log FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "audit_select" ON audit_log FOR SELECT USING (is_room_member(room_id, auth.uid()));
ALTER PUBLICATION supabase_realtime ADD TABLE rooms, match_state, room_members;</code>
    </div>
  `;
}

// saveRoomSetup replaced by saveRoomSetupModal

// ── Helpers ──
function copyRoomCode(code) {
  navigator.clipboard?.writeText(code).then(() => toast('Room code copied!'));
}
function copyRoomLink(link) {
  navigator.clipboard?.writeText(link).then(() => toast('Invite link copied!'));
}
function updateRoomLobbyState(state) {
  const el = document.getElementById('lobby-state-badge');
  if (el) { el.className = 'room-lobby-state ' + state; el.textContent = state; }
}

// ── Sign-in UI ──
function renderRoomSignIn() {
  document.getElementById('room-sheet-body').innerHTML = `
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:900;margin-bottom:4px;">Sign In</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:14px;">Enter your name to join or create a room. No password needed.</div>
    <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);">Display Name</label>
    <input id="room-display-name" class="input" style="margin:6px 0 14px;" placeholder="e.g. Rohit, Scorer123" />
    <button class="btn primary full" onclick="signInAnon().then(u=>{if(u)renderRoomHome();})" style="font-size:15px;padding:13px;">
      <i class="ti ti-user-check"></i> Continue
    </button>
  `;
}

// ── Intercept save() to push to room when active ──
const _origSave = save;
save = function(localOnly = false) {
  _origSave();
  if (_roomState.active && !localOnly) {
    roomPushState('update');
  }
};

// ── Check URL for invite code on load ──
function checkRoomInviteUrl() {
  const params = new URLSearchParams(location.search);
  const code = params.get('room');
  if (code && initSupabase()) {
    openRoomOverlay();
    renderRoomJoinFlow();
    setTimeout(() => {
      const inp = document.getElementById('join-code-input');
      if (inp) inp.value = code.toUpperCase();
    }, 300);
  }
}

// ── Room Setup Modal ──
function openRoomSetupModal() {
  const overlay = document.getElementById('room-setup-modal-overlay');
  // Pre-fill existing values
  const urlEl = document.getElementById('modal-sb-url');
  const keyEl = document.getElementById('modal-sb-key');
  if (urlEl) urlEl.value = ROOM_CFG.supabaseUrl || '';
  if (keyEl) keyEl.value = ROOM_CFG.supabaseKey || '';
  overlay.classList.add('visible');
}
function closeRoomSetupModal() {
  document.getElementById('room-setup-modal-overlay').classList.remove('visible');
}
function saveRoomSetupModal() {
  const url = document.getElementById('modal-sb-url')?.value.trim();
  const key = document.getElementById('modal-sb-key')?.value.trim();
  if (!url || !key) { toast('Both URL and anon key are required'); return; }
  _lsSet('room_supabase_url', url);
  _lsSet('room_supabase_key', key);
  ROOM_CFG.supabaseUrl = url;
  ROOM_CFG.supabaseKey = key;
  _sb = null; // reset so initSupabase re-creates
  if (initSupabase()) {
    toast('✅ Supabase connected! You can now create and join rooms.');
    closeRoomSetupModal();
    updateRoomEntryCredsBanner();
  } else {
    toast('Connection failed — check your URL and anon key');
  }
}
function copySQLSetup() {
  const sql = document.getElementById('room-setup-sql-block')?.textContent || '';
  navigator.clipboard?.writeText(sql).then(() => toast('SQL copied!'));
}

// ═══════════════════════════════════════════════════════
// PICKLEBALL ENGINE
// ═══════════════════════════════════════════════════════
