function addCricketPlayer() {
  const inp = document.getElementById('cricket-player-input');
  const rawName = inp.value.trim();
  if (!rawName) return;
  hideSuggestions();
  // Case-insensitive duplicate check
  const existingPlayer = S.cricket.players.find(p => p.toLowerCase() === rawName.toLowerCase());
  if (existingPlayer) { toast('Player already added.'); inp.value=''; return; }
  // Use existing library casing if present, else use as typed
  const libMatch = S.library.find(p => p.name.toLowerCase() === rawName.toLowerCase());
  const name = libMatch ? libMatch.name : rawName;
  S.cricket.players.push(name);
  // Auto-add to library if not there
  if (!libMatch) {
    S.library.push({ name, role: 'All-rounder', trivia: '', photo: null });
  }
  inp.value = '';
  renderCricketPlayersList();
  renderLibrary();
  renderProfiles();
  save();
}

function addSampleCricketPlayers() {
  SAMPLE_PLAYERS.forEach(p => {
    if (!S.cricket.players.find(existing => existing.toLowerCase() === p.toLowerCase())) S.cricket.players.push(p);
    if (!S.library.find(lp => lp.name.toLowerCase() === p.toLowerCase())) S.library.push({ name: p, role: 'All-rounder', trivia: '', photo: null });
  });
  renderCricketPlayersList();
  renderLibrary();
  save();
  toast('Demo players added!');
}

function clearCricketPlayers() {
  S.cricket.players = [];
  S.cricket.teamA = [];
  S.cricket.teamB = [];
  renderCricketPlayersList();
  document.getElementById('cricket-teams-output').classList.add('hidden');
  save();
}

function removeCricketPlayer(name) {
  S.cricket.players = S.cricket.players.filter(p => p !== name);
  renderCricketPlayersList();
  save();
}

function renderCricketPlayersList() {
  const el = document.getElementById('cricket-players-list');
  if (!S.cricket.players.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);">No players yet. Type a name above.</div>';
    return;
  }
  const allStats = computeCricketAllStats();
  el.innerHTML = S.cricket.players.map(name => {
    const libPlayer = S.library.find(p => p.name === name) || {};
    const s = allStats[name] || {};
    const rating = computePlayerRating(s);
    const role = libPlayer.role || 'All-rounder';
    const avatarHtml = libPlayer.photo
      ? `<img src="${libPlayer.photo}" alt="${esc(name)}"/>`
      : `<div class="cricket-player-avatar-init">${esc(name.charAt(0).toUpperCase())}</div>`;
    const ratingHtml = rating > 0
      ? `<div class="cricket-player-rating"><i class="ti ti-star-filled" style="color:#fbbf24;font-size:10px;vertical-align:-1px;"></i> ${rating.toFixed(1)}</div>`
      : '';
    return `<div class="cricket-player-row">
      <div class="cricket-player-avatar">${avatarHtml}</div>
      <div class="cricket-player-name">${esc(name)}<span style="font-size:10px;color:var(--text3);font-weight:400;margin-left:6px;">${esc(role)}</span></div>
      ${ratingHtml}
      <button class="btn xs danger" onclick="removeCricketPlayer('${esc(name)}')" style="margin-left:4px;">&times;</button>
    </div>`;
  }).join('');
}

function setCricketFormat(fmt) {
  S.cricket.format = fmt;
  document.getElementById('fmt-single-btn').classList.toggle('primary-flat', fmt === 'single');
  document.getElementById('fmt-series-btn').classList.toggle('primary-flat', fmt === 'series');
  const configCard = document.getElementById('cricket-series-config');
  if (configCard) configCard.classList.toggle('hidden', fmt !== 'series');
  const note = document.getElementById('series-size-note');
  if (note) note.textContent = fmt === 'series' ? `${S.cricket.seriesSize}-match series selected.` : 'Single match mode selected.';
  if (fmt === 'single') {
    S.cricket.seriesInfo = Object.assign(S.cricket.seriesInfo || {}, { type:'single', current:1, total:1, wins:{ A:0, B:0 } });
  } else {
    S.cricket.seriesInfo = Object.assign({ type:'series', current:1, total:S.cricket.seriesSize || 3, wins:{ A:0, B:0 } }, S.cricket.seriesInfo || {});
    S.cricket.seriesInfo.type = 'series';
    S.cricket.seriesInfo.total = S.cricket.seriesSize || 3;
  }
  save();
  renderCricketSeriesBoard();
  updateActiveHouseRulesDisplay();
}

function setCricketSeriesSize(size) {
  S.cricket.seriesSize = size;
  document.getElementById('series-3-btn').classList.toggle('primary-flat', size === 3);
  document.getElementById('series-5-btn').classList.toggle('primary-flat', size === 5);
  const note = document.getElementById('series-size-note');
  if (note) note.textContent = `Series size set to best of ${size}.`;
  if (S.cricket.format === 'series' && S.cricket.seriesInfo) {
    S.cricket.seriesInfo.total = size;
  }
  save();
  renderCricketSeriesBoard();
}

function refreshCricketSetupUI() {
  const fmt = S.cricket.format || 'single';
  setCricketFormat(fmt);
  setCricketSeriesSize(S.cricket.seriesSize || 3);
  renderHouseRules();
  renderCricketSeriesBoard();
  updateActiveHouseRulesDisplay();
}

function toggleHouseRule(id) {
  if (!S.cricket.houseRules) S.cricket.houseRules = getDefaultCricketHouseRules();
  S.cricket.houseRules[id] = !S.cricket.houseRules[id];
  renderHouseRules();
  updateActiveHouseRulesDisplay();
  save();
}

function renderHouseRules() {
  const el = document.getElementById('cricket-house-rules-list');
  if (!el) return;
  const rules = HOUSE_RULES_CONFIG.map(rule => {
    const active = !!S.cricket.houseRules?.[rule.id];
    return `
      <div class="house-rule-row">
        <div>
          <div class="house-rule-name">${esc(rule.name)}</div>
          <div class="house-rule-desc">${esc(rule.desc)}</div>
        </div>
        <button type="button" class="settings-toggle ${active ? 'on' : 'off'}" onclick="toggleHouseRule('${rule.id}')"></button>
      </div>`;
  }).join('');
  el.innerHTML = rules;
}

function updateActiveHouseRulesDisplay() {
  const el = document.getElementById('cricket-active-house-rules');
  if (!el) return;
  const active = HOUSE_RULES_CONFIG.filter(rule => !!S.cricket.houseRules?.[rule.id]);
  if (!active.length) {
    el.innerHTML = '<div class="alert info" style="font-size:11px;">No house rules active.</div>';
    return;
  }
  el.innerHTML = `<div class="house-rule-badges">${active.map(rule => `<span class="house-rule-chip">${esc(rule.name)}</span>`).join('')}</div>`;
}

function renderCricketSeriesBoard() {
  const el = document.getElementById('cricket-series-board');
  const liveEl = document.getElementById('cricket-live-series-board');
  const series = S.cricket.seriesInfo || { type:'single', current:1, total:1, wins:{ A:0, B:0 } };
  const isSeries = S.cricket.format === 'series';
  if (el) el.classList.toggle('hidden', !isSeries);
  if (liveEl) liveEl.classList.toggle('hidden', !isSeries);
  if (!isSeries) return;

  const teamA = S.cricket.teamAName || 'Team A';
  const teamB = S.cricket.teamBName || 'Team B';
  const majority = Math.ceil((series.total || 3) / 2);
  const winsA = series.wins.A || 0;
  const winsB = series.wins.B || 0;

  // Determine series status text + detect winner
  let status;
  let seriesOver = false;
  if (winsA >= majority) {
    status = `${teamA} won series`;
    seriesOver = true;
  } else if (winsB >= majority) {
    status = `${teamB} won series`;
    seriesOver = true;
  } else if (winsA === winsB) {
    status = 'Level';
  } else if (winsA > winsB) {
    status = `${teamA} lead`;
  } else {
    status = `${teamB} lead`;
  }

  // Current match label — if series is over, show final; otherwise show current game number
  const displayMatch = seriesOver
    ? series.total
    : Math.min(series.current || 1, series.total || 3);
  const labelText = `Series ${displayMatch} of ${series.total}`;

  // Update BOTH boards (setup tab + live tab)
  const boards = [
    {
      label: document.getElementById('cricket-series-label'),
      info:  document.getElementById('cricket-series-info'),
      score: document.getElementById('cricket-series-score'),
      statusEl: document.getElementById('cricket-series-status'),
    },
    {
      label: document.getElementById('cricket-live-series-label'),
      info:  document.getElementById('cricket-live-series-info'),
      score: document.getElementById('cricket-live-series-score'),
      statusEl: document.getElementById('cricket-live-series-status'),
    },
  ];

  boards.forEach(b => {
    if (b.label)    b.label.textContent    = labelText;
    if (b.info)     b.info.textContent     = `${teamA} ${winsA} - ${winsB} ${teamB}`;
    if (b.score)    b.score.textContent    = `${winsA} : ${winsB}`;
    if (b.statusEl) {
      b.statusEl.textContent = status;
      // Highlight winner status differently
      if (seriesOver) {
        b.statusEl.style.background = 'rgba(74,222,128,.18)';
        b.statusEl.style.color      = '#4ade80';
        b.statusEl.style.borderColor= 'rgba(74,222,128,.35)';
      } else {
        b.statusEl.style.background = '';
        b.statusEl.style.color      = '';
        b.statusEl.style.borderColor= '';
      }
    }
  });
}

