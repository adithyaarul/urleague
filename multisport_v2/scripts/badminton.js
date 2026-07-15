function setBadmintonServer(who) {
  S.badminton.server = who;
  const info = document.getElementById('bd-server-info');
  if (info) info.textContent = (who === 'a' ? S.badminton.playerA : S.badminton.playerB) + ' serves first.';
  save();
}

function startBadmintonMatch() {
  S.badminton.playerA = document.getElementById('bd-player-a').value.trim() || 'Player A';
  S.badminton.playerB = document.getElementById('bd-player-b').value.trim() || 'Player B';
  S.badminton.format = parseInt(document.getElementById('bd-format').value) || 3;
  S.badminton.pointsToWin = parseInt(document.getElementById('bd-points').value) || 21;
  S.badminton.currentSet = 1;
  S.badminton.setsWonA = 0;
  S.badminton.setsWonB = 0;
  S.badminton.sets = Array(S.badminton.format).fill(null).map(() => ({ scoreA:0, scoreB:0, finished:false, winner:null }));
  S.badminton.matchStarted = true;
  S.badminton.matchOver = false;
  save();
  showTab('live');
  document.getElementById('badminton-no-match').classList.add('hidden');
  document.getElementById('badminton-live-ui').classList.remove('hidden');
  renderBadmintonLive();
  addCommentary('badminton', 'set', { set: 1 });
  toast('Let the shuttle fly!');
}

function renderBadmintonLive() {
  const bd = S.badminton;
  const setIdx = bd.currentSet - 1;
  const curSet = bd.sets[setIdx] || { scoreA:0, scoreB:0 };

  document.getElementById('bd-a-name-disp').textContent = bd.playerA;
  document.getElementById('bd-b-name-disp').textContent = bd.playerB;
  document.getElementById('bd-score-a').textContent = curSet.scoreA;
  document.getElementById('bd-score-b').textContent = curSet.scoreB;
  document.getElementById('bd-sets-won-display').textContent = `Sets won: ${bd.playerA} ${bd.setsWonA} – ${bd.playerB} ${bd.setsWonB}`;

  // Serving highlight
  document.getElementById('bd-player-a-card').classList.toggle('serving', bd.server === 'a');
  document.getElementById('bd-player-b-card').classList.toggle('serving', bd.server === 'b');
  document.getElementById('bd-server-display').textContent =
    `Serving: ${bd.server === 'a' ? bd.playerA : bd.playerB}`;

  // Set chips
  for (let i = 1; i <= 3; i++) {
    const chip = document.getElementById(`bd-set-chip-${i}`);
    if (i > bd.format) { chip.style.display = 'none'; continue; }
    chip.style.display = '';
    chip.className = 'bd-set-chip';
    const s = bd.sets[i-1];
    if (s && s.finished) {
      chip.classList.add(s.winner === 'a' ? 'won-a' : 'won-b');
      chip.textContent = `S${i} ${s.scoreA}–${s.scoreB}`;
    } else if (i === bd.currentSet) {
      chip.classList.add('active');
      chip.textContent = `S${i} ●`;
    } else {
      chip.textContent = `S${i}`;
    }
  }

  // Previous set scores
  const rowEl = document.getElementById('bd-set-results-row');
  rowEl.innerHTML = bd.sets.filter(s => s.finished).map((s, i) =>
    `<div class="bd-set-result-pill">S${i+1}: ${s.scoreA}–${s.scoreB} (${s.winner === 'a' ? bd.playerA : bd.playerB})</div>`
  ).join('');
}

function badmintonPoint(player) {
  if (!canEdit()) { toast('Viewer mode.'); return; }
  const bd = S.badminton;
  const setIdx = bd.currentSet - 1;
  const curSet = bd.sets[setIdx];
  if (!curSet || curSet.finished) return;

  if (player === 'a') curSet.scoreA++;
  else curSet.scoreB++;

  // Server gets the point → they keep serve
  bd.server = player;

  // Check set win (must win by 2, cap at pointsToWin+1 for deuce)
  const ptw = bd.pointsToWin;
  const winA = curSet.scoreA >= ptw && curSet.scoreA - curSet.scoreB >= 2;
  const winB = curSet.scoreB >= ptw && curSet.scoreB - curSet.scoreA >= 2;

  addCommentary('badminton', 'point', { player: player === 'a' ? bd.playerA : bd.playerB });

  if (winA || winB) {
    curSet.finished = true;
    curSet.winner = winA ? 'a' : 'b';
    if (winA) bd.setsWonA++;
    else bd.setsWonB++;

    const setsNeeded = Math.ceil(bd.format / 2);
    if (bd.setsWonA >= setsNeeded || bd.setsWonB >= setsNeeded) {
      endBadmintonMatchResult();
    } else {
      bd.currentSet++;
      // Auto-advance set
      toast(`Set ${bd.currentSet - 1} won by ${winA ? bd.playerA : bd.playerB}!`);
    }
  }

  save();
  renderBadmintonLive();
}

