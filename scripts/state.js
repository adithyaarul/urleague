// ─── State: DEFAULT_STATE, S, save/load, blank helpers ───


// ═══════════════════════════════════════════════════════
// STATE MANAGEMENT
// ═══════════════════════════════════════════════════════

const DEFAULT_STATE = {
  sport: null,
  mode: 'scorer',
  roomCode: '',
  theme: 'dark',
  commentaryLanguageBySport: {
    cricket: 'en',
    football: 'en',
    badminton: 'en',
  },

  // ═══ GLOBAL PLAYER REGISTRY ═══
  // Each entry: { id, name, photo, role, trivia,
  //   cricket: { matches, runs, balls, fours, sixes, outs, wickets, runsConceded, potm, pots, fifties, hundreds, bestScore, bestWickets, threefers, fifers, boundaries },
  //   football: { matches, goals, assists, yellowCards, redCards, fouls },
  //   badminton: { matches, wins, losses, setsWon, setsLost, pointsWon, pointsLost }
  // }
  players: [],

  cricket: {
    players: [],
    teamA: [], teamB: [],
    teamAName: 'Team A', teamBName: 'Team B',
    format: 'single',
    seriesSize: 3,
    overs: 10,
    tossWinner: '', tossChoice: 'bat',
    matchStarted: false, matchOver: false,
    currentInnings: 1,
    innings: [
      { runs:0, wickets:0, balls:0, ballLog:[], playerStats:{}, currentOver:[] },
      { runs:0, wickets:0, balls:0, ballLog:[], playerStats:{}, currentOver:[] }
    ],
    striker: '', bowler: '',
    seriesInfo: { type:'single', current:1, total:1, wins:{ A:0, B:0 } },
    houseRules: {},
  },

  football: {
    homeTeam: 'Home FC', awayTeam: 'Away FC',
    homeScore: 0, awayScore: 0,
    duration: 90,
    matchStarted: false, matchOver: false,
    half: 1,
    timerSeconds: 0, timerRunning: false,
    events: [],
    squad: [],
  },

  badminton: {
    playerA: 'Player A', playerB: 'Player B',
    format: 3, pointsToWin: 21,
    matchStarted: false, matchOver: false,
    server: 'a',
    currentSet: 1,
    sets: [
      { scoreA:0, scoreB:0, finished:false, winner:null },
      { scoreA:0, scoreB:0, finished:false, winner:null },
      { scoreA:0, scoreB:0, finished:false, winner:null },
    ],
    setsWonA: 0, setsWonB: 0,
  },

  pickleball: {
    playerA: 'Player A', playerB: 'Player B',
    format: 'singles', pointsToWin: 11, gamesToWin: 1,
    matchStarted: false, matchOver: false,
    server: 'a',
    currentGame: 1,
    games: [{ scoreA:0, scoreB:0, finished:false, winner:null }],
    gamesWonA: 0, gamesWonB: 0,
    eventLog: [],
    scoreHistory: [],
  },

  chess: {
    playerWhite: 'White', playerBlack: 'Black',
    timeControl: 'none', increment: 0, rated: false,
    currentTurn: 'white',
    matchStarted: false, matchOver: false,
    clockWhite: 0, clockBlack: 0, clockRunning: false, clockTurn: 'white',
    moves: [],
    capturedByWhite: [], capturedByBlack: [],
    result: null, resultReason: null,
    moveCount: 1,
  },

  history: [],
  library: [],
  gallery: [],
  scoringModel: {},
};

let S = JSON.parse(JSON.stringify(DEFAULT_STATE));
let _fbTimerInterval = null;
let _currentFbAction = null;

function save() {
  try { localStorage.setItem('arena-hub-v1', JSON.stringify(S)); } catch(e) {}
}

function load() {
  try {
    const d = localStorage.getItem('arena-hub-v1');
    if (d) S = Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), JSON.parse(d));
    S.cricket = Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE.cricket)), S.cricket || {});
    S.cricket.seriesInfo = Object.assign({ type:'single', current:1, total:1, wins:{ A:0, B:0 } }, S.cricket.seriesInfo || {});
    S.cricket.houseRules = Object.assign(getDefaultCricketHouseRules(), S.cricket.houseRules || {});
    if (!S.cricket.seriesSize) S.cricket.seriesSize = 3;
    if (!S.scoringModel) S.scoringModel = {};
    S.commentaryLanguageBySport = Object.assign(
      { cricket: 'en', football: 'en', badminton: 'en' },
      S.commentaryLanguageBySport || {}
    );
    // Ensure pickleball and chess state is merged
    if (!S.pickleball) S.pickleball = JSON.parse(JSON.stringify(DEFAULT_STATE.pickleball));
    else S.pickleball = Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE.pickleball)), S.pickleball);
    if (!S.chess) S.chess = JSON.parse(JSON.stringify(DEFAULT_STATE.chess));
    else S.chess = Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE.chess)), S.chess);

    // ── Migrate S.library → S.players (backward compat) ──
    if (!S.players) S.players = [];
    if (S.library && S.library.length) {
      S.library.forEach(lib => {
        if (!S.players.find(p => p.name.toLowerCase() === lib.name.toLowerCase())) {
          S.players.push({
            id: 'p_' + lib.name.toLowerCase().replace(/\s+/g,'_') + '_' + Date.now(),
            name: lib.name,
            photo: lib.photo || null,
            role: lib.role || 'All-rounder',
            trivia: lib.trivia || '',
            cricket: _blankCricketStats(),
            football: _blankFootballStats(),
            badminton: _blankBadmintonStats(),
          });
        }
      });
      // Also ensure library keeps working (mirror)
    }

    // ── Rebuild cricket stats on each player from history ──
    _rebuildPlayerCricketStatsFromHistory();

  } catch(e) {}
}