function generateCricketTeams() {
  const players = [...S.cricket.players].filter(p => p && p.trim() !== '');
  if (players.length < 2) { toast('Add at least 2 players!'); return; }
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [players[i], players[j]] = [players[j], players[i]];
  }
  const isSeriesMode = S.cricket.series && S.cricket.series.total > 1;
  if (players.length % 2 === 1 || isSeriesMode) {
    const sharedIdx = Math.floor(players.length / 2);
    const sharedPlayer = players[sharedIdx];
    const rest = players.filter((_, i) => i !== sharedIdx);
    const half = Math.floor(rest.length / 2);
    S.cricket.teamA = [...rest.slice(0, half), sharedPlayer];
    S.cricket.teamB = [...rest.slice(half), sharedPlayer];
  } else {
    const half = players.length / 2;
    S.cricket.teamA = players.slice(0, half);
    S.cricket.teamB = players.slice(half);
  }
  S.cricket.teamAName = getCaptainTeamName(S.cricket.teamA[0], 'Team A');
  S.cricket.teamBName = getCaptainTeamName(S.cricket.teamB[0], 'Team B');
  renderCricketTeams();
  save();
  toast('Teams generated!');
}

function getCaptainTeamName(captainName, fallback) {
  const captain = (captainName || '').trim();
  if (!captain) return fallback;
  const firstName = captain.split(/\s+/)[0];
  const nameScore = [...captain].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const prefixes = ['Royal', 'Mighty', 'Thunder', 'Knight', 'Blazing', 'Prime', 'Golden', 'Super'];
  const suffixes = ['Titans', 'Strikers', 'Warriors', 'Rangers', 'Kings', 'Legends', 'Blasters', 'Callengers', 'Riders '];
  const prefix = prefixes[nameScore % prefixes.length];
  const suffix = suffixes[(nameScore + firstName.length) % suffixes.length];
  return `${firstName} ${prefix} ${suffix}`;
}