function undoBadmintonPoint() {
  const bd = S.badminton;
  const setIdx = bd.currentSet - 1;
  const curSet = bd.sets[setIdx];
  if (!curSet || (curSet.scoreA === 0 && curSet.scoreB === 0)) { toast('Nothing to undo.'); return; }
  // simple undo — can't determine who scored last without full log; just decrement totals fairly
  if (bd.server === 'a' && curSet.scoreA > 0) curSet.scoreA--;
  else if (curSet.scoreB > 0) curSet.scoreB--;
  save();
  renderBadmintonLive();
  toast('Undone.');
}

function setServer(who) {
  S.badminton.server = who;
  renderBadmintonLive();
  save();
}

function newBadmintonSet() {
  const bd = S.badminton;
  if (bd.currentSet < bd.format) {
    bd.sets[bd.currentSet - 1].finished = true;
    bd.currentSet++;
    save();
    renderBadmintonLive();
    toast(`Set ${bd.currentSet} starting!`);
  } else {
    toast('This is the final set.');
  }
}

function endBadmintonMatchResult() {
  const bd = S.badminton;
  bd.matchOver = true;
  const winner = bd.setsWonA > bd.setsWonB ? bd.playerA : bd.playerB;
  const loserSets = Math.min(bd.setsWonA, bd.setsWonB);
  const winnerSets = Math.max(bd.setsWonA, bd.setsWonB);
  document.getElementById('bd-result-winner').textContent = winner + ' wins!';
  document.getElementById('bd-result-margin').textContent = `${winnerSets} – ${loserSets} sets`;
  document.getElementById('bd-match-result').classList.remove('hidden');

  // ── Persist to global player identity — badminton profile, fully isolated ──
  const playerAWins = bd.setsWonA > bd.setsWonB;
  [[bd.playerA, playerAWins, bd.setsWonA, bd.setsWonB],
   [bd.playerB, !playerAWins, bd.setsWonB, bd.setsWonA]].forEach(([name, won, setsW, setsL]) => {
    if (!name || name.startsWith('Player ')) return; // skip default names
    const gp = _getOrCreatePlayer(name);
    gp.badminton.matches += 1;
    gp.badminton.wins += won ? 1 : 0;
    gp.badminton.losses += won ? 0 : 1;
    gp.badminton.setsWon += setsW;
    gp.badminton.setsLost += setsL;
  });

  const badmintonPlayerStats = [
    { name: bd.playerA, wins: playerAWins ? 1 : 0, losses: playerAWins ? 0 : 1, setsWon: bd.setsWonA, setsLost: bd.setsWonB },
    { name: bd.playerB, wins: playerAWins ? 0 : 1, losses: playerAWins ? 1 : 0, setsWon: bd.setsWonB, setsLost: bd.setsWonA },
  ];

  saveToHistory({
    sport: 'badminton',
    title: `${bd.playerA} vs ${bd.playerB}`,
    result: `${winner} wins ${winnerSets}–${loserSets}`,
    date: new Date().toLocaleDateString(),
    detail: `Sets: ${bd.setsWonA}–${bd.setsWonB}`,
    badmintonPlayerStats,
  });
  renderHistory();
  toast(winner + ' wins the match!');
}

function endBadmintonMatch() {
  endBadmintonMatchResult();
}

function newBadmintonMatch() {
  S.badminton.matchStarted = false;
  S.badminton.matchOver = false;
  document.getElementById('bd-match-result').classList.add('hidden');
  document.getElementById('badminton-live-ui').classList.add('hidden');
  document.getElementById('badminton-no-match').classList.remove('hidden');
  showTab('match');
  save();
  toast('New match ready!');
}

// ═══════════════════════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════════════════════