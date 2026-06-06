function _chInitBoard() {
  const B = Array.from({length:8}, () => Array(8).fill(null));
  // Back rank pieces for both colors
  const backRank = ['rook','knight','bishop','queen','king','bishop','knight','rook'];
  backRank.forEach((t, f) => {
    B[0][f] = {c:'black', t}; // rank 8
    B[7][f] = {c:'white', t}; // rank 1
  });
  for (let f = 0; f < 8; f++) {
    B[1][f] = {c:'black', t:'pawn'}; // rank 7
    B[6][f] = {c:'white', t:'pawn'}; // rank 2
  }
  return B;
}

let _chBoard = null;       // current board state
let _chSelected = null;    // {r, f} selected square
let _chLegalMoves = [];    // legal moves for selected piece
let _chClockInterval = null;
let _chPromotionPending = null; // {from, to, color}

// Time controls in seconds
const CH_TIME_CONTROLS = {
  none:0,
  bullet_1:60, bullet_2:120,
  blitz_3:180, blitz_5:300, blitz_5_3:300,
  rapid_10:600, rapid_15_10:900, rapid_30:1800,
  classical_60:3600
};
const CH_INCREMENTS = {
  bullet_2:1, blitz_5_3:3, rapid_15_10:10
};

function applyChessTimeControl() {
  const sel = document.getElementById('ch-time');
  const inc = document.getElementById('ch-increment');
  if (!sel) return;
  const tc = sel.value;
  const autoInc = CH_INCREMENTS[tc] || 0;
  if (inc) inc.value = autoInc;
  S.chess.timeControl = tc;
  S.chess.increment = autoInc;
}

function startChessMatch() {
  const pW = document.getElementById('ch-player-white')?.value.trim() || 'White';
  const pB = document.getElementById('ch-player-black')?.value.trim() || 'Black';
  const tc = document.getElementById('ch-time')?.value || 'none';
  const inc = parseInt(document.getElementById('ch-increment')?.value || '0');
  const rated = document.getElementById('ch-rated')?.value === 'true';
  const firstTurn = document.getElementById('ch-first')?.value || 'white';

  const secs = CH_TIME_CONTROLS[tc] || 0;
  S.chess.playerWhite = pW;
  S.chess.playerBlack = pB;
  S.chess.timeControl = tc;
  S.chess.increment = inc;
  S.chess.rated = rated;
  S.chess.currentTurn = firstTurn;
  S.chess.matchStarted = true;
  S.chess.matchOver = false;
  S.chess.clockWhite = secs;
  S.chess.clockBlack = secs;
  S.chess.clockRunning = false;
  S.chess.clockTurn = firstTurn;
  S.chess.moves = [];
  S.chess.capturedByWhite = [];
  S.chess.capturedByBlack = [];
  S.chess.result = null;
  S.chess.resultReason = null;
  S.chess.moveCount = 1;

  // Init board
  _chBoard = _chInitBoard();
  _chSelected = null;
  _chLegalMoves = [];
  _chPromotionPending = null;

  save();
  document.getElementById('chess-no-match').classList.add('hidden');
  document.getElementById('chess-live-ui').classList.remove('hidden');
  showTab('live');
  renderChessLive();
  _drawChessBoard();
  // Auto-start clock for timed games
  if (secs > 0) {
    setTimeout(() => { S.chess.clockRunning = true; startChessClock(); }, 300);
  }
  toast('Chess game started! ♔');
}

function renderChessLive() {
  const ch = S.chess;
  if (!ch.matchStarted) return;

  // Player names
  const wName = document.getElementById('ch-white-name');
  const bName = document.getElementById('ch-black-name');
  if (wName) wName.textContent = ch.playerWhite;
  if (bName) bName.textContent = ch.playerBlack;

  // Active turn highlights
  const wBar = document.getElementById('ch-white-bar');
  const bBar = document.getElementById('ch-black-bar');
  if (wBar) wBar.classList.toggle('active-turn', ch.currentTurn === 'white' && !ch.matchOver);
  if (bBar) bBar.classList.toggle('active-turn', ch.currentTurn === 'black' && !ch.matchOver);

  // Clock displays
  _updateChessClockDisplay();

  // Turn display
  const turnEl = document.getElementById('ch-turn-display');
  if (turnEl) {
    if (ch.matchOver) {
      const r = ch.result;
      turnEl.textContent = r === 'draw' ? 'Draw — ½–½' : `${r === 'white' ? ch.playerWhite : ch.playerBlack} wins!`;
      turnEl.style.color = r === 'white' ? '#f0f0f0' : r === 'black' ? 'var(--chess-primary)' : 'var(--amber)';
    } else {
      const moverName = ch.currentTurn === 'white' ? ch.playerWhite : ch.playerBlack;
      const colorDot = ch.currentTurn === 'white' ? '♔' : '♚';
      turnEl.textContent = `${colorDot} ${moverName} to move`;
      turnEl.style.color = '';
    }
  }

  // Move count
  const mcEl = document.getElementById('ch-move-count');
  if (mcEl) mcEl.textContent = `Move ${ch.moveCount}`;

  // Move log
  _renderChessMoveLog();

  // Material
  _renderChessMaterial();

  // Board
  _drawChessBoard();
}