function renderCricketTeams() {
  const el = document.getElementById('cricket-teams-grid');
  const teamAInput = document.getElementById('team-a-name');
  const teamBInput = document.getElementById('team-b-name');
  if (teamAInput) teamAInput.value = S.cricket.teamAName;
  if (teamBInput) teamBInput.value = S.cricket.teamBName;
  const sharedPlayers = S.cricket.teamA.filter(player => S.cricket.teamB.includes(player));

  const renderTeamPlayers = (players) => players.filter(p => p && String(p).trim() !== '').map((p, i) => {
    const isCaptain = i === 0;
    return `<div class="team-player">
      ${isCaptain
        ? `<span class="team-captain-badge">C</span>`
        : '·'}
      ${esc(p)}
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="team-panel team-a-panel">
      <div class="team-panel-head">${esc(S.cricket.teamAName)} (${S.cricket.teamA.length})</div>
      ${renderTeamPlayers(S.cricket.teamA)}
    </div>
    <div class="team-panel team-b-panel">
      <div class="team-panel-head">${esc(S.cricket.teamBName)} (${S.cricket.teamB.length})</div>
      ${renderTeamPlayers(S.cricket.teamB)}
    </div>`;
  if (sharedPlayers.length) {
    el.insertAdjacentHTML('beforeend', `<div class="alert warn" style="grid-column:1/-1;font-size:11px;">Playing for both teams: ${sharedPlayers.map(esc).join(', ')}</div>`);
  }
  document.getElementById('cricket-teams-output').classList.remove('hidden');
}

function goToToss() {
  if (!S.cricket.teamA.length) { toast('Generate teams first!'); return; }
  const card = document.getElementById('toss-card');
  card.classList.remove('hidden');
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Populate toss winner select
  const sel = document.getElementById('toss-winner-sel');
  sel.innerHTML = `<option value="">Select...</option>
    <option value="A">${esc(S.cricket.teamAName)}</option>
    <option value="B">${esc(S.cricket.teamBName)}</option>`;

  document.getElementById('toss-teams-info').textContent =
    `${S.cricket.teamAName} vs ${S.cricket.teamBName}`;
}

function flipCoin() {
  const coinEl = document.getElementById('coin-el');
  coinEl.classList.add('flip');
  setTimeout(() => {
    coinEl.classList.remove('flip');
    const winner = Math.random() < 0.5 ? S.cricket.teamAName : S.cricket.teamBName;
    const choice = Math.random() < 0.5 ? 'bat' : 'field';
    document.getElementById('toss-result').textContent = `${winner} won the toss and chose to ${choice} first!`;
    document.getElementById('toss-result').classList.remove('hidden');
    document.getElementById('toss-winner-sel').value = winner === S.cricket.teamAName ? 'A' : 'B';
    document.getElementById('toss-choice-sel').value = choice;
    S.cricket.tossWinner = winner === S.cricket.teamAName ? 'A' : 'B';
    S.cricket.tossChoice = choice;
    save();
  }, 650);
}

function startCricketMatch() {
  S.cricket.tossWinner = document.getElementById('toss-winner-sel').value;
  S.cricket.tossChoice = document.getElementById('toss-choice-sel').value;
  S.cricket.overs = parseInt(document.getElementById('overs-input').value) || 10;
  if (!S.cricket.tossWinner) { toast('Select toss winner!'); return; }

  S.cricket.seriesInfo = S.cricket.format === 'series'
    ? Object.assign({ type:'series', current:1, total:S.cricket.seriesSize || 3, wins:{ A:0, B:0 } }, S.cricket.seriesInfo || {})
    : { type:'single', current:1, total:1, wins:{ A:0, B:0 } };

  S.cricket.innings = [
    { runs:0, wickets:0, balls:0, ballLog:[], playerStats:{}, currentOver:[] },
    { runs:0, wickets:0, balls:0, ballLog:[], playerStats:{}, currentOver:[] }
  ];
  S.cricket.matchStarted = true;
  S.cricket.matchOver = false;
  S.cricket.currentInnings = 1;
  S.cricket.striker = '';
  S.cricket.bowler = '';
  S.cricket._seriesResultApplied = false;
  initCricketPlayerStats(1);
  save();

  showTab('live');
  document.getElementById('cricket-no-match').classList.add('hidden');
  document.getElementById('cricket-live-ui').classList.remove('hidden');
  applyInningsTheme(1);
  document.getElementById('inn1-btn').className = 'inn-btn active inn-1';
  document.getElementById('inn2-btn').className = 'inn-btn inn-2';
  populateCricketSelects();
  updateCricketUI();
  renderCricketSeriesBoard();
  updateActiveHouseRulesDisplay();
  addCommentary('cricket', 'default', { bat: S.cricket.teamA[0] || 'Batter', bowl: S.cricket.teamB[0] || 'Bowler' });
  toast('Match started!');
}

function initCricketPlayerStats(inn) {
  const batters = inn === 1
    ? (S.cricket.tossChoice === 'bat' ? S.cricket.teamA : S.cricket.teamB)
    : (S.cricket.tossChoice === 'bat' ? S.cricket.teamB : S.cricket.teamA);
  const bowlers = inn === 1
    ? (S.cricket.tossChoice === 'bat' ? S.cricket.teamB : S.cricket.teamA)
    : (S.cricket.tossChoice === 'bat' ? S.cricket.teamA : S.cricket.teamB);
  const innObj = S.cricket.innings[inn-1];
  [...batters, ...bowlers].forEach(p => {
    if (!innObj.playerStats[p]) innObj.playerStats[p] = {runs:0,balls:0,fours:0,sixes:0,out:false,overs:0,runsConceded:0,wickets:0};
  });
}

function populateCricketSelects() {
  const inn = S.cricket.innings[S.cricket.currentInnings - 1];
  const batters = S.cricket.currentInnings === 1
    ? (S.cricket.tossChoice === 'bat' ? S.cricket.teamA : S.cricket.teamB)
    : (S.cricket.tossChoice === 'bat' ? S.cricket.teamB : S.cricket.teamA);
  const bowlers = S.cricket.currentInnings === 1
    ? (S.cricket.tossChoice === 'bat' ? S.cricket.teamB : S.cricket.teamA)
    : (S.cricket.tossChoice === 'bat' ? S.cricket.teamA : S.cricket.teamB);

  const strikerSel = document.getElementById('striker-sel');
  const bowlerSel = document.getElementById('bowler-sel');

  // Identify shared players (on both teams) — they must be excluded from the
  // bowler list while they are currently selected as the striker, and vice versa.
  const currentStriker = S.cricket.striker;
  const currentBowler  = S.cricket.bowler;

  // Build batter options — exclude anyone who is currently bowling
  const batterOptions = batters.filter(p => p !== currentBowler || !bowlers.includes(p));
  // Build bowler options — exclude anyone who is currently batting as striker
  const bowlerOptions = bowlers.filter(p => p !== currentStriker || !batters.includes(p));

  // All batters can bat — show "(out)" for dismissed
  strikerSel.innerHTML = batterOptions.map(p => {
    const ps = inn.playerStats[p];
    const isOut = ps && ps.out;
    return `<option value="${esc(p)}" ${isOut ? 'style="color:rgba(248,113,113,.7)"' : ''}>${esc(p)}${isOut ? ' (out)' : ''}</option>`;
  }).join('');

  bowlerSel.innerHTML = bowlerOptions.map(p => `<option>${esc(p)}</option>`).join('');

  if (S.cricket.striker && batterOptions.includes(S.cricket.striker)) strikerSel.value = S.cricket.striker;
  if (S.cricket.bowler  && bowlerOptions.includes(S.cricket.bowler))  bowlerSel.value  = S.cricket.bowler;
  S.cricket.striker = strikerSel.value;
  S.cricket.bowler  = bowlerSel.value;

  strikerSel.onchange = () => {
    S.cricket.striker = strikerSel.value;
    // If the newly selected striker is a shared player, remove them from bowler list
    _refreshBowlerOptions(batters, bowlers);
    save();
    updateCricketPlayerFigures();
  };
  bowlerSel.onchange = () => {
    S.cricket.bowler = bowlerSel.value;
    // If the newly selected bowler is a shared player, remove them from batter list
    _refreshStrikerOptions(batters, bowlers, inn);
    save();
    updateCricketPlayerFigures();
  };
  updateCricketPlayerFigures();
}

// Re-filter bowler dropdown when striker changes (to exclude shared player now batting)
function _refreshBowlerOptions(batters, bowlers) {
  const bowlerSel = document.getElementById('bowler-sel');
  if (!bowlerSel) return;
  const currentStriker = document.getElementById('striker-sel')?.value || '';
  const filtered = bowlers.filter(p => p !== currentStriker || !batters.includes(p));
  const prev = bowlerSel.value;
  bowlerSel.innerHTML = filtered.map(p => `<option>${esc(p)}</option>`).join('');
  if (filtered.includes(prev)) bowlerSel.value = prev;
  S.cricket.bowler = bowlerSel.value;
}

// Re-filter striker dropdown when bowler changes (to exclude shared player now bowling)
function _refreshStrikerOptions(batters, bowlers, inn) {
  const strikerSel = document.getElementById('striker-sel');
  if (!strikerSel) return;
  const currentBowler = document.getElementById('bowler-sel')?.value || '';
  const filtered = batters.filter(p => p !== currentBowler || !bowlers.includes(p));
  const prev = strikerSel.value;
  strikerSel.innerHTML = filtered.map(p => {
    const ps = inn ? inn.playerStats[p] : null;
    const isOut = ps && ps.out;
    return `<option value="${esc(p)}" ${isOut ? 'style="color:rgba(248,113,113,.7)"' : ''}>${esc(p)}${isOut ? ' (out)' : ''}</option>`;
  }).join('');
  if (filtered.includes(prev)) strikerSel.value = prev;
  S.cricket.striker = strikerSel.value;
}

function oversTextFromBalls(balls) {
  return `${Math.floor((balls || 0) / 6)}.${(balls || 0) % 6}`;
}

function updateCricketPlayerFigures() {
  const inn = S.cricket.innings[S.cricket.currentInnings - 1];
  if (!inn) return;
  const striker = document.getElementById('striker-sel')?.value || S.cricket.striker;
  const bowler = document.getElementById('bowler-sel')?.value || S.cricket.bowler;
  const strikerStats = inn.playerStats[striker] || { runs:0, balls:0 };
  const bowlerStats = inn.playerStats[bowler] || { wickets:0, ballsBowled:0 };
  const strikerFig = document.getElementById('striker-fig');
  const bowlerFig = document.getElementById('bowler-fig');
  if (strikerFig) strikerFig.textContent = `${strikerStats.runs || 0}(${strikerStats.balls || 0})`;
  if (bowlerFig) bowlerFig.textContent = `${bowlerStats.wickets || 0}/${oversTextFromBalls(bowlerStats.ballsBowled || 0)}`;
}

function recordBowlerBall(inn, bowler, isLegal, runsConceded = 0) {
  if (!inn.playerStats[bowler]) inn.playerStats[bowler] = {wickets:0,runsConceded:0,overs:0,ballsBowled:0};
  inn.playerStats[bowler].runsConceded = (inn.playerStats[bowler].runsConceded || 0) + runsConceded;
  if (isLegal) {
    inn.playerStats[bowler].ballsBowled = (inn.playerStats[bowler].ballsBowled || 0) + 1;
    inn.playerStats[bowler].overs = Math.floor((inn.playerStats[bowler].ballsBowled || 0) / 6);
  }
}

function finishOverIfComplete(inn) {
  const legalInOver = inn.currentOver.filter(b => b !== 'Wd' && b !== 'Nb').length;
  if (legalInOver >= 6 && inn.currentOver.length) {
    inn.ballLog.push([...inn.currentOver]);
    if (!inn.overBowlers) inn.overBowlers = [];
    inn.overBowlers.push(S.cricket.bowler || '');
    inn.currentOver = [];
    return true;
  }
  return false;
}

function getCurrentBowlingTeamPlayers() {
  return S.cricket.currentInnings === 1
    ? (S.cricket.tossChoice === 'bat' ? S.cricket.teamB : S.cricket.teamA)
    : (S.cricket.tossChoice === 'bat' ? S.cricket.teamA : S.cricket.teamB);
}

function promptNextBowler(previousBowler) {
  const sel = document.getElementById('next-bowler-sel');
  const allBowlers = getCurrentBowlingTeamPlayers();
  const currentStriker = S.cricket.striker;
  const battingTeamPlayers = getCurrentBattingTeamPlayers();
  // Exclude any shared player who is currently the striker
  const options = allBowlers.filter(p => !(p === currentStriker && battingTeamPlayers.includes(p)));
  sel.innerHTML = options.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  const next = options.find(p => p !== previousBowler) || options[0] || '';
  sel.value = next;
  openModal('next-bowler-modal');
}

function confirmNextBowler() {
  const bowler = document.getElementById('next-bowler-sel').value;
  if (!bowler) return;
  S.cricket.bowler = bowler;
  document.getElementById('bowler-sel').value = bowler;
  closeModal('next-bowler-modal');
  save();
  updateCricketPlayerFigures();
}

function cricketScore(runs) {
  if (!canEdit()) { toast('Viewer mode — cannot score.'); return; }
  const inn = S.cricket.innings[S.cricket.currentInnings - 1];
  const striker = document.getElementById('striker-sel').value;
  const bowler = document.getElementById('bowler-sel').value;
  const rules = S.cricket.houseRules || {};
  S.cricket.striker = striker;
  S.cricket.bowler = bowler;

  if (runs === 6 && rules.no_six) {
    cricketWicket();
    toast('No Sixes rule: six is out.');
    return;
  }
  if (runs === 4 && rules.no_four) {
    runs = 0;
    toast('No Fours rule: boundary not counted.');
  }

  inn.runs += runs;
  inn.balls++;
  inn.currentOver.push(runs === 0 ? '·' : String(runs));
  if (!inn.playerStats[striker]) inn.playerStats[striker] = {runs:0,balls:0,fours:0,sixes:0,out:false};
  inn.playerStats[striker].runs += runs;
  inn.playerStats[striker].balls++;
  if (runs === 4) inn.playerStats[striker].fours = (inn.playerStats[striker].fours||0)+1;
  if (runs === 6) inn.playerStats[striker].sixes = (inn.playerStats[striker].sixes||0)+1;
  recordBowlerBall(inn, bowler, true, runs);

  inn.consecutiveDotsByBatter = inn.consecutiveDotsByBatter || {};
  inn.consecutiveDotsByBatter[striker] = runs === 0 ? (inn.consecutiveDotsByBatter[striker] || 0) + 1 : 0;
  if (rules.three_dots_out && inn.consecutiveDotsByBatter[striker] >= 3) {
    inn.consecutiveDotsByBatter[striker] = 0;
    inn.wickets++;
    inn.currentOver[inn.currentOver.length] = 'W';
    inn.playerStats[striker].out = true;
    inn.playerStats[bowler].wickets = (inn.playerStats[bowler].wickets || 0) + 1;
    addCommentary('cricket', 'wicket', { bat: striker, bowl: bowler });
    const overCompleted = finishOverIfComplete(inn);
    save();
    updateCricketUI();
    if (overCompleted) promptNextBowler(bowler);
    else promptNextBatsman(striker);
    toast('3 Dot Balls rule: batter is out.');
    return;
  }

  const overCompleted = finishOverIfComplete(inn);

  // Check end conditions — innings ends on overs OR all players dismissed (all out)
  const maxBalls = S.cricket.overs * 6;
  const maxWicketsScoring = S.cricket.teamA.length; // all players must be dismissed
  if (inn.balls >= maxBalls || inn.wickets >= maxWicketsScoring) {
    if (S.cricket.currentInnings === 1) {
      S.cricket.currentInnings = 2;
      initCricketPlayerStats(2);
      save();
      switchInnings(2);
      showInningsBanner(inn1Runs => {
        const battingTeam2 = S.cricket.tossChoice === 'bat' ? S.cricket.teamBName : S.cricket.teamAName;
        const target = inn.runs + 1;
        return `2nd Innings — ${battingTeam2} need ${target} runs`;
      }, inn.runs);
      populateCricketSelects();
      updateCricketUI();
      toast('2nd Innings!');
      return;
    } else {
      checkCricketResult();
      return;
    }
  }

  // Check chase
  if (S.cricket.currentInnings === 2) {
    const inn1 = S.cricket.innings[0];
    if (inn.runs > inn1.runs) {
      checkCricketResult();
      return;
    }
  }

  const commentaryType = runs === 4 ? 'four' : runs === 6 ? 'six' : runs === 0 ? 'dot' : runs === 1 ? 'run1' : runs === 2 ? 'run2' : runs === 3 ? 'run3' : 'default';
  addCommentary('cricket', commentaryType, { bat: striker, bowl: bowler });
  save();
  updateCricketUI();
  if (overCompleted) promptNextBowler(bowler);
}

function cricketWicket() {
  if (!canEdit()) { toast('Viewer mode.'); return; }
  const inn = S.cricket.innings[S.cricket.currentInnings - 1];
  const striker = document.getElementById('striker-sel').value;
  const bowler = document.getElementById('bowler-sel').value;
  S.cricket.striker = striker;
  S.cricket.bowler = bowler;

  inn.wickets++;
  inn.balls++;
  inn.currentOver.push('W');
  if (!inn.playerStats[striker]) inn.playerStats[striker] = {runs:0,balls:0,out:false};
  inn.playerStats[striker].out = true;
  inn.playerStats[striker].balls++;
  if (!inn.playerStats[bowler]) inn.playerStats[bowler] = {wickets:0,runsConceded:0,overs:0};
  inn.playerStats[bowler].wickets = (inn.playerStats[bowler].wickets||0)+1;
  recordBowlerBall(inn, bowler, true, 0);
  addCommentary('cricket', 'wicket', { bat: striker, bowl: bowler });
  const overCompleted = finishOverIfComplete(inn);

  const maxWickets = S.cricket.teamA.length;
  if (inn.wickets >= maxWickets) {
    if (S.cricket.currentInnings === 1) {
      S.cricket.currentInnings = 2;
      initCricketPlayerStats(2);
      save();
      switchInnings(2);
      showInningsBanner(() => {
        const battingTeam2 = S.cricket.tossChoice === 'bat' ? S.cricket.teamBName : S.cricket.teamAName;
        const target = inn.runs + 1;
        return `All out! 2nd Innings — ${battingTeam2} need ${target} runs`;
      }, inn.runs);
      populateCricketSelects();
      updateCricketUI();
      toast('All out! 2nd Innings!');
      return;
    } else { checkCricketResult(); return; }
  }

  // Check if overs are exhausted (wicket on the last ball of the innings)
  const maxBallsWkt = S.cricket.overs * 6;
  if (inn.balls >= maxBallsWkt) {
    if (S.cricket.currentInnings === 1) {
      S.cricket.currentInnings = 2;
      initCricketPlayerStats(2);
      save();
      switchInnings(2);
      showInningsBanner(() => {
        const battingTeam2 = S.cricket.tossChoice === 'bat' ? S.cricket.teamBName : S.cricket.teamAName;
        const target = inn.runs + 1;
        return `2nd Innings — ${battingTeam2} need ${target} runs`;
      }, inn.runs);
      populateCricketSelects();
      updateCricketUI();
      toast('2nd Innings!');
      return;
    } else {
      checkCricketResult();
      return;
    }
  }

  save();
  updateCricketUI();
  if (overCompleted) {
    promptNextBowler(bowler);
    promptNextBatsman(striker);
  } else {
    promptNextBatsman(striker);
  }
}

function promptNextBatsman(outBatsman) {
  const battingTeamPlayers = getCurrentBattingTeamPlayers();
  const bowlingTeamPlayers = getCurrentBowlingTeamPlayers();
  const inn = S.cricket.innings[S.cricket.currentInnings - 1];
  const currentStriker = document.getElementById('striker-sel')?.value || '';
  const currentBowler  = S.cricket.bowler || '';

  const alreadyOut = Object.entries(inn.playerStats || {})
    .filter(([n, ps]) => ps.out)
    .map(([n]) => n);

  // Players who haven't batted yet — also exclude shared player currently bowling
  const notYetBatted = battingTeamPlayers.filter(p =>
    p !== outBatsman &&
    p !== currentStriker &&
    !alreadyOut.includes(p) &&
    !(p === currentBowler && bowlingTeamPlayers.includes(p)) // shared player currently bowling
  );

  const available = notYetBatted.length > 0
    ? notYetBatted
    : battingTeamPlayers.filter(p =>
        !alreadyOut.includes(p) &&
        p !== currentStriker &&
        !(p === currentBowler && bowlingTeamPlayers.includes(p))
      );

  if (!available.length) return;

  const sel = document.getElementById('next-batsman-sel');
  sel.innerHTML = available.map(p => {
    const ps = inn.playerStats[p];
    const isOut = ps && ps.out;
    return `<option value="${esc(p)}">${esc(p)}${isOut ? ' (out)' : ''}</option>`;
  }).join('');
  openModal('next-batsman-modal');
}

function confirmNextBatsman() {
  const batsman = document.getElementById('next-batsman-sel').value;
  if (!batsman) return;
  document.getElementById('striker-sel').value = batsman;
  S.cricket.striker = batsman;
  closeModal('next-batsman-modal');
  save();
  updateCricketPlayerFigures();
  toast(batsman + ' is in!');
}

function getCurrentBattingTeamPlayers() {
  return S.cricket.currentInnings === 1
    ? (S.cricket.tossChoice === 'bat' ? S.cricket.teamA : S.cricket.teamB)
    : (S.cricket.tossChoice === 'bat' ? S.cricket.teamB : S.cricket.teamA);
}

function openExtrasModal() {
  if (!canEdit()) { toast('Viewer mode.'); return; }
  if (!S.cricket.matchStarted || S.cricket.matchOver) { toast('No active match.'); return; }
  document.getElementById('extras-modal').classList.remove('hidden');
}

function cricketExtra(type) {
  closeModal('extras-modal');
  const inn = S.cricket.innings[S.cricket.currentInnings - 1];
  const striker = document.getElementById('striker-sel').value;
  const bowler = document.getElementById('bowler-sel').value;
  S.cricket.striker = striker;
  S.cricket.bowler = bowler;
  inn.runs += 1;
  inn.currentOver.push(type === 'wide' ? 'Wd' : type === 'noball' ? 'Nb' : type === 'bye' ? 'B' : 'Lb');
  const isLegal = type !== 'wide' && type !== 'noball';
  if (isLegal) {
    inn.balls++;
    if (!inn.playerStats[striker]) inn.playerStats[striker] = {runs:0,balls:0,fours:0,sixes:0,out:false};
    inn.playerStats[striker].balls++;
  }
  recordBowlerBall(inn, bowler, isLegal, type === 'wide' || type === 'noball' ? 1 : 0);
  const overCompleted = finishOverIfComplete(inn);
  addCommentary('cricket', type === 'wide' ? 'wide' : type === 'noball' ? 'noball' : 'default', { bat: striker, bowl: bowler });
  save();
  updateCricketUI();
  const maxBalls = S.cricket.overs * 6;
  if (inn.balls >= maxBalls) {
    if (S.cricket.currentInnings === 1) {
      S.cricket.currentInnings = 2;
      initCricketPlayerStats(2);
      save();
      switchInnings(2);
      showInningsBanner(() => {
        const battingTeam2 = S.cricket.tossChoice === 'bat' ? S.cricket.teamBName : S.cricket.teamAName;
        const target = inn.runs + 1;
        return `2nd Innings — ${battingTeam2} need ${target} runs`;
      }, inn.runs);
      populateCricketSelects();
      updateCricketUI();
      toast('2nd Innings!');
      return;
    }
    checkCricketResult();
    return;
  }
  if (S.cricket.currentInnings === 2 && inn.runs > S.cricket.innings[0].runs) {
    checkCricketResult();
    return;
  }
  if (overCompleted) promptNextBowler(bowler);
  toast(type.charAt(0).toUpperCase() + type.slice(1) + ' +1');
}

function undoCricketScore() {
  if (!requirePerm('score.undo')) return;
  const inn = S.cricket.innings[S.cricket.currentInnings - 1];

  // If current over is empty, restore the last completed over from ballLog
  if (!inn.currentOver.length) {
    if (!inn.ballLog || !inn.ballLog.length) { toast('Nothing to undo.'); return; }
    inn.currentOver = inn.ballLog.pop();
    if (inn.overBowlers && inn.overBowlers.length) inn.overBowlers.pop();
  }

  if (!inn.currentOver.length) { toast('Nothing to undo.'); return; }

  // Get the last ball symbol
  const lastBall = inn.currentOver[inn.currentOver.length - 1];
  inn.currentOver.pop();

  // Determine what the ball was and reverse it
  const striker = S.cricket.striker || document.getElementById('striker-sel')?.value || '';
  const bowler  = S.cricket.bowler  || document.getElementById('bowler-sel')?.value  || '';

  const isWide  = lastBall === 'Wd';
  const isNoBall = lastBall === 'Nb';
  const isBye   = lastBall === 'B';
  const isLegBye = lastBall === 'Lb';
  const isWicket = lastBall === 'W';
  const isExtra  = isWide || isNoBall || isBye || isLegBye;
  const isLegal  = !isWide && !isNoBall; // legal delivery counts as a ball

  // Runs to subtract from total
  let runsToRemove = 0;
  if (isExtra) runsToRemove = 1;
  else if (!isWicket) runsToRemove = lastBall === '·' ? 0 : parseInt(lastBall, 10) || 0;

  // Subtract innings totals
  inn.runs = Math.max(0, inn.runs - runsToRemove);
  if (isLegal) inn.balls = Math.max(0, inn.balls - 1);
  if (isWicket) inn.wickets = Math.max(0, inn.wickets - 1);

  // Reverse playerStats for striker
  if (striker && inn.playerStats[striker]) {
    const ps = inn.playerStats[striker];
    if (!isExtra && !isWicket) {
      // Normal runs ball
      ps.runs = Math.max(0, (ps.runs || 0) - runsToRemove);
      ps.balls = Math.max(0, (ps.balls || 0) - 1);
      if (lastBall === '4') ps.fours = Math.max(0, (ps.fours || 0) - 1);
      if (lastBall === '6') ps.sixes = Math.max(0, (ps.sixes || 0) - 1);
    } else if (isWicket) {
      ps.out = false;
      ps.balls = Math.max(0, (ps.balls || 0) - 1);
    } else if (isBye || isLegBye) {
      // Legal ball — remove from striker's balls faced
      ps.balls = Math.max(0, (ps.balls || 0) - 1);
    }
    // Wide/noball: striker's balls not incremented, so nothing to reverse
  }

  // Reverse playerStats for bowler
  if (bowler && inn.playerStats[bowler]) {
    const bp = inn.playerStats[bowler];
    bp.runsConceded = Math.max(0, (bp.runsConceded || 0) - runsToRemove);
    if (isLegal) {
      bp.ballsBowled = Math.max(0, (bp.ballsBowled || 0) - 1);
      bp.overs = Math.floor((bp.ballsBowled || 0) / 6);
    }
    if (isWicket) bp.wickets = Math.max(0, (bp.wickets || 0) - 1);
  }

  save();
  updateCricketUI();
  toast('Last ball undone.');
}

function switchInnings(n) {
  S.cricket.currentInnings = n;
  document.getElementById('inn1-btn').classList.toggle('active', n === 1);
  document.getElementById('inn2-btn').classList.toggle('active', n === 2);
  document.getElementById('inn1-btn').className = 'inn-btn' + (n === 1 ? ' active inn-1' : ' inn-1');
  document.getElementById('inn2-btn').className = 'inn-btn' + (n === 2 ? ' active inn-2' : ' inn-2');
  applyInningsTheme(n);
  populateCricketSelects();
  updateCricketUI();
  save();
}

function showInningsBanner(msgFn, runs) {
  const el = document.getElementById('innings-switch-banner');
  if (!el) return;
  el.textContent = typeof msgFn === 'function' ? msgFn(runs) : msgFn;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 5000);
}

function applyInningsTheme(n) {
  const ui = document.getElementById('cricket-live-ui');
  if (!ui) return;
  ui.classList.toggle('innings-1-theme', n === 1);
  ui.classList.toggle('innings-2-theme', n === 2);

  // Score color
  const scoreDisp = document.getElementById('score-disp');
  if (scoreDisp) {
    scoreDisp.classList.toggle('inn-1-score', n === 1);
    scoreDisp.classList.toggle('inn-2-score', n === 2);
    scoreDisp.style.color = '';
  }

  // Progress bar
  const fill = document.getElementById('overs-progress');
  if (fill) {
    fill.classList.toggle('inn-1', n === 1);
    fill.classList.toggle('inn-2', n === 2);
    fill.style.background = '';
  }

  // Body background tint
  document.body.style.setProperty('--innings-bg-tint',
    n === 1 ? 'rgba(100,70,240,.06)' : 'rgba(180,220,0,.05)');
}

function updateCricketUI() {
  const inn = S.cricket.innings[S.cricket.currentInnings - 1];
  const inn1 = S.cricket.innings[0];
  const completedOvers = Math.floor(inn.balls / 6);
  const ballsThisOver = inn.balls % 6;
  const overStr = `${completedOvers}.${ballsThisOver}`;
  const maxBalls = S.cricket.overs * 6;

  document.getElementById('score-disp').textContent = `${inn.runs}/${inn.wickets}`;
  document.getElementById('overs-disp').textContent = `${overStr} overs`;
  document.getElementById('overs-progress').style.width = `${Math.min(100, (inn.balls / maxBalls) * 100)}%`;

  const rr = inn.balls > 0 ? ((inn.runs / inn.balls) * 6).toFixed(2) : '0.00';
  document.getElementById('rr-disp').textContent = rr;
  document.getElementById('balls-left-disp').textContent = maxBalls - inn.balls;

  const battingTeam = S.cricket.currentInnings === 1
    ? (S.cricket.tossChoice === 'bat' ? S.cricket.teamAName : S.cricket.teamBName)
    : (S.cricket.tossChoice === 'bat' ? S.cricket.teamBName : S.cricket.teamAName);
  document.getElementById('batting-name').textContent = battingTeam;

  if (S.cricket.currentInnings === 2) {
    const target = inn1.runs + 1;
    document.getElementById('target-disp').textContent = target;
    const needed = target - inn.runs;
    const bLeft = maxBalls - inn.balls;
    const chaseEl = document.getElementById('chase-alert');
    if (needed <= 0 || bLeft <= 0) {
      chaseEl.classList.add('hidden');
    } else {
      chaseEl.classList.remove('hidden');
      chaseEl.textContent = `Need ${needed} runs from ${bLeft} balls (RRR: ${((needed / bLeft) * 6).toFixed(1)})`;
    }
  } else {
    document.getElementById('target-disp').textContent = '—';
    document.getElementById('chase-alert').classList.add('hidden');
  }

  // over-dots replaced by unified renderOverHistory

  updateCricketPlayerFigures();
  renderCricketSeriesBoard();
  updateActiveHouseRulesDisplay();
  updateCricketAnalytics();
  updateCricketScorecard();
  renderOverHistory(inn);
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function getInningsSymbols(inn) {
  return [...(inn.ballLog || []).flat(), ...(inn.currentOver || [])];
}

function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

function renderOverHistory(inn) {
  const list = document.getElementById('over-history-list');
  const card = document.getElementById('overs-unified-card');
  const liveBadge = document.getElementById('over-live-badge');
  if (!list) return;

  const completed = inn.ballLog || [];
  const current = inn.currentOver || [];
  const overBowlers = inn.overBowlers || [];

  const allOvers = completed.map((balls, i) => ({
    balls,
    bowler: overBowlers[i] || '',
    isCurrent: false,
    overNum: i + 1,
  }));

  if (current.length > 0) {
    allOvers.push({
      balls: current,
      bowler: S.cricket.bowler || '',
      isCurrent: true,
      overNum: completed.length + 1,
    });
  }

  // Show/hide live badge
  if (liveBadge) liveBadge.style.display = current.length > 0 ? '' : 'none';

  if (allOvers.length === 0) {
    list.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:4px 0;">No balls bowled yet.</div>';
    return;
  }

  // Render newest first so current over is always at top
  const rows = [...allOvers].reverse().map(({balls, bowler, isCurrent, overNum}) => {
    let overRuns = 0;
    balls.forEach(b => {
      if (b === 'W' || b === '·') return;
      if (b === 'Wd' || b === 'Nb' || b === 'B' || b === 'Lb') { overRuns += 1; return; }
      const n = parseInt(b, 10);
      if (!isNaN(n)) overRuns += n;
    });

    const ballsHtml = balls.map(b => {
      let cls = '';
      if (b === '4') cls = 'four';
      else if (b === '6') cls = 'six';
      else if (b === 'W') cls = 'wkt';
      else if (b === 'Wd' || b === 'Nb') cls = 'wide';
      const disp = b === '0' ? '·' : b;
      return `<div class="over-history-ball ${cls}">${disp}</div>`;
    }).join('');

    // Bowler name — abbreviated to first initial + last name
    const bowlerShort = bowler
      ? bowler.split(' ').map((w,i) => i === 0 && bowler.split(' ').length > 1 ? w[0]+'.' : w).join(' ')
      : '';

    const overLabel = isCurrent
      ? `<span style="color:var(--sport-primary);">Ov ${overNum}*</span>`
      : `<span>Ov ${overNum}</span>`;

    // Empty slots for current incomplete over
    const legalBalls = balls.filter(b => b !== 'Wd' && b !== 'Nb').length;
    const emptySlots = isCurrent ? Math.max(0, 6 - legalBalls) : 0;
    const emptySlotsHtml = Array(emptySlots).fill('<div class="over-history-ball empty"></div>').join('');

    return `<div class="over-history-row${isCurrent ? ' current-over-row' : ''}">
      <div class="over-history-meta">
        <div class="over-history-num">${overLabel}</div>
        ${bowlerShort ? `<div class="over-history-bowler">${esc(bowlerShort)}</div>` : ''}
      </div>
      <div class="over-history-balls">${ballsHtml}${emptySlotsHtml}</div>
      <div class="over-history-runs${isCurrent ? ' live-runs' : ''}">${overRuns}</div>
    </div>`;
  }).join('');

  list.innerHTML = rows;
}

function getRunRateTimeline(inn) {
  const timeline = [{ ball: 0, rr: 0 }];
  const wicketBalls = [];
  let runs = 0;
  let legalBalls = 0;
  getInningsSymbols(inn).forEach(symbol => {
    if (symbol === 'Wd' || symbol === 'Nb') {
      runs += 1;
      return;
    }
    if (symbol === 'B' || symbol === 'Lb') runs += 1;
    else if (!Number.isNaN(parseInt(symbol, 10))) runs += parseInt(symbol, 10);
    legalBalls += 1;
    const rr = legalBalls ? (runs / legalBalls) * 6 : 0;
    timeline.push({ ball: legalBalls, rr });
    if (symbol === 'W') wicketBalls.push({ ball: legalBalls, rr });
  });
  timeline.wickets = wicketBalls;
  return timeline;
}

function getBattingTeamName(innNum) {
  return innNum === 1
    ? (S.cricket.tossChoice === 'bat' ? S.cricket.teamAName : S.cricket.teamBName)
    : (S.cricket.tossChoice === 'bat' ? S.cricket.teamBName : S.cricket.teamAName);
}

function getBowlingTeamName(innNum) {
  return getBattingTeamName(innNum) === S.cricket.teamAName ? S.cricket.teamBName : S.cricket.teamAName;
}

function getWinProbability() {
  const inn = S.cricket.innings[S.cricket.currentInnings - 1];
  const inn1 = S.cricket.innings[0];
  const maxBalls = Math.max(1, S.cricket.overs * 6);
  const ballsLeft = Math.max(0, maxBalls - inn.balls);
  const maxWickets = Math.max(1, S.cricket.teamA.length);
  const wicketsLeft = Math.max(0, maxWickets - inn.wickets);
  const currentRR = inn.balls ? (inn.runs / inn.balls) * 6 : 0;
  let battingProb;

  if (S.cricket.currentInnings === 1) {
    const projected = inn.balls ? (inn.runs / inn.balls) * maxBalls : 0;
    const parScore = S.cricket.overs * 8;
    battingProb = 50 + ((projected - parScore) * 1.15) - (inn.wickets * 6) + (ballsLeft / maxBalls) * 8;
    battingProb = clamp(battingProb, 18, 82);
  } else {
    const target = inn1.runs + 1;
    const needed = target - inn.runs;
    if (needed <= 0) battingProb = 100;
    else if (ballsLeft <= 0 || wicketsLeft <= 0) battingProb = 0;
    else {
      const requiredRR = (needed / ballsLeft) * 6;
      battingProb = 50 + ((currentRR - requiredRR) * 8) + (wicketsLeft * 5) - ((maxBalls - ballsLeft) / maxBalls) * 10;
      battingProb = clamp(battingProb, 3, 97);
    }
  }

  const battingTeam = getBattingTeamName(S.cricket.currentInnings);
  const bowlingTeam = getBowlingTeamName(S.cricket.currentInnings);
  return { battingTeam, bowlingTeam, battingProb: Math.round(battingProb), bowlingProb: Math.round(100 - battingProb), currentRR };
}

function renderRunRateWorm() {
  const canvas = document.getElementById('run-rate-worm');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 340;
  const H = 190;
  canvas.width = W;
  canvas.height = H;

  const PAD_L = 22, PAD_R = 10, PAD_T = 22, PAD_B = 30;
  const maxBalls = Math.max(1, S.cricket.overs * 6);
  const totalOvers = S.cricket.overs || 10;

  const inn1tl = getRunRateTimeline(S.cricket.innings[0]);
  const inn2tl = getRunRateTimeline(S.cricket.innings[1]);
  const seriesData = [
    { data: inn1tl, wickets: inn1tl.wickets || [], color: '#fb923c', glow: 'rgba(251,146,60,', label: getBattingTeamName(1) },
    { data: inn2tl, wickets: inn2tl.wickets || [], color: '#4ade80', glow: 'rgba(74,222,128,', label: getBattingTeamName(2) }
  ].filter((s, i) => i === 0 || s.data.length > 1);

  const maxRR = Math.max(10, ...seriesData.flatMap(s => s.data.map(p => p.rr))) * 1.1;

  const xFor = ball => PAD_L + (ball / maxBalls) * (W - PAD_L - PAD_R);
  const yFor = rr => PAD_T + (1 - rr / maxRR) * (H - PAD_T - PAD_B);

  // Background
  ctx.fillStyle = '#0a0500';
  ctx.fillRect(0, 0, W, H);

  // Vertical over grid lines
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  for (let ov = 1; ov <= totalOvers; ov++) {
    const x = xFor(ov * 6);
    ctx.strokeStyle = 'rgba(251,146,60,.09)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(x, PAD_T); ctx.lineTo(x, H - PAD_B); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Horizontal RR grid lines + labels
  const rrSteps = [4, 8, 12, 16, 20];
  ctx.font = '9px DM Sans, sans-serif';
  rrSteps.forEach(rr => {
    if (rr > maxRR * 0.95) return;
    const y = yFor(rr);
    ctx.strokeStyle = 'rgba(255,255,255,.05)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.textAlign = 'right';
    ctx.fillText(rr, PAD_L - 3, y + 3);
  });

  // X-axis over labels
  ctx.textAlign = 'center';
  ctx.font = '9px DM Sans, sans-serif';
  for (let ov = 0; ov <= totalOvers; ov++) {
    if (ov % Math.max(1, Math.floor(totalOvers / 8)) !== 0 && ov !== totalOvers) continue;
    const x = xFor(ov * 6);
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.fillText(ov, x, H - PAD_B + 12);
  }
  // "Overs" axis label
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.font = '8px DM Sans, sans-serif';
  ctx.fillText('overs', PAD_L + chartW / 2, H - 2);

  // X axis line
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD_L, H - PAD_B);
  ctx.lineTo(W - PAD_R, H - PAD_B);
  ctx.stroke();

  // Draw each innings line
  seriesData.forEach(series => {
    const pts = series.data;
    if (pts.length < 2) return;

    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = xFor(p.ball), y = yFor(p.rr);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });

    // Outer glow stroke
    ctx.save();
    ctx.filter = 'blur(6px)';
    ctx.strokeStyle = series.glow + '.55)';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();

    // Crisp stroke
    ctx.strokeStyle = series.color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();

    // Filled gradient under line
    const fillPath = new Path2D();
    pts.forEach((p, i) => {
      const x = xFor(p.ball), y = yFor(p.rr);
      i === 0 ? fillPath.moveTo(x, y) : fillPath.lineTo(x, y);
    });
    fillPath.lineTo(xFor(pts[pts.length-1].ball), H - PAD_B);
    fillPath.lineTo(xFor(pts[0].ball), H - PAD_B);
    fillPath.closePath();
    const grad = ctx.createLinearGradient(0, PAD_T, 0, H - PAD_B);
    grad.addColorStop(0, series.glow + '.42)');
    grad.addColorStop(0.6, series.glow + '.1)');
    grad.addColorStop(1, series.glow + '0)');
    ctx.fillStyle = grad;
    ctx.fill(fillPath);

    // Peak dot
    const peakPt = pts.reduce((best, p) => p.rr > best.rr ? p : best, pts[0]);
    if (peakPt.rr > 0) {
      const px = xFor(peakPt.ball), py = yFor(peakPt.rr);
      ctx.save(); ctx.filter = 'blur(4px)';
      ctx.fillStyle = series.color;
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = series.color;
      ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI*2); ctx.fill();
      const labelX = Math.min(px + 6, W - PAD_R - 30);
      const labelY = Math.max(py - 6, PAD_T + 10);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px DM Sans, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(peakPt.rr.toFixed(1) + ' rr', labelX, labelY);
    }

    // ── Wicket fall markers ──
    (series.wickets || []).forEach(wkt => {
      const wx = xFor(wkt.ball), wy = yFor(wkt.rr);

      // Red glow pulse ring
      ctx.save();
      ctx.filter = 'blur(5px)';
      ctx.fillStyle = 'rgba(248,113,113,.7)';
      ctx.beginPath(); ctx.arc(wx, wy, 8, 0, Math.PI*2); ctx.fill();
      ctx.restore();

      // White outer ring
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(wx, wy, 5, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();

      // "W" label above
      ctx.fillStyle = '#fca5a5';
      ctx.font = 'bold 9px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('W', wx, wy - 9);
    });
  });

  // Legend
  const legendEl = document.getElementById('worm-legend');
  if (legendEl) {
    legendEl.innerHTML = seriesData.map(s =>
      `<div class="worm-legend-item">
        <div class="worm-legend-dot" style="background:${s.color};box-shadow:0 0 6px ${s.color};"></div>
        ${esc(s.label)}
        ${(s.wickets||[]).length ? `<span style="font-size:9px;color:#fca5a5;margin-left:4px;">● ${s.wickets.length}W</span>` : ''}
      </div>`
    ).join('');
  }
}
function updateCricketAnalytics() {
  const prob = getWinProbability();
  document.getElementById('worm-current-rr').textContent = `${prob.currentRR.toFixed(2)} RR`;
  document.getElementById('win-prob-team-a').textContent = prob.battingTeam;
  document.getElementById('win-prob-team-b').textContent = prob.bowlingTeam;
  document.getElementById('win-prob-a').textContent = `${prob.battingProb}%`;
  document.getElementById('win-prob-b').textContent = `${prob.bowlingProb}%`;
  const barA = document.getElementById('win-prob-fill-a');
  const barB = document.getElementById('win-prob-fill-b');
  barA.style.width = `${prob.battingProb}%`;
  renderRunRateWorm();
}