function _blankCricketStats() {
  return { matches:0, runs:0, balls:0, fours:0, sixes:0, outs:0, wickets:0, runsConceded:0, potm:0, pots:0, fifties:0, hundreds:0, bestScore:0, bestWickets:0, threefers:0, fifers:0, boundaries:0 };
}
function _blankFootballStats() {
  return { matches:0, goals:0, assists:0, yellowCards:0, redCards:0, fouls:0 };
}
function _blankBadmintonStats() {
  return { matches:0, wins:0, losses:0, setsWon:0, setsLost:0, pointsWon:0, pointsLost:0 };
}

function _getOrCreatePlayer(name) {
  let p = S.players.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (!p) {
    p = {
      id: 'p_' + name.toLowerCase().replace(/\s+/g,'_') + '_' + Date.now(),
      name,
      photo: null,
      role: 'All-rounder',
      trivia: '',
      cricket: _blankCricketStats(),
      football: _blankFootballStats(),
      badminton: _blankBadmintonStats(),
    };
    S.players.push(p);
    // Mirror to legacy library
    if (!S.library) S.library = [];
    if (!S.library.find(l => l.name.toLowerCase() === name.toLowerCase())) {
      S.library.push({ name, role:'All-rounder', trivia:'', photo:null });
    }
  }
  // Ensure sport sub-objects exist (upgrade old entries)
  if (!p.cricket) p.cricket = _blankCricketStats();
  if (!p.football) p.football = _blankFootballStats();
  if (!p.badminton) p.badminton = _blankBadmintonStats();
  return p;
}

function _rebuildPlayerCricketStatsFromHistory() {
  // Zero out cricket stats for all players first
  S.players.forEach(p => { p.cricket = _blankCricketStats(); });

  S.history.filter(m => m.sport === 'cricket').forEach(match => {
    Object.entries(match.cricketStats || {}).forEach(([name, s]) => {
      if (!name || name === 'undefined') return;
      const p = _getOrCreatePlayer(name);
      const t = p.cricket;
      t.matches += 1;
      t.runs    += s.runs || 0;
      t.balls   += s.balls || 0;
      t.fours   += s.fours || 0;
      t.sixes   += s.sixes || 0;
      t.outs    += s.outs || 0;
      t.wickets += s.wickets || 0;
      t.runsConceded += s.runsConceded || 0;
      t.potm    += s.potm || 0;
      t.pots    += s.pots || 0;
      t.bestScore   = Math.max(t.bestScore, s.runs || 0);
      t.bestWickets = Math.max(t.bestWickets, s.wickets || 0);
      const wkts = s.wickets || 0;
      if (wkts >= 5) t.fifers  += 1;
      if (wkts >= 3) t.threefers += 1;
      const runs = s.runs || 0;
      if (runs >= 100) t.hundreds += 1;
      else if (runs >= 50) t.fifties += 1;
      t.boundaries = t.fours + t.sixes;
    });
  });

  // Rebuild football stats from history
  S.players.forEach(p => { p.football = _blankFootballStats(); });
  S.history.filter(m => m.sport === 'football').forEach(match => {
    (match.footballPlayerStats || []).forEach(ps => {
      const p = _getOrCreatePlayer(ps.name);
      const t = p.football;
      t.matches += 1;
      t.goals += ps.goals || 0;
      t.assists += ps.assists || 0;
      t.yellowCards += ps.yellow || 0;
      t.redCards += ps.red || 0;
      t.fouls += ps.fouls || 0;
    });
  });

  // Rebuild badminton stats from history
  S.players.forEach(p => { p.badminton = _blankBadmintonStats(); });
  S.history.filter(m => m.sport === 'badminton').forEach(match => {
    (match.badmintonPlayerStats || []).forEach(ps => {
      const p = _getOrCreatePlayer(ps.name);
      const t = p.badminton;
      t.matches += 1;
      t.wins += ps.wins || 0;
      t.losses += ps.losses || 0;
      t.setsWon += ps.setsWon || 0;
      t.setsLost += ps.setsLost || 0;
    });
  });
}

// ═══════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════
let _toastTimer;