function startPickleballMatch() {
  const pA = document.getElementById('pb-player-a')?.value.trim() || 'Player A';
  const pB = document.getElementById('pb-player-b')?.value.trim() || 'Player B';
  const fmt = document.getElementById('pb-format')?.value || 'singles';
  const pts = parseInt(document.getElementById('pb-points')?.value || '11');
  const gamesCount = parseInt(document.getElementById('pb-games')?.value || '1');

  S.pickleball.playerA = pA;
  S.pickleball.playerB = pB;
  S.pickleball.format = fmt;
  S.pickleball.pointsToWin = pts;
  S.pickleball.gamesToWin = gamesCount;
  S.pickleball.matchStarted = true;
  S.pickleball.matchOver = false;
  S.pickleball.currentGame = 1;
  S.pickleball.gamesWonA = 0;
  S.pickleball.gamesWonB = 0;
  S.pickleball.server = 'a';
  S.pickleball.eventLog = [];
  S.pickleball.scoreHistory = [];
  // Initialise games array
  S.pickleball.games = [];
  for (let i = 0; i < Math.max(gamesCount * 2 - 1, 1); i++) {
    S.pickleball.games.push({ scoreA: 0, scoreB: 0, finished: false, winner: null });
  }
  save();
  document.getElementById('pickleball-no-match').classList.add('hidden');
  document.getElementById('pickleball-live-ui').classList.remove('hidden');
  showTab('live');
  renderPickleballLive();
  toast('Pickleball match started! 🏓');
}

function renderPickleballLive() {
  const pb = S.pickleball;
  if (!pb.matchStarted) return;
  const game = pb.games[pb.currentGame - 1] || { scoreA: 0, scoreB: 0 };

  // Name displays
  const aDisp = document.getElementById('pb-a-name-disp');
  const bDisp = document.getElementById('pb-b-name-disp');
  if (aDisp) aDisp.textContent = pb.playerA;
  if (bDisp) bDisp.textContent = pb.playerB;

  // Scores
  const scoreA = document.getElementById('pb-score-a');
  const scoreB = document.getElementById('pb-score-b');
  if (scoreA) scoreA.textContent = game.scoreA;
  if (scoreB) scoreB.textContent = game.scoreB;

  // Server highlight
  const cardA = document.getElementById('pb-player-a-card');
  const cardB = document.getElementById('pb-player-b-card');
  if (cardA) cardA.classList.toggle('serving', pb.server === 'a');
  if (cardB) cardB.classList.toggle('serving', pb.server === 'b');

  // Server row
  const sRow = document.getElementById('pb-server-row');
  if (sRow) {
    const serverName = pb.server === 'a' ? pb.playerA : pb.playerB;
    sRow.innerHTML = `<span class="pb-server-dot"></span><b>${esc(serverName)}</b> is serving`;
  }

  // Games bar
  _renderPbGamesBar();

  // Server display card
  const sDis = document.getElementById('pb-server-display');
  if (sDis) {
    const serverName = pb.server === 'a' ? pb.playerA : pb.playerB;
    sDis.innerHTML = `<span class="pb-server-dot"></span><b style="color:var(--text)">${esc(serverName)}</b> is serving — Game ${pb.currentGame}`;
  }

  // Serve buttons active state
  const sBtnA = document.getElementById('pb-serve-a-btn');
  const sBtnB = document.getElementById('pb-serve-b-btn');
  if (sBtnA) sBtnA.classList.toggle('primary-flat', pb.server === 'a');
  if (sBtnB) sBtnB.classList.toggle('primary-flat', pb.server === 'b');

  // Previous game scores
  _renderPbGameScores();

  // Event log
  _renderPbEventLog();
}

function _renderPbGamesBar() {
  const pb = S.pickleball;
  const bar = document.getElementById('pb-games-bar');
  if (!bar) return;
  const total = pb.games.length;
  bar.innerHTML = pb.games.map((g, i) => {
    const num = i + 1;
    const isCurrent = num === pb.currentGame;
    const won = g.finished ? (g.winner === 'a' ? `${pb.playerA.split(' ')[0]} ${g.scoreA}-${g.scoreB}` : `${pb.playerB.split(' ')[0]} ${g.scoreB}-${g.scoreA}`) : null;
    const cls = g.finished ? 'pb-game-chip won' : isCurrent ? 'pb-game-chip active' : 'pb-game-chip';
    return `<span class="${cls}">G${num}${g.finished ? ` ✓` : isCurrent ? ' 🏓' : ''}</span>`;
  }).join('');
}

function _renderPbGameScores() {
  const pb = S.pickleball;
  const row = document.getElementById('pb-game-scores-row');
  if (!row) return;
  const done = pb.games.filter(g => g.finished);
  if (!done.length) { row.innerHTML = ''; return; }
  row.innerHTML = done.map((g, i) => {
    const winner = g.winner === 'a' ? pb.playerA : pb.playerB;
    return `<span class="bd-set-result-pill" style="border-color:var(--pickleball-border,rgba(52,211,153,.32));color:var(--pickleball-primary,#34d399);">G${i+1}: ${g.scoreA}–${g.scoreB}</span>`;
  }).join('');
}

function _renderPbEventLog() {
  const pb = S.pickleball;
  const el = document.getElementById('pb-event-log');
  if (!el) return;
  if (!pb.eventLog || !pb.eventLog.length) { el.innerHTML = '<div style="color:var(--text3);">No events yet.</div>'; return; }
  el.innerHTML = [...pb.eventLog].reverse().slice(0, 15).map(e =>
    `<div style="padding:3px 0;border-bottom:1px solid var(--border);">${esc(e)}</div>`
  ).join('');
}

function pickleballPoint(side) {
  const pb = S.pickleball;
  if (!pb.matchStarted || pb.matchOver) return;
  const game = pb.games[pb.currentGame - 1];
  if (!game || game.finished) return;

  // Score the point
  if (side === 'a') game.scoreA++;
  else game.scoreB++;

  // Store history for undo
  pb.scoreHistory.push(JSON.parse(JSON.stringify({ game: pb.currentGame - 1, scoreA: game.scoreA, scoreB: game.scoreB, server: pb.server, gamesWonA: pb.gamesWonA, gamesWonB: pb.gamesWonB })));

  // In rally scoring, server changes ONLY when server loses the point
  // (Classic side-out scoring: point only scored when you serve)
  // Arena uses rally scoring (modern): every rally scores, server changes on side-out
  // We track server manually, so just update serve indicator

  // Log event
  const playerName = side === 'a' ? pb.playerA : pb.playerB;
  pb.eventLog.push(`Point to ${playerName} — ${game.scoreA}–${game.scoreB}`);

  // Check game win condition
  const pts = pb.pointsToWin;
  const scoreA = game.scoreA, scoreB = game.scoreB;
  const leadA = scoreA >= pts && scoreA - scoreB >= 2;
  const leadB = scoreB >= pts && scoreB - scoreA >= 2;

  if (leadA || leadB) {
    game.finished = true;
    game.winner = leadA ? 'a' : 'b';
    if (leadA) pb.gamesWonA++;
    else pb.gamesWonB++;

    const winner = leadA ? pb.playerA : pb.playerB;
    pb.eventLog.push(`🏆 ${winner} wins Game ${pb.currentGame}! (${scoreA}–${scoreB})`);

    // Check match win
    if (pb.gamesWonA >= pb.gamesToWin || pb.gamesWonB >= pb.gamesToWin) {
      pb.matchOver = true;
      pb.result = leadA ? 'a' : 'b';
      _endPickleballMatch();
      save();
      renderPickleballLive();
      return;
    }

    toast(`Game ${pb.currentGame} — ${winner} wins!`);
    // Auto advance after short delay
    setTimeout(() => {
      pb.currentGame++;
      // Alternate server at start of each new game
      pb.server = pb.server === 'a' ? 'b' : 'a';
      save();
      renderPickleballLive();
    }, 1200);
  }

  save();
  renderPickleballLive();
}

function undoPickleballPoint() {
  const pb = S.pickleball;
  if (!pb.matchStarted || !pb.scoreHistory || !pb.scoreHistory.length) { toast('Nothing to undo.'); return; }
  const prev = pb.scoreHistory.pop();
  const game = pb.games[prev.game];
  game.scoreA = prev.scoreA;
  game.scoreB = prev.scoreB;
  game.finished = false;
  game.winner = null;
  pb.server = prev.server;
  pb.gamesWonA = prev.gamesWonA;
  pb.gamesWonB = prev.gamesWonB;
  pb.currentGame = prev.game + 1;
  pb.matchOver = false;
  pb.eventLog.pop();
  document.getElementById('pb-match-result').classList.add('hidden');
  save();
  renderPickleballLive();
  toast('Undone.');
}

function setPbServer(side) {
  S.pickleball.server = side;
  save();
  renderPickleballLive();
}

function pbEvent(type) {
  const pb = S.pickleball;
  const pA = pb.playerA, pB = pb.playerB;
  const msgs = {
    kitchen_fault_a: `🚫 Kitchen fault — ${pA} (NVZ violation)`,
    kitchen_fault_b: `🚫 Kitchen fault — ${pB} (NVZ violation)`,
    serve_fault_a: `⚠️ Serve fault — ${pA}`,
    serve_fault_b: `⚠️ Serve fault — ${pB}`,
  };
  const msg = msgs[type] || type;
  if (!pb.eventLog) pb.eventLog = [];
  pb.eventLog.push(msg);
  // Faults give point to the other side
  if (type === 'kitchen_fault_a' || type === 'serve_fault_a') pickleballPoint('b');
  else if (type === 'kitchen_fault_b' || type === 'serve_fault_b') pickleballPoint('a');
  else { save(); renderPickleballLive(); }
  toast(msg);
}

function newPickleballGame() {
  const pb = S.pickleball;
  if (pb.currentGame < pb.games.length) {
    const cur = pb.games[pb.currentGame - 1];
    cur.finished = true;
    // Determine winner by current score
    cur.winner = cur.scoreA >= cur.scoreB ? 'a' : 'b';
    if (cur.winner === 'a') pb.gamesWonA++;
    else pb.gamesWonB++;
    pb.currentGame++;
    pb.server = pb.server === 'a' ? 'b' : 'a';
    save();
    renderPickleballLive();
    toast(`Game ${pb.currentGame - 1} ended. Starting Game ${pb.currentGame}.`);
  }
}

function _endPickleballMatch() {
  const pb = S.pickleball;
  const winner = pb.result === 'a' ? pb.playerA : pb.playerB;
  const loser = pb.result === 'a' ? pb.playerB : pb.playerA;
  const resEl = document.getElementById('pb-match-result');
  const winEl = document.getElementById('pb-result-winner');
  const marginEl = document.getElementById('pb-result-margin');
  if (winEl) winEl.textContent = `${winner} wins!`;
  if (marginEl) marginEl.textContent = `${pb.gamesWonA}–${pb.gamesWonB} games`;
  if (resEl) resEl.classList.remove('hidden');

  // Save to history
  const allGameScores = pb.games.filter(g => g.finished || g.scoreA > 0 || g.scoreB > 0).map(g => `${g.scoreA}–${g.scoreB}`).join(', ');
  S.history.unshift({
    id: Date.now(), sport: 'pickleball',
    title: `${pb.playerA} vs ${pb.playerB}`,
    result: `${winner} wins ${pb.gamesWonA}–${pb.gamesWonB}`,
    detail: `Games: ${allGameScores}`,
    date: new Date().toLocaleDateString(),
  });
  save();
  renderHistory();
  toast(`🏆 ${winner} wins the match!`);
}

function endPickleballMatch() {
  const pb = S.pickleball;
  pb.matchOver = true;
  pb.result = pb.gamesWonA >= pb.gamesWonB ? 'a' : 'b';
  _endPickleballMatch();
  save();
  renderPickleballLive();
}

function newPickleballMatch() {
  S.pickleball = JSON.parse(JSON.stringify(DEFAULT_STATE.pickleball));
  document.getElementById('pickleball-no-match').classList.remove('hidden');
  document.getElementById('pickleball-live-ui').classList.add('hidden');
  document.getElementById('pb-match-result').classList.add('hidden');
  save();
  showTab('match');
}


// ═══════════════════════════════════════════════════════
// CHESS ENGINE  (chess.com-style board + full tracker)
// ═══════════════════════════════════════════════════════

/* --- Piece constants & board state --- */
const CH_PIECES = {
  // value in centipawns for material tracking
  pawn:1, knight:3, bishop:3, rook:5, queen:9, king:0
};

const CH_PIECE_UNICODE = {
  white: { king:'♔', queen:'♕', rook:'♖', bishop:'♗', knight:'♘', pawn:'♙' },
  black: { king:'♚', queen:'♛', rook:'♜', bishop:'♝', knight:'♞', pawn:'♟' },
};

const CH_PIECE_DISPLAY = {
  white: { king:'K', queen:'Q', rook:'R', bishop:'B', knight:'N', pawn:'' },
  black: { king:'k', queen:'q', rook:'r', bishop:'b', knight:'n', pawn:'' },
};

// Initial board position [rank 8→1][file a→h]
// Format: {c:'white'|'black', t:'king'|'queen'|'rook'|'bishop'|'knight'|'pawn'} or null