function updateCricketScorecard() {
  const el = document.getElementById('live-scorecard-content');
  let html = '';

  [1, 2].forEach(innNum => {
    const inn = S.cricket.innings[innNum - 1];

    // Batting team for this innings
    const battingTeam = innNum === 1
      ? (S.cricket.tossChoice === 'bat' ? S.cricket.teamAName : S.cricket.teamBName)
      : (S.cricket.tossChoice === 'bat' ? S.cricket.teamBName : S.cricket.teamAName);
    const battingPlayers = innNum === 1
      ? (S.cricket.tossChoice === 'bat' ? S.cricket.teamA : S.cricket.teamB)
      : (S.cricket.tossChoice === 'bat' ? S.cricket.teamB : S.cricket.teamA);

    // Bowling team for this innings
    const bowlingTeam = innNum === 1
      ? (S.cricket.tossChoice === 'bat' ? S.cricket.teamBName : S.cricket.teamAName)
      : (S.cricket.tossChoice === 'bat' ? S.cricket.teamAName : S.cricket.teamBName);
    const bowlingPlayers = innNum === 1
      ? (S.cricket.tossChoice === 'bat' ? S.cricket.teamB : S.cricket.teamA)
      : (S.cricket.tossChoice === 'bat' ? S.cricket.teamA : S.cricket.teamB);

    if (!battingPlayers || !battingPlayers.length) return;

    const innLabel = innNum === 1 ? '1st' : '2nd';
    const innColor = innNum === 1 ? 'var(--blue)' : 'var(--green)';

    html += `<div class="sc-innings-head" style="border-color:${innColor};color:${innColor};">
      <span>${innLabel} Innings</span>
      <span>${inn.runs}/${inn.wickets} (${Math.floor(inn.balls/6)}.${inn.balls%6} ov)</span>
    </div>`;

    // ── BATTING ──
    html += `<div class="sc-section-label"><i class="ti ti-cricket" style="font-size:11px;"></i> ${esc(battingTeam)} — Batting</div>`;
    html += `<div class="sc-row sc-row-head">
      <div class="sc-name">Batter</div>
      <div class="sc-val">R</div>
      <div class="sc-val">B</div>
      <div class="sc-val">4s</div>
      <div class="sc-val">6s</div>
      <div class="sc-val">SR</div>
    </div>`;

    battingPlayers.forEach(p => {
      const ps = inn.playerStats[p] || { runs:0, balls:0, fours:0, sixes:0, out:false };
      const sr = ps.balls > 0 ? ((ps.runs / ps.balls) * 100).toFixed(0) : '-';
      const isActive = !ps.out && ps.balls > 0;
      const srNum = parseFloat(sr);
      const srClass = srNum >= 200 ? 'hi' : srNum >= 150 ? 'green' : srNum >= 100 ? 'blue' : '';
      html += `<div class="sc-row ${isActive ? 'sc-active' : ''}">
        <div class="sc-name">
          ${esc(p)}
          ${ps.out ? '<span class="sc-out">out</span>' : (isActive ? '<span class="sc-batting">bat</span>' : '')}
        </div>
        <div class="sc-val ${ps.runs >= 50 ? 'sc-highlight' : ''}">${ps.runs}</div>
        <div class="sc-val">${ps.balls || 0}</div>
        <div class="sc-val sc-blue">${ps.fours || 0}</div>
        <div class="sc-val sc-orange">${ps.sixes || 0}</div>
        <div class="sc-val ${srClass}">${sr}</div>
      </div>`;
    });

    // ── BOWLING ──
    html += `<div class="sc-section-label" style="margin-top:10px;"><i class="ti ti-target-arrow" style="font-size:11px;"></i> ${esc(bowlingTeam)} — Bowling</div>`;
    html += `<div class="sc-row sc-row-head">
      <div class="sc-name">Bowler</div>
      <div class="sc-val">O</div>
      <div class="sc-val">R</div>
      <div class="sc-val">W</div>
      <div class="sc-val">Eco</div>
    </div>`;

    // Collect bowlers who actually bowled
    const bowlers = bowlingPlayers.filter(p => {
      const ps = inn.playerStats[p];
      return ps && (ps.wickets || ps.runsConceded || ps.ballsBowled);
    });

    if (bowlers.length === 0) {
      // Fall back to anyone in playerStats with bowling data
      const allBowlers = Object.entries(inn.playerStats || {})
        .filter(([n, ps]) => ps.wickets || ps.runsConceded || ps.ballsBowled)
        .map(([n]) => n);
      allBowlers.forEach(p => {
        const ps = inn.playerStats[p];
        const ballsBowled = ps.ballsBowled || 0;
        const overs = Math.floor(ballsBowled / 6) + (ballsBowled % 6 ? '.' + (ballsBowled % 6) : '.0');
        const rc = ps.runsConceded || 0;
        const eco = ballsBowled > 0 ? ((rc / ballsBowled) * 6).toFixed(1) : '-';
        const wkts = ps.wickets || 0;
        html += `<div class="sc-row">
          <div class="sc-name">${esc(p)}</div>
          <div class="sc-val">${overs}</div>
          <div class="sc-val">${rc}</div>
          <div class="sc-val sc-highlight">${wkts}</div>
          <div class="sc-val">${eco}</div>
        </div>`;
      });
    } else {
      bowlers.forEach(p => {
        const ps = inn.playerStats[p] || {};
        const ballsBowled = ps.ballsBowled || 0;
        const overs = Math.floor(ballsBowled / 6) + '.' + (ballsBowled % 6);
        const rc = ps.runsConceded || 0;
        const eco = ballsBowled > 0 ? ((rc / ballsBowled) * 6).toFixed(1) : '-';
        const wkts = ps.wickets || 0;
        html += `<div class="sc-row">
          <div class="sc-name">${esc(p)}</div>
          <div class="sc-val">${overs}</div>
          <div class="sc-val">${rc}</div>
          <div class="sc-val sc-highlight">${wkts}</div>
          <div class="sc-val">${eco}</div>
        </div>`;
      });
    }

    if (innNum === 1 && S.cricket.innings[1].balls === 0 && S.cricket.currentInnings === 1) {
      // Don't show 2nd innings block if not started
    }
  });

  el.innerHTML = html || '<div style="font-size:12px;color:var(--text3);">Match not started.</div>';
}

function collectCricketMatchStats() {
  const stats = {};
  (S.cricket.innings || []).forEach(inn => {
    Object.entries(inn.playerStats || {}).forEach(([name, s]) => {
      if (!stats[name]) stats[name] = { runs:0, balls:0, fours:0, sixes:0, outs:0, wickets:0, runsConceded:0, potm:0, pots:0, innings:0 };
      // Count as an innings if the player faced at least 1 ball OR scored runs
      if ((s.balls||0) > 0 || (s.runs||0) > 0) stats[name].innings += 1;
      stats[name].runs += s.runs || 0;
      stats[name].balls += s.balls || 0;
      stats[name].fours += s.fours || 0;
      stats[name].sixes += s.sixes || 0;
      stats[name].outs += s.out ? 1 : 0;
      stats[name].wickets += s.wickets || 0;
      stats[name].runsConceded += s.runsConceded || 0;
    });
  });
  let potm = '';
  let best = -1;
  Object.entries(stats).forEach(([name, s]) => {
    const score = (s.runs || 0) + (s.wickets || 0) * 18 + (s.sixes || 0) * 2;
    if (score > best) { best = score; potm = name; }
  });
  if (potm && stats[potm]) stats[potm].potm = 1;

  // Player of the Series: award at end of a series (when series is complete)
  const series = S.cricket.seriesInfo || {};
  if (S.cricket.format === 'series' && series.type === 'series') {
    const totalWins = (series.wins?.A || 0) + (series.wins?.B || 0);
    const majority = Math.ceil((series.total || 3) / 2);
    const seriesOver = series.wins?.A >= majority || series.wins?.B >= majority;
    if (seriesOver) {
      // Sum stats across all series matches to find series MVP
      const seriesEntries = S.history.filter(m => m.sport === 'cricket' && m.seriesType === 'series').slice(0, series.total || 3);
      const seriesTotals = {};
      seriesEntries.forEach(m => {
        Object.entries(m.cricketStats || {}).forEach(([n, sv]) => {
          if (!seriesTotals[n]) seriesTotals[n] = 0;
          seriesTotals[n] += (sv.runs || 0) + (sv.wickets || 0) * 18 + (sv.sixes || 0) * 2;
        });
      });
      let potsName = '';
      let potsScore = -1;
      Object.entries(seriesTotals).forEach(([n, sc]) => {
        if (sc > potsScore) { potsScore = sc; potsName = n; }
      });
      if (potsName && stats[potsName]) stats[potsName].pots = 1;
    }
  }
  return stats;
}

function checkCricketResult() {
  if (S.cricket.matchOver) return; // Guard: prevent double-firing
  const inn1 = S.cricket.innings[0];
  const inn2 = S.cricket.innings[1];
  S.cricket.matchOver = true;

  let winner, margin;
  const batFirst = S.cricket.tossChoice === 'bat' ? S.cricket.teamAName : S.cricket.teamBName;
  const chaseTeam = batFirst === S.cricket.teamAName ? S.cricket.teamBName : S.cricket.teamAName;

  if (inn2.runs > inn1.runs) {
    const wkts = (S.cricket.teamA.length) - inn2.wickets;
    winner = chaseTeam;
    margin = `Won by ${wkts} wicket${wkts !== 1 ? 's' : ''}`;
  } else if (inn2.runs === inn1.runs) {
    winner = 'Match Tied!';
    margin = '';
  } else {
    const diff = inn1.runs - inn2.runs;
    winner = batFirst;
    margin = `Won by ${diff} run${diff !== 1 ? 's' : ''}`;
  }

  document.getElementById('result-winner').textContent = winner;
  document.getElementById('result-margin').textContent = margin;
  document.getElementById('cricket-result').classList.remove('hidden');

  const series = S.cricket.seriesInfo || { type:'single', current:1, total:1, wins:{ A:0, B:0 } };
  if (S.cricket.format === 'series' && series.type === 'series' && !S.cricket._seriesResultApplied) {
    const majority = Math.ceil((series.total || 3) / 2);
    const alreadyWon = (series.wins.A || 0) >= majority || (series.wins.B || 0) >= majority;
    if (!alreadyWon) {
      if (winner === S.cricket.teamAName) series.wins.A = (series.wins.A || 0) + 1;
      if (winner === S.cricket.teamBName) series.wins.B = (series.wins.B || 0) + 1;
      // Only advance match counter if series isn't yet decided
      const newMajority = Math.ceil((series.total || 3) / 2);
      const seriesNowOver = (series.wins.A || 0) >= newMajority || (series.wins.B || 0) >= newMajority;
      if (!seriesNowOver) {
        series.current = Math.min((series.current || 1) + 1, series.total || S.cricket.seriesSize || 3);
      }
    }
    S.cricket.seriesInfo = series;
    S.cricket._seriesResultApplied = true;
    renderCricketSeriesBoard();
  }

  // Save to history
  saveToHistory({
    sport: 'cricket',
    title: `${S.cricket.teamAName} vs ${S.cricket.teamBName}`,
    result: `${winner} — ${margin}`,
    date: new Date().toLocaleDateString(),
    detail: `${inn1.runs}/${inn1.wickets} vs ${inn2.runs}/${inn2.wickets}`,
    teamA: S.cricket.teamAName,
    teamB: S.cricket.teamBName,
    overs: S.cricket.overs,
    seriesType: S.cricket.format,
    seriesMatch: series.type === 'series' ? Math.max(1, (series.current || 1) - 1) : 0,
    cricketStats: collectCricketMatchStats(),
  });

  save();
  renderProfiles();
  // Show match summary popup after brief delay
  setTimeout(showMatchSummary, 600);
}

function newCricketMatch() {
  S.cricket.matchStarted = false;
  S.cricket.matchOver = false;
  S.cricket.currentInnings = 1;
  S.cricket.striker = '';
  S.cricket.bowler = '';
  S.cricket._seriesResultApplied = false;
  S.cricket.innings = [
    { runs:0, wickets:0, balls:0, ballLog:[], playerStats:{}, currentOver:[] },
    { runs:0, wickets:0, balls:0, ballLog:[], playerStats:{}, currentOver:[] }
  ];

  // If series mode, check if the series is finished — if so, reset for a brand new series
  if (S.cricket.format === 'series') {
    const series = S.cricket.seriesInfo || { type:'series', current:1, total:S.cricket.seriesSize || 3, wins:{ A:0, B:0 } };
    const majority = Math.ceil((series.total || 3) / 2);
    const seriesOver = (series.wins.A || 0) >= majority || (series.wins.B || 0) >= majority;
    if (seriesOver) {
      // Full reset — new series from scratch
      S.cricket.seriesInfo = { type:'series', current:1, total:series.total || S.cricket.seriesSize || 3, wins:{ A:0, B:0 } };
      toast('New series started!');
    } else {
      toast('New match ready!');
    }
  } else {
    toast('New match ready!');
  }

  document.getElementById('cricket-result').classList.add('hidden');
  document.getElementById('cricket-live-ui').classList.add('hidden');
  document.getElementById('cricket-no-match').classList.remove('hidden');
  renderCricketSeriesBoard();
  updateActiveHouseRulesDisplay();
  showTab('match');
  save();
}

function shareMatchCard() {
  const inn1 = S.cricket.innings[0];
  const inn2 = S.cricket.innings[1];
  const msg = `Match Result\n${S.cricket.teamAName}: ${inn1.runs}/${inn1.wickets}\n${S.cricket.teamBName}: ${inn2.runs}/${inn2.wickets}\n\nScored with Arena · Multi-Sport Hub`;
  navigator.clipboard.writeText(msg).then(() => toast('Result copied!')).catch(() => toast('Copy result manually.'));
}

// ═══════════════════════════════════════════════════════
// ══════ FOOTBALL ══════
// ═══════════════════════════════════════════════════════