function addFootballPlayer() {
  const num = parseInt(document.getElementById('fb-player-num-input').value);
  const rawName = document.getElementById('fb-player-name-input').value.trim();
  if (!num || !rawName) { toast('Enter number and name.'); return; }
  if (S.football.squad.find(p => p.num === num)) { toast('#' + num + ' already registered.'); return; }
  // Case-insensitive name duplicate check — "adi", "ADI", "Adi" are the same player
  const existingByName = S.football.squad.find(p => p.name.toLowerCase() === rawName.toLowerCase());
  if (existingByName) { toast(existingByName.name + ' already in squad.'); document.getElementById('fb-player-name-input').value = ''; return; }
  // Use existing casing if player name already exists (normalise to first-entered casing)
  const name = rawName;
  S.football.squad.push({ num, name, team: 'home' }); // default home; could add toggle
  document.getElementById('fb-player-num-input').value = '';
  document.getElementById('fb-player-name-input').value = '';
  renderFootballSquad();
  save();
}

function renderFootballSquad() {
  const el = document.getElementById('fb-squad-list');
  if (!S.football.squad.length) { el.innerHTML = ''; return; }
  el.innerHTML = S.football.squad.map(p =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(148,163,184,.07);font-size:12px;">
      <span><strong>#${p.num}</strong> ${esc(p.name)}</span>
      <button class="btn xs danger" onclick="removeFootballPlayer(${p.num})">&times;</button>
    </div>`
  ).join('');
}

function removeFootballPlayer(num) {
  S.football.squad = S.football.squad.filter(p => p.num !== num);
  renderFootballSquad();
  save();
}

function startFootballMatch() {
  S.football.homeTeam = document.getElementById('fb-home-name').value.trim() || 'Home FC';
  S.football.awayTeam = document.getElementById('fb-away-name').value.trim() || 'Away FC';
  S.football.duration = parseInt(document.getElementById('fb-duration').value) || 90;
  S.football.homeScore = 0;
  S.football.awayScore = 0;
  S.football.events = [];
  S.football.timerSeconds = 0;
  S.football.half = 1;
  S.football.matchStarted = true;
  S.football.matchOver = false;
  save();
  showTab('live');
  document.getElementById('football-no-match').classList.add('hidden');
  document.getElementById('football-live-ui').classList.remove('hidden');
  renderFootballLive();
  addCommentary('football', 'start');
  toast('Kick off!');
}

function renderFootballLive() {
  document.getElementById('fb-home-display').textContent = S.football.homeTeam;
  document.getElementById('fb-away-display').textContent = S.football.awayTeam;
  document.getElementById('fb-home-score').textContent = S.football.homeScore;
  document.getElementById('fb-away-score').textContent = S.football.awayScore;
  document.getElementById('fb-goal-home-label').textContent = S.football.homeTeam;
  document.getElementById('fb-goal-away-label').textContent = S.football.awayTeam;
  updateFootballTimerDisplay();
  renderFootballEventLog();
}

function toggleFootballTimer() {
  if (S.football.timerRunning) {
    clearInterval(_fbTimerInterval);
    _fbTimerInterval = null;
    S.football.timerRunning = false;
    document.getElementById('fb-timer-btn').innerHTML = '<i class="ti ti-player-play"></i> Resume';
  } else {
    S.football.timerRunning = true;
    document.getElementById('fb-timer-btn').innerHTML = '<i class="ti ti-player-pause"></i> Pause';
    _fbTimerInterval = setInterval(() => {
      S.football.timerSeconds++;
      save();
      updateFootballTimerDisplay();
      // Auto half-time at duration/2
      if (S.football.half === 1 && S.football.timerSeconds >= (S.football.duration / 2) * 60) {
        // Just notify, don't auto-pause
      }
    }, 1000);
  }
  save();
}

function updateFootballTimerDisplay() {
  const mins = Math.floor(S.football.timerSeconds / 60);
  const secs = S.football.timerSeconds % 60;
  document.getElementById('fb-timer-display').textContent =
    `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  document.getElementById('fb-half-label').textContent =
    S.football.half === 1 ? '1st Half' : '2nd Half';
}

function resetFootballTimer() {
  if (_fbTimerInterval) { clearInterval(_fbTimerInterval); _fbTimerInterval = null; }
  S.football.timerSeconds = 0;
  S.football.timerRunning = false;
  document.getElementById('fb-timer-btn').innerHTML = '<i class="ti ti-player-play"></i> Start';
  updateFootballTimerDisplay();
  save();
}

function startSecondHalf() {
  if (_fbTimerInterval) { clearInterval(_fbTimerInterval); _fbTimerInterval = null; }
  S.football.half = 2;
  S.football.timerSeconds = (S.football.duration / 2) * 60;
  S.football.timerRunning = false;
  document.getElementById('fb-timer-btn').innerHTML = '<i class="ti ti-player-play"></i> Start';
  updateFootballTimerDisplay();
  toast('2nd Half — tap Start to kick off!');
  save();
}

function footballGoal(team) {
  if (!canEdit()) { toast('Viewer mode.'); return; }
  const mins = Math.floor(S.football.timerSeconds / 60);
  if (team === 'home') S.football.homeScore++;
  else S.football.awayScore++;
  S.football.events.push({ type: 'goal', team, mins, playerNum: null });
  renderFootballLive();
  addCommentary('football', 'goal', { team: team === 'home' ? S.football.homeTeam : S.football.awayTeam });
  save();
  toast(`GOAL! ${team === 'home' ? S.football.homeTeam : S.football.awayTeam} scores!`);
}

function logCardOrFoul(action) {
  if (!canEdit()) { toast('Viewer mode.'); return; }
  _currentFbAction = action;
  // If squad, show player picker; else just log with time
  if (S.football.squad.length > 0) {
    const grid = document.getElementById('fb-player-grid');
    const [type, team] = action.split('-');
    const squadTeam = team === 'home' ? 'home' : 'away';
    const players = S.football.squad;
    grid.innerHTML = players.map(p =>
      `<div class="fb-player-num" onclick="commitFootballEvent(${p.num})">${p.num}</div>`
    ).join('');
    document.getElementById('fb-player-modal-title').innerHTML =
      `<i class="ti ti-card-clubs"></i> ${type.charAt(0).toUpperCase() + type.slice(1)} — Select Player`;
    openModal('fb-player-modal');
  } else {
    commitFootballEvent(null);
  }
}

function commitFootballEvent(playerNum) {
  closeModal('fb-player-modal');
  const mins = Math.floor(S.football.timerSeconds / 60);
  const [type, team] = _currentFbAction.split('-');
  S.football.events.push({ type, team, mins, playerNum });
  renderFootballEventLog();
  addCommentary('football', type, { team: team === 'home' ? S.football.homeTeam : S.football.awayTeam });
  save();
  const playerStr = playerNum ? ` (#${playerNum})` : '';
  toast(`${type.charAt(0).toUpperCase()+type.slice(1)} — ${team}${playerStr} at ${mins}'`);
}

function renderFootballEventLog() {
  const el = document.getElementById('fb-event-log');
  if (!S.football.events.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:12px 0;">No events yet.</div>';
    return;
  }
  const eventIcons = { goal: '<i class="ti ti-ball-football" style="color:#4ade80"></i>', yellow: '<i class="ti ti-cards" style="color:#facc15"></i>', red: '<i class="ti ti-cards" style="color:#f87171"></i>', foul: '<i class="ti ti-alert-triangle" style="color:#fb923c"></i>' };
  el.innerHTML = [...S.football.events].reverse().map(e =>
    `<div class="fb-event">
      <div class="fb-event-min">${e.mins}'</div>
      <div class="fb-event-icon">${eventIcons[e.type] || '•'}</div>
      <div class="fb-event-text">${e.type.charAt(0).toUpperCase()+e.type.slice(1)} — ${e.team}${e.playerNum ? ' (#'+e.playerNum+')' : ''}</div>
     </div>`
  ).join('');
}

function undoFootballEvent() {
  if (!S.football.events.length) { toast('Nothing to undo.'); return; }
  const last = S.football.events.pop();
  if (last.type === 'goal') {
    if (last.team === 'home') S.football.homeScore = Math.max(0, S.football.homeScore - 1);
    else S.football.awayScore = Math.max(0, S.football.awayScore - 1);
  }
  renderFootballLive();
  save();
  toast('Undone.');
}

function endFootballMatch() {
  if (_fbTimerInterval) { clearInterval(_fbTimerInterval); _fbTimerInterval = null; }
  S.football.timerRunning = false;
  S.football.matchOver = true;
  const home = S.football.homeScore, away = S.football.awayScore;
  const result = home > away ? `${S.football.homeTeam} wins ${home}–${away}` :
                 away > home ? `${S.football.awayTeam} wins ${away}–${home}` :
                 `Draw ${home}–${away}`;

  // ── Build per-player football stats for this match ──
  const footballPlayerStats = [];
  S.football.squad.forEach(sq => {
    const eventsForPlayer = S.football.events.filter(e => e.playerNum === sq.num);
    const goals = eventsForPlayer.filter(e => e.type === 'goal').length;
    const yellow = eventsForPlayer.filter(e => e.type === 'yellow').length;
    const red = eventsForPlayer.filter(e => e.type === 'red').length;
    const fouls = eventsForPlayer.filter(e => e.type === 'foul').length;
    if (sq.name) {
      footballPlayerStats.push({ name: sq.name, goals, assists: 0, yellow, red, fouls });
      // Persist to global player identity — football profile, fully isolated
      const gp = _getOrCreatePlayer(sq.name);
      gp.football.matches += 1;
      gp.football.goals += goals;
      gp.football.yellowCards += yellow;
      gp.football.redCards += red;
      gp.football.fouls += fouls;
    }
  });

  saveToHistory({
    sport: 'football',
    title: `${S.football.homeTeam} vs ${S.football.awayTeam}`,
    result,
    date: new Date().toLocaleDateString(),
    detail: `${home}–${away}`,
    footballPlayerStats,
  });
  save();
  toast('Full Time! ' + result);
  renderHistory();
}

// ═══════════════════════════════════════════════════════
// ══════ BADMINTON ══════
// ═══════════════════════════════════════════════════════