function _updateChessClockDisplay() {
  const ch = S.chess;
  const wClk = document.getElementById('ch-clock-white');
  const bClk = document.getElementById('ch-clock-black');
  if (wClk) {
    wClk.textContent = _fmtChessClock(ch.clockWhite);
    wClk.className = 'ch-clock' + (ch.currentTurn === 'white' && ch.clockRunning ? ' active' : '') + (ch.clockWhite < 30 && ch.clockWhite > 0 ? ' low-time' : '');
  }
  if (bClk) {
    bClk.textContent = _fmtChessClock(ch.clockBlack);
    bClk.className = 'ch-clock' + (ch.currentTurn === 'black' && ch.clockRunning ? ' active' : '') + (ch.clockBlack < 30 && ch.clockBlack > 0 ? ' low-time' : '');
  }
  // Hide clocks if no time control
  if (ch.timeControl === 'none') {
    if (wClk) wClk.textContent = '—';
    if (bClk) bClk.textContent = '—';
  }
}

function _fmtChessClock(secs) {
  if (secs <= 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function startChessClock() {
  if (_chClockInterval) clearInterval(_chClockInterval);
  if (!S.chess.matchStarted || S.chess.matchOver || S.chess.timeControl === 'none') return;
  _chClockInterval = setInterval(() => {
    if (!S.chess.clockRunning || S.chess.matchOver) return;
    if (S.chess.currentTurn === 'white') {
      S.chess.clockWhite = Math.max(0, S.chess.clockWhite - 1);
      if (S.chess.clockWhite === 0) { chResult('black', 'timeout'); return; }
    } else {
      S.chess.clockBlack = Math.max(0, S.chess.clockBlack - 1);
      if (S.chess.clockBlack === 0) { chResult('white', 'timeout'); return; }
    }
    _updateChessClockDisplay();
  }, 1000);
}

function stopChessClock() {
  if (_chClockInterval) { clearInterval(_chClockInterval); _chClockInterval = null; }
}

function chPressClock() {
  const ch = S.chess;
  if (!ch.matchStarted || ch.matchOver) return;
  // Add increment to player who just moved
  if (ch.timeControl !== 'none' && ch.increment > 0) {
    if (ch.currentTurn === 'white') ch.clockBlack += ch.increment; // black just pressed (white's turn means black moved last)
    else ch.clockWhite += ch.increment;
  }
  // Switch turn
  ch.currentTurn = ch.currentTurn === 'white' ? 'black' : 'white';
  ch.clockRunning = true;
  if (!_chClockInterval) startChessClock();
  save();
  renderChessLive();
}

function chPause() {
  const ch = S.chess;
  ch.clockRunning = !ch.clockRunning;
  const btn = document.getElementById('ch-pause-btn');
  if (btn) btn.innerHTML = ch.clockRunning
    ? '<i class="ti ti-player-pause"></i> Pause'
    : '<i class="ti ti-player-play"></i> Resume';
  save();
}

function chAddMove() {
  const input = document.getElementById('ch-move-input');
  if (!input) return;
  const notation = input.value.trim();
  if (!notation) return;

  const ch = S.chess;
  const color = ch.currentTurn;

  // Classify move type for styling
  const isCheck = notation.includes('+');
  const isCheckmate = notation.includes('#');
  const isCastle = notation === 'O-O' || notation === 'O-O-O';
  const isCapture = notation.includes('x');
  const isPromotion = notation.includes('=');
  const isSpecial = isCastle || isCheckmate || isPromotion;

  ch.moves.push({ notation, color, isSpecial, isCheck, isCapture, isCastle });
  input.value = '';

  // Update move count (increments after black moves)
  if (color === 'black') ch.moveCount++;

  // Switch turn via press-clock logic (adds increment too)
  if (ch.timeControl !== 'none' && ch.increment > 0) {
    if (color === 'white') ch.clockWhite += ch.increment;
    else ch.clockBlack += ch.increment;
  }
  ch.currentTurn = color === 'white' ? 'black' : 'white';
  ch.clockRunning = true;
  if (!_chClockInterval && ch.timeControl !== 'none') startChessClock();

  // Handle check/checkmate
  if (isCheckmate) {
    chResult(color, 'checkmate');
    return;
  }

  save();
  renderChessLive();
  // Update board overlay with last move hint
  _drawChessBoard();

  // Focus input back for quick logging
  input.focus();
}

function _renderChessMoveLog() {
  const ch = S.chess;
  const el = document.getElementById('ch-move-log');
  if (!el) return;
  if (!ch.moves.length) { el.innerHTML = '<div style="color:var(--text3);font-size:12px;grid-column:1/-1;">No moves yet. Log moves in the field above.</div>'; return; }

  let html = '';
  let moveNum = 1;
  for (let i = 0; i < ch.moves.length; i += 2) {
    const white = ch.moves[i];
    const black = ch.moves[i + 1];
    const isLastWhite = i === ch.moves.length - 1 && !black;
    const isLastBlack = black && i + 1 === ch.moves.length - 1;
    const wCls = 'ch-move-cell' + (white.isSpecial ? ' special' : '') + (isLastWhite ? ' latest' : '');
    const bCls = black ? ('ch-move-cell' + (black.isSpecial ? ' special' : '') + (isLastBlack ? ' latest' : '')) : '';
    html += `<span class="ch-move-num">${moveNum}.</span>`;
    html += `<span class="${wCls}">${esc(white.notation)}</span>`;
    html += black ? `<span class="${bCls}">${esc(black.notation)}</span>` : `<span></span>`;
    moveNum++;
  }
  el.innerHTML = html;
  // Auto-scroll to bottom
  el.scrollTop = el.scrollHeight;
}

function _renderChessMaterial() {
  const ch = S.chess;
  // White captures (pieces white has taken from black)
  const wCapEl = document.getElementById('ch-white-cap-list');
  const bCapEl = document.getElementById('ch-black-cap-list');
  const wBarCap = document.getElementById('ch-white-captures');
  const bBarCap = document.getElementById('ch-black-captures');

  const pieceUnicode = { pawn:'♟', knight:'♞', bishop:'♝', rook:'♜', queen:'♛' };
  const pieceValue = { pawn:1, knight:3, bishop:3, rook:5, queen:9 };

  const wCaps = ch.capturedByWhite || [];
  const bCaps = ch.capturedByBlack || [];

  const wVal = wCaps.reduce((s, p) => s + (pieceValue[p] || 0), 0);
  const bVal = bCaps.reduce((s, p) => s + (pieceValue[p] || 0), 0);
  const diff = wVal - bVal;

  if (wCapEl) wCapEl.innerHTML = wCaps.map(p => `<span>${pieceUnicode[p] || p}</span>`).join('') || '<span style="color:var(--text3);font-size:11px;">None</span>';
  if (bCapEl) bCapEl.innerHTML = bCaps.map(p => `<span>${pieceUnicode[p] || p}</span>`).join('') || '<span style="color:var(--text3);font-size:11px;">None</span>';

  // Bar material info (small)
  if (wBarCap) wBarCap.textContent = wCaps.map(p => pieceUnicode[p] || '').join('') + (diff > 0 ? ` +${diff}` : '');
  if (bBarCap) bBarCap.textContent = bCaps.map(p => pieceUnicode[p] || '').join('') + (diff < 0 ? ` +${Math.abs(diff)}` : '');

  // Material display
  const matEl = document.getElementById('ch-material-display');
  if (matEl) {
    if (diff > 0) matEl.innerHTML = `<span style="color:#f0f0f0;font-weight:800;">${ch.playerWhite}</span> is up <span style="color:var(--chess-primary)">${diff}</span> point${diff !== 1 ? 's' : ''}`;
    else if (diff < 0) matEl.innerHTML = `<span style="color:var(--chess-primary);font-weight:800;">${ch.playerBlack}</span> is up <span style="color:var(--chess-primary)">${Math.abs(diff)}</span> point${Math.abs(diff) !== 1 ? 's' : ''}`;
    else matEl.textContent = 'Even material';
  }
}

function chCapture(capturer, piece) {
  const ch = S.chess;
  if (capturer === 'white') {
    if (!ch.capturedByWhite) ch.capturedByWhite = [];
    ch.capturedByWhite.push(piece);
  } else {
    if (!ch.capturedByBlack) ch.capturedByBlack = [];
    ch.capturedByBlack.push(piece);
  }
  save();
  _renderChessMaterial();
}

function chUndoCapture(capturer) {
  const ch = S.chess;
  if (capturer === 'white' && ch.capturedByWhite && ch.capturedByWhite.length) ch.capturedByWhite.pop();
  else if (capturer === 'black' && ch.capturedByBlack && ch.capturedByBlack.length) ch.capturedByBlack.pop();
  save();
  _renderChessMaterial();
}

function chResult(winner, reason) {
  const ch = S.chess;
  stopChessClock();
  ch.clockRunning = false;
  ch.matchOver = true;
  ch.result = winner; // 'white' | 'black' | null (draw)
  ch.resultReason = reason;

  const reasonLabels = {
    checkmate: 'Checkmate', resign: 'Resignation', timeout: 'Time Out',
    draw_agreement: 'Draw by Agreement', stalemate: 'Stalemate',
    draw_50: '50-move Rule', draw_repetition: 'Threefold Repetition',
    draw_insufficient: 'Insufficient Material', draw_timeout: 'Draw on Time',
  };

  const reasonLabel = reasonLabels[reason] || reason;
  const winnerName = winner === 'white' ? ch.playerWhite : winner === 'black' ? ch.playerBlack : null;
  const resultStr = winner ? `${winnerName} wins by ${reasonLabel}` : `Draw — ${reasonLabel}`;
  const scoreStr = winner === 'white' ? '1–0' : winner === 'black' ? '0–1' : '½–½';

  const resEl = document.getElementById('ch-match-result');
  const winEl = document.getElementById('ch-result-winner');
  const reasonEl = document.getElementById('ch-result-reason');
  if (resEl) resEl.classList.remove('hidden');
  if (winEl) winEl.textContent = winner ? `${winnerName} wins!` : 'Draw!';
  if (reasonEl) reasonEl.textContent = `${scoreStr} — ${reasonLabel}`;

  // Save to history
  S.history.unshift({
    id: Date.now(), sport: 'chess',
    title: `${ch.playerWhite} vs ${ch.playerBlack}`,
    result: resultStr,
    detail: `${scoreStr} • ${ch.moves.length} moves${ch.timeControl !== 'none' ? ' • ' + ch.timeControl.replace('_', '+').replace('bullet', 'Bullet').replace('blitz', 'Blitz').replace('rapid', 'Rapid') : ''}`,
    date: new Date().toLocaleDateString(),
  });
  save();
  renderHistory();
  renderChessLive();
  toast(winner ? `♔ ${winnerName} wins — ${reasonLabel}!` : `½–½ Draw — ${reasonLabel}`);
}

function newChessMatch() {
  stopChessClock();
  S.chess = JSON.parse(JSON.stringify(DEFAULT_STATE.chess));
  _chBoard = null;
  _chSelected = null;
  _chLegalMoves = [];
  document.getElementById('chess-no-match').classList.remove('hidden');
  document.getElementById('chess-live-ui').classList.add('hidden');
  document.getElementById('ch-match-result').classList.add('hidden');
  save();
  showTab('match');
}

// ─── Chess Board Canvas Drawing (chess.com-style with SVG pieces) ───

// Pre-built SVG piece paths for all 12 piece types (white & black)
// Using Staunton-style vector pieces similar to chess.com
const _CH_SVG_PIECES = {
  // White pieces — ivory/cream fill, dark outline
  'white_king':   `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="#fff" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11.63V6" stroke-linejoin="miter"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V17s-5.5-1.5-6 5.5c-0.5 5 4 6 4 6v7.5" stroke-linecap="butt"/><path d="M11.5 30c5.5-3 15.5-3 21 0M11.5 33.5c5.5-3 15.5-3 21 0M11.5 37c5.5-3 15.5-3 21 0"/><path d="M20 8h5M22.5 6v5" stroke-linejoin="miter" stroke-linecap="square"/></g></svg>`,
  'white_queen':  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round"><circle cx="6" cy="12" r="2.75"/><circle cx="14" cy="9" r="2.75"/><circle cx="22.5" cy="8" r="2.75"/><circle cx="31" cy="9" r="2.75"/><circle cx="39" cy="12" r="2.75"/><path d="M9 26c8.5-8.5 15.5-4 18 0 2-7 11-10 13-2 1 4.5-1 9.5-3 12 0 1-2 2-2 2H10s-2-1-2-2c-2-2.5-4-7.5-3-12z" stroke-linecap="butt"/><path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1 2.5-1 2.5h13.5"/><path d="M36 26c0 2-1.5 2-2.5 4-1 1.5-1 1-.5 3.5 1.5 1 1 2.5 1 2.5H22.5"/><path d="M11.5 30c5.5-3 15.5-3 22 0M12 33.5c6-1.5 15-1.5 21 0"/></g></svg>`,
  'white_rook':   `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5" stroke-linecap="butt"/><path d="M34 14l-3 3H14l-3-3"/><path d="M31 17v12.5H14V17" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/><path d="M11 14h23" fill="none" stroke-linejoin="miter"/></g></svg>`,
  'white_bishop': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="#fff" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g fill="#fff" stroke-linecap="butt"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/></g><path d="M17.5 26h10M15 30h15" stroke-linejoin="miter"/></g></svg>`,
  'white_knight': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="#fff" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#fff"/><path d="M24 18c.38 5.12-1.34 5.34-4.22 4.22-3.87-1.35-2.65-3.7-2.28-4.87C19.5 14.14 21.65 12.5 22.5 10c-.95 1.93-.17 4.17 1.5 8z" fill="#fff"/><path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z" fill="#000"/><path d="M14.933 15.75a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0z" fill="#000"/><path d="M12 36c-4 1-10 0-10-5 0-4 3-6 5-8l6-3 2-7c-3-1-5-4-5-4l2-5c8-1 13 2 17 5l-5 2c0 3-1 5-2 7-3 2-5 3-7 5-2 3-3 7 0 7 0 2 2 3 5 4l-8 .5z"/></g></svg>`,
  'white_pawn':   `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03L15 29.5h3.64c-.34.84-.64 1.74-.64 2.5 0 2.22 1.79 4 4 4s4-1.78 4-4c0-.76-.3-1.66-.64-2.5H29l-3.41-3.47C27.06 24.84 28 23.03 28 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  // Black pieces — dark fill, light outline
  'black_king':   `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="none" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11.63V6" stroke-linejoin="miter"/><path fill="#000" stroke-linecap="butt" stroke-linejoin="miter" d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/><path fill="#000" stroke-linecap="butt" d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V17s-5.5-1.5-6 5.5c-0.5 5 4 6 4 6v7.5"/><path d="M20 8h5M22.5 6v5" stroke-linejoin="miter" stroke-linecap="square"/><path d="M11.5 30c5.5-3 15.5-3 21 0M11.5 33.5c5.5-3 15.5-3 21 0M11.5 37c5.5-3 15.5-3 21 0" stroke="#fff"/></g></svg>`,
  'black_queen':  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="#000" stroke="#000" stroke-width="1.5" stroke-linejoin="round"><circle cx="6" cy="12" r="2.75"/><circle cx="14" cy="9" r="2.75"/><circle cx="22.5" cy="8" r="2.75"/><circle cx="31" cy="9" r="2.75"/><circle cx="39" cy="12" r="2.75"/><path d="M9 26c8.5-8.5 15.5-4 18 0 2-7 11-10 13-2 1 4.5-1 9.5-3 12 0 1-2 2-2 2H10s-2-1-2-2c-2-2.5-4-7.5-3-12z" stroke-linecap="butt"/><path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1 2.5-1 2.5h13.5"/><path d="M36 26c0 2-1.5 2-2.5 4-1 1.5-1 1-.5 3.5 1.5 1 1 2.5 1 2.5H22.5"/><path d="M11.5 30c5.5-3 15.5-3 22 0M12 33.5c6-1.5 15-1.5 21 0" stroke="#fff"/></g></svg>`,
  'black_rook':   `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="#000" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9v3zM12.5 32l1.5-2.5h17l1.5 2.5h-20zM12 36v-4h21v4H12z" stroke-linecap="butt"/><path d="M14 29.5v-13h17v13H14z" stroke-linecap="butt" stroke-linejoin="miter"/><path d="M14 16.5L11 14h23l-3 2.5H14zM11 14V9h4v2h5V9h5v2h5V9h4v5H11z" stroke-linecap="butt"/><path d="M12 35.5h21M13 31.5h19M14 29.5h17M14 16.5h17M11 14h23" fill="none" stroke="#fff" stroke-width="1" stroke-linejoin="miter"/></g></svg>`,
  'black_bishop': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="#000" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><g fill="#000" stroke-linecap="butt"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/><path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/><path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/></g><path d="M17.5 26h10M15 30h15" stroke="#fff" stroke-linejoin="miter"/></g></svg>`,
  'black_knight': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="none" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#000"/><path d="M24 18c.38 5.12-1.34 5.34-4.22 4.22-3.87-1.35-2.65-3.7-2.28-4.87C19.5 14.14 21.65 12.5 22.5 10c-.95 1.93-.17 4.17 1.5 8z" fill="#000"/><path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z" fill="#fff"/><path d="M14.933 15.75a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0z" fill="#fff"/><path d="M12 36c-4 1-10 0-10-5 0-4 3-6 5-8l6-3 2-7c-3-1-5-4-5-4l2-5c8-1 13 2 17 5l-5 2c0 3-1 5-2 7-3 2-5 3-7 5-2 3-3 7 0 7 0 2 2 3 5 4l-8 .5z" fill="#000"/></g></svg>`,
  'black_pawn':   `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03L15 29.5h3.64c-.34.84-.64 1.74-.64 2.5 0 2.22 1.79 4 4 4s4-1.78 4-4c0-.76-.3-1.66-.64-2.5H29l-3.41-3.47C27.06 24.84 28 23.03 28 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#000" stroke="#000" stroke-width="1.5" stroke-linecap="round"/></svg>`,
};

// Cache for piece images to avoid re-creating on every draw
const _chPieceImgCache = {};

function _getChPieceImg(color, type, size) {
  const key = `${color}_${type}_${size}`;
  if (_chPieceImgCache[key]) return _chPieceImgCache[key];
  const svgStr = _CH_SVG_PIECES[`${color}_${type}`];
  if (!svgStr) return null;
  const blob = new Blob([svgStr], {type: 'image/svg+xml'});
  const url = URL.createObjectURL(blob);
  const img = new Image(size, size);
  img.src = url;
  _chPieceImgCache[key] = img;
  return img;
}

// Last move tracking for highlighting
let _chLastMove = null; // {fr, ff, tr, tf}

function _drawChessBoard() {
  const canvas = document.getElementById('ch-board');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const sq = size / 8;

  // Board colors — classic chess.com green theme
  const lightSq = '#F2B8BC';   // soft pink (light squares)
  const darkSq  = '#4A7C5F';   // forest green (dark squares)
  const selectedHL  = 'rgba(30, 100, 60, 0.55)';   // green tint for selected
  const lastMoveHL  = 'rgba(255, 180, 180, 0.55)';  // pink tint for last move
  const legalDotClr = 'rgba(30, 80, 50, 0.25)';     // dark green dot
  const captureHL   = 'rgba(200, 50, 80, 0.4)';     // red-pink capture ring

  // ── 1. Draw squares ──
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const isLight = (r + f) % 2 === 0;
      ctx.fillStyle = isLight ? lightSq : darkSq;
      ctx.fillRect(f * sq, r * sq, sq, sq);

      // Last move highlight
      if (_chLastMove && ((r === _chLastMove.fr && f === _chLastMove.ff) || (r === _chLastMove.tr && f === _chLastMove.tf))) {
        ctx.fillStyle = lastMoveHL;
        ctx.fillRect(f * sq, r * sq, sq, sq);
      }

      // Selected square highlight
      if (_chSelected && _chSelected.r === r && _chSelected.f === f) {
        ctx.fillStyle = selectedHL;
        ctx.fillRect(f * sq, r * sq, sq, sq);
      }
    }
  }

  // ── 2. Legal move indicators ──
  _chLegalMoves.forEach(({r, f}) => {
    const hasPiece = _chBoard && _chBoard[r][f];
    if (hasPiece) {
      // Capture ring
      ctx.strokeStyle = captureHL;
      ctx.lineWidth = sq * 0.1;
      ctx.beginPath();
      ctx.arc(f * sq + sq/2, r * sq + sq/2, sq * 0.47, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Move dot
      ctx.fillStyle = legalDotClr;
      ctx.beginPath();
      ctx.arc(f * sq + sq/2, r * sq + sq/2, sq * 0.17, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // ── 3. Coordinate labels ──
  const fontSize = Math.max(9, Math.round(sq * 0.2));
  ctx.font = `bold ${fontSize}px "Barlow Condensed", sans-serif`;
  for (let i = 0; i < 8; i++) {
    const isLightRank = (i % 2 === 0);
    const isLightFile = (i % 2 !== 0);
    // Rank numbers on left edge
    ctx.fillStyle = isLightRank ? darkSq : lightSq;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(String(8 - i), 2, i * sq + 2);
    // File letters on bottom edge
    ctx.fillStyle = isLightFile ? darkSq : lightSq;
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText(String.fromCharCode(97 + i), (i + 1) * sq - 2, 8 * sq - 2);
  }

  // ── 4. Draw pieces ──
  if (!_chBoard) {
    // No game yet — overlay hint
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const boxH = sq * 1.2;
    ctx.fillRect(0, size/2 - boxH/2, size, boxH);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(sq * 0.42)}px "Barlow Condensed", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('▶  Start game to play', size/2, size/2);
    return;
  }

  const pieceSize = Math.round(sq * 0.88);
  const pieceOffset = (sq - pieceSize) / 2;

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = _chBoard[r][f];
      if (!piece) continue;

      const img = _getChPieceImg(piece.c, piece.t, pieceSize);
      const cx = f * sq + pieceOffset;
      const cy = r * sq + pieceOffset;

      if (img && img.complete && img.naturalWidth > 0) {
        // Drop shadow for depth
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = sq * 0.12;
        ctx.shadowOffsetX = sq * 0.04;
        ctx.shadowOffsetY = sq * 0.06;
        ctx.drawImage(img, cx, cy, pieceSize, pieceSize);
        ctx.restore();
      } else {
        // Fallback: Unicode while image loads
        if (img) img.onload = () => _drawChessBoard();
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = sq * 0.15;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `${sq * 0.72}px serif`;
        ctx.fillStyle = piece.c === 'white' ? '#FFFDE0' : '#1a1a1a';
        ctx.fillText(CH_PIECE_UNICODE[piece.c][piece.t], f*sq + sq/2, r*sq + sq/2 + sq*0.03);
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
      }
    }
  }
}

// _chLastMove is set at the top of _chMakeMove

// Board click handler — piece selection and moves
function _chBoardClick(event) {
  if (!_chBoard || !S.chess.matchStarted || S.chess.matchOver) return;
  const canvas = document.getElementById('ch-board');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (canvas.width / rect.width);
  const y = (event.clientY - rect.top) * (canvas.height / rect.height);
  const sq = canvas.width / 8;
  const f = Math.floor(x / sq);
  const r = Math.floor(y / sq);
  if (f < 0 || f > 7 || r < 0 || r > 7) return;

  const clickedPiece = _chBoard[r][f];
  const currentColor = S.chess.currentTurn;

  // If we have a pending promotion, ignore board clicks
  if (_chPromotionPending) return;

  if (_chSelected) {
    // Check if this is a legal move destination
    const isLegal = _chLegalMoves.some(m => m.r === r && m.f === f);
    if (isLegal) {
      _chMakeMove(_chSelected.r, _chSelected.f, r, f);
      _chSelected = null;
      _chLegalMoves = [];
      _drawChessBoard();
      return;
    }
    // Deselect or select new piece
    _chSelected = null;
    _chLegalMoves = [];
  }

  // Select a piece of current player
  if (clickedPiece && clickedPiece.c === currentColor) {
    _chSelected = {r, f};
    _chLegalMoves = _chGetLegalMoves(r, f);
  }
  _drawChessBoard();
}

function _chGetLegalMoves(r, f) {
  if (!_chBoard) return [];
  const piece = _chBoard[r][f];
  if (!piece) return [];
  const moves = [];
  const c = piece.c;
  const opp = c === 'white' ? 'black' : 'white';
  const dir = c === 'white' ? -1 : 1; // white moves up (decreasing r), black down

  const addMove = (tr, tf) => {
    if (tr < 0 || tr > 7 || tf < 0 || tf > 7) return false;
    const target = _chBoard[tr][tf];
    if (target && target.c === c) return false;
    moves.push({r: tr, f: tf});
    return !target; // false if blocked by any piece (capture stops sliding)
  };

  const slide = (dr, df) => {
    let tr = r + dr, tf = f + df;
    while (tr >= 0 && tr <= 7 && tf >= 0 && tf <= 7) {
      const target = _chBoard[tr][tf];
      if (target) { if (target.c !== c) moves.push({r:tr, f:tf}); break; }
      moves.push({r:tr, f:tf});
      tr += dr; tf += df;
    }
  };

  switch (piece.t) {
    case 'pawn':
      // Forward
      if (_chBoard[r+dir]?.[f] === null || _chBoard[r+dir]?.[f] === undefined) {
        if (!_chBoard[r+dir][f]) {
          moves.push({r: r+dir, f});
          // Double push from starting rank
          const startRank = c === 'white' ? 6 : 1;
          if (r === startRank && !_chBoard[r+2*dir][f]) moves.push({r: r+2*dir, f});
        }
      }
      // Captures
      [-1, 1].forEach(df => {
        const tr = r+dir, tf = f+df;
        if (tr >= 0 && tr <= 7 && tf >= 0 && tf <= 7 && _chBoard[tr][tf]?.c === opp) moves.push({r:tr, f:tf});
      });
      break;
    case 'knight':
      [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,df]) => addMove(r+dr, f+df));
      break;
    case 'bishop':
      [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,df]) => slide(dr,df));
      break;
    case 'rook':
      [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,df]) => slide(dr,df));
      break;
    case 'queen':
      [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,df]) => slide(dr,df));
      break;
    case 'king':
      [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,df]) => addMove(r+dr, f+df));
      // Castling (simplified: if king hasn't moved)
      if (!piece.moved) {
        if (!_chBoard[r][f+1] && !_chBoard[r][f+2] && _chBoard[r][7]?.t === 'rook' && !_chBoard[r][7].moved) moves.push({r, f:f+2, special:'castle-k'});
        if (!_chBoard[r][f-1] && !_chBoard[r][f-2] && !_chBoard[r][f-3] && _chBoard[r][0]?.t === 'rook' && !_chBoard[r][0].moved) moves.push({r, f:f-2, special:'castle-q'});
      }
      break;
  }
  return moves;
}

function _chMakeMove(fr, ff, tr, tf) {
  // Track last move for board highlighting
  _chLastMove = {fr, ff, tr, tf};
  const ch = S.chess;
  const piece = _chBoard[fr][ff];
  const target = _chBoard[tr][tf];
  const color = piece.c;

  // Capture
  if (target) {
    const list = color === 'white' ? ch.capturedByWhite : ch.capturedByBlack;
    if (!list) color === 'white' ? (ch.capturedByWhite = [target.t]) : (ch.capturedByBlack = [target.t]);
    else list.push(target.t);
  }

  // Special: castling
  const specialMove = _chLegalMoves.find(m => m.r === tr && m.f === tf)?.special;
  if (specialMove === 'castle-k') {
    _chBoard[fr][ff+1] = _chBoard[fr][7]; _chBoard[fr][7] = null;
  } else if (specialMove === 'castle-q') {
    _chBoard[fr][ff-1] = _chBoard[fr][0]; _chBoard[fr][0] = null;
  }

  // Move piece
  piece.moved = true;
  _chBoard[tr][tf] = piece;
  _chBoard[fr][ff] = null;

  // En passant (simplified visual)
  // Pawn promotion
  const promoteRank = color === 'white' ? 0 : 7;
  if (piece.t === 'pawn' && tr === promoteRank) {
    _chPromotionPending = {r: tr, f: tf, color};
    _showPromotionPicker(color, tr, tf);
    // Don't switch turn yet — wait for promotion choice
    return;
  }

  // Auto-log the move in algebraic-ish notation
  const files = 'abcdefgh';
  const notation = _chBuildNotation(piece.t, fr, ff, tr, tf, !!target, !!specialMove);
  ch.moves.push({ notation, color, isSpecial: !!specialMove, isCapture: !!target });

  if (color === 'black') ch.moveCount++;
  ch.currentTurn = color === 'white' ? 'black' : 'white';
  ch.clockRunning = true;
  if (ch.increment > 0) {
    if (color === 'white') ch.clockWhite += ch.increment;
    else ch.clockBlack += ch.increment;
  }
  if (!_chClockInterval && ch.timeControl !== 'none') startChessClock();

  save();
  renderChessLive();
}

function _chBuildNotation(type, fr, ff, tr, tf, isCapture, isCastle) {
  const files = 'abcdefgh';
  const dest = files[tf] + (8 - tr);
  if (type === 'pawn') return isCapture ? `${files[ff]}x${dest}` : dest;
  if (isCastle) return tf > ff ? 'O-O' : 'O-O-O';
  const pieceChar = { knight:'N', bishop:'B', rook:'R', queen:'Q', king:'K' }[type] || '';
  return pieceChar + (isCapture ? 'x' : '') + dest;
}

function _showPromotionPicker(color, r, f) {
  const overlay = document.getElementById('ch-board-overlay');
  if (!overlay) return;
  const pieces = ['queen','rook','bishop','knight'];
  const uni = CH_PIECE_UNICODE[color];
  overlay.innerHTML = `
    <div style="position:absolute;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:10;">
      <div style="background:var(--surface);border:2px solid var(--chess-border,rgba(192,132,252,.4));border-radius:16px;padding:16px;text-align:center;">
        <div style="font-size:12px;color:var(--text2);margin-bottom:10px;font-weight:800;">Choose promotion:</div>
        <div style="display:flex;gap:8px;">
          ${pieces.map(p => `<button onclick="_chPromote('${p}')" style="font-size:2.4rem;padding:8px 12px;border-radius:10px;border:1px solid var(--border);background:var(--surface-2);cursor:pointer;">${uni[p]}</button>`).join('')}
        </div>
      </div>
    </div>`;
}

function _chPromote(piece) {
  if (!_chPromotionPending) return;
  const {r, f, color} = _chPromotionPending;
  if (_chBoard[r][f]) _chBoard[r][f].t = piece;
  _chPromotionPending = null;

  const ch = S.chess;
  const overlay = document.getElementById('ch-board-overlay');
  if (overlay) overlay.innerHTML = '';

  // Log promotion
  const files = 'abcdefgh';
  const notation = files[f] + (8 - r) + '=' + { queen:'Q', rook:'R', bishop:'B', knight:'N' }[piece];
  ch.moves.push({ notation, color, isSpecial: true });
  if (color === 'black') ch.moveCount++;
  ch.currentTurn = color === 'white' ? 'black' : 'white';
  ch.clockRunning = true;
  if (!_chClockInterval && ch.timeControl !== 'none') startChessClock();

  save();
  renderChessLive();
}

// Wire up canvas click
(function _initChessBoardEvents() {
  const setup = () => {
    const canvas = document.getElementById('ch-board');
    if (canvas) {
      canvas.addEventListener('click', _chBoardClick);
      canvas.style.cursor = 'pointer';
      // Touch support
      canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        _chBoardClick(touch);
      }, { passive: false });
    }
  };
  // Try immediately and on DOMContentLoaded
  setup();
  document.addEventListener('DOMContentLoaded', setup);
})();

// Resize chess board canvas to fit container
function _resizeChessCanvas() {
  const canvas = document.getElementById('ch-board');
  if (!canvas) return;
  const wrap = canvas.parentElement;
  if (!wrap) return;
  const size = wrap.clientWidth;
  if (size > 0 && canvas.width !== size) {
    canvas.width = size;
    canvas.height = size;
    if (S.chess.matchStarted) _drawChessBoard();
    else _drawChessBoard();
  }
}
window.addEventListener('resize', _resizeChessCanvas);
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(_resizeChessCanvas, 100);
  setTimeout(_resizeChessCanvas, 500);
});


// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// GATEWAY PEEKING CARD CAROUSEL
// ═══════════════════════════════════════════════════════