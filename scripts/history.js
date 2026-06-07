function saveToHistory(entry) {
  S.history.unshift({ ...entry, id: Date.now(), dateISO: entry.dateISO || new Date().toISOString() });
  save();
  renderHistory();
}

let _calendarMonth = new Date();

function showHistoryView(view) {
  const panels = {
    list: document.getElementById('hv-list'),
    stats: document.getElementById('hv-stats'),
    achieve: document.getElementById('hv-achieve'),
    h2h: document.getElementById('hv-h2h'),
    calendar: document.getElementById('hv-calendar'),
    points: document.getElementById('hv-points'),
  };
  Object.values(panels).forEach(panel => panel && panel.classList.add('hidden'));
  if (panels[view]) panels[view].classList.remove('hidden');

  const buttons = {
    list: document.getElementById('hv-list-btn'),
    stats: document.getElementById('hv-stats-btn'),
    achieve: document.getElementById('hv-achieve-btn'),
    h2h: document.getElementById('hv-h2h-btn'),
    calendar: document.getElementById('hv-cal-btn'),
    points: document.getElementById('hv-pts-btn'),
  };
  Object.entries(buttons).forEach(([key, btn]) => { if (btn) btn.classList.toggle('primary-flat', key === view); });

  if (view === 'list') renderHistory();
  if (view === 'stats') renderPlayerStats();
  if (view === 'achieve') renderAchievements();
  if (view === 'h2h') renderH2H();
  if (view === 'calendar') renderCalendar();
  if (view === 'points') renderPointsTable();
}

function renderHistory() {
  const el = document.getElementById('history-list');
  if (!el) return;
  const filtered = S.sport ? S.history.filter(m => m.sport === S.sport) : S.history;
  if (!filtered.length) {
    el.innerHTML = `<div style="font-size:12px;color:var(--text3);text-align:center;padding:24px 0;">No ${S.sport || ''} matches yet. Play one to start your record!</div>`;
    return;
  }

  // Group consecutive series matches under a single series card
  const groups = [];
  const usedIds = new Set();

  filtered.forEach(m => {
    if (usedIds.has(m.id)) return;
    if (m.seriesType === 'series' && m.sport === 'cricket') {
      // Collect all series matches with the same teams played around the same time
      // We use title as the grouping key (same TeamA vs TeamB)
      const peers = filtered.filter(x =>
        !usedIds.has(x.id) &&
        x.seriesType === 'series' &&
        x.sport === 'cricket' &&
        x.title === m.title
      );
      peers.forEach(x => usedIds.add(x.id));
      // Compute series score from peer results
      let winsA = 0, winsB = 0;
      peers.forEach(x => {
        if (x.result && x.result.startsWith(m.teamA)) winsA++;
        else if (x.result && x.result.startsWith(m.teamB)) winsB++;
      });
      groups.push({ type: 'series', matches: peers, teamA: m.teamA, teamB: m.teamB, winsA, winsB, date: m.date, sport: m.sport });
    } else {
      usedIds.add(m.id);
      groups.push({ type: 'single', match: m });
    }
  });

  el.innerHTML = groups.map(g => {
    if (g.type === 'series') {
      const ids = g.matches.map(x => x.id).join(',');
      const seriesLabel = `${g.winsA} – ${g.winsB}`;
      const leader = g.winsA > g.winsB ? g.teamA : g.winsB > g.winsA ? g.teamB : null;
      const statusText = leader ? `${leader} won` : 'Level';
      const matchCount = g.matches.length;
      return `
        <div class="history-item" style="flex-direction:column;align-items:stretch;gap:6px;cursor:pointer;" onclick="showSeriesDetail([${ids}])">
          <div style="display:flex;align-items:flex-start;gap:10px;">
            <div class="history-sport-dot ${g.sport}" style="margin-top:6px;"></div>
            <div class="history-info" style="flex:1;">
              <div class="history-title">${esc(g.teamA)} vs ${esc(g.teamB)}</div>
              <div class="history-result">${esc(statusText)} · Series ${seriesLabel}</div>
              <div class="history-meta">${g.date} · ${g.sport} · ${matchCount} match${matchCount !== 1 ? 'es' : ''}</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;margin-top:2px;">
              <span style="font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;color:var(--sport-primary);letter-spacing:-.01em;">${seriesLabel}</span>
              <i class="ti ti-chevron-right" style="color:var(--text3);font-size:14px;"></i>
            </div>
          </div>
        </div>`;
    } else {
      const m = g.match;
      return `
        <div class="history-item" onclick="showHistoryDetail(${m.id})">
          <div class="history-sport-dot ${m.sport}"></div>
          <div class="history-info">
            <div class="history-title">${esc(m.title)}</div>
            <div class="history-result">${esc(m.result)}</div>
            <div class="history-meta">${m.date} · ${m.sport} · ${m.detail || ''}</div>
          </div>
        </div>`;
    }
  }).join('');
}

function showSeriesDetail(ids) {
  const matches = ids.map(id => S.history.find(m => m.id === id)).filter(Boolean);
  if (!matches.length) return;
  const teamA = matches[0].teamA;
  const teamB = matches[0].teamB;
  let winsA = 0, winsB = 0;
  matches.forEach(m => {
    if (m.result && m.result.startsWith(teamA)) winsA++;
    else if (m.result && m.result.startsWith(teamB)) winsB++;
  });
  const seriesWinner = winsA > winsB ? teamA : winsB > winsA ? teamB : null;
  const matchRows = matches.map((m, i) => `
    <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:10px 13px;margin-bottom:8px;cursor:pointer;" onclick="showHistoryDetail(${m.id})">
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--text3);margin-bottom:4px;">Match ${i + 1}</div>
      <div style="font-size:13px;font-weight:700;color:var(--text);">${esc(m.result)}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:3px;">${m.detail || ''} · ${m.date}</div>
    </div>`).join('');
  document.getElementById('history-detail-content').innerHTML = `
    <h3 style="margin-bottom:4px;"><i class="ti ti-trophy"></i> Series Summary</h3>
    <div style="text-align:center;margin:14px 0 16px;">
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:40px;font-weight:900;color:var(--sport-primary);letter-spacing:-.01em;">${winsA} : ${winsB}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:2px;">${esc(teamA)} vs ${esc(teamB)}</div>
      ${seriesWinner ? `<div style="margin-top:8px;display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(74,222,128,.15);color:#4ade80;font-size:11px;font-weight:800;border:1px solid rgba(74,222,128,.3);">🏆 ${esc(seriesWinner)} won the series</div>` : `<div style="margin-top:8px;display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(148,163,184,.1);color:var(--text3);font-size:11px;font-weight:800;">Series level</div>`}
    </div>
    <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:10px;">Match Results</div>
    ${matchRows}`;
  openModal('history-detail-modal');
}

function getCricketHistoryEntries() {
  return S.history.filter(m => m.sport === 'cricket');
}



function computeCricketAllStats() {
  const totals = {};
  getCricketHistoryEntries().forEach(match => {
    Object.entries(match.cricketStats || {}).forEach(([name, s]) => {
      if (!name || String(name).trim() === '' || name === 'undefined') return;
      if (!totals[name]) totals[name] = {
        matches:0, innings:0, runs:0, balls:0, fours:0, sixes:0, outs:0,
        wickets:0, runsConceded:0, potm:0, pots:0,
        fifties:0, hundreds:0, bestScore:0, bestWickets:0,
        threefers:0, fifers:0, boundaries:0,
      };
      const t = totals[name];
      t.matches += 1;
      t.innings += s.innings || ((s.balls||0)>0||(s.runs||0)>0 ? 1 : 0);
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
      t.boundaries  = t.fours + t.sixes;
      const wkts = s.wickets || 0;
      if (wkts >= 5) t.fifers  += 1;
      if (wkts >= 3) t.threefers += 1;
      const runs = s.runs || 0;
      if (runs >= 100) t.hundreds += 1;
      else if (runs >= 50) t.fifties += 1;
    });
  });
  // Recompute boundaries after all matches
  Object.values(totals).forEach(t => { t.boundaries = (t.fours || 0) + (t.sixes || 0); });
  return totals;
}

// Best finisher: highest SR among players with 10+ balls all-time
function getBestFinisher(stats) {
  let best = null, bestSR = 0;
  Object.entries(stats).forEach(([name, s]) => {
    if ((s.balls || 0) >= 10) {
      const sr = (s.runs / s.balls) * 100;
      if (sr > bestSR) { bestSR = sr; best = name; }
    }
  });
  return { name: best, sr: bestSR };
}

// Best single-match performance from history
function getBestMatchRuns(stats) {
  let best = { name: null, runs: 0 };
  getCricketHistoryEntries().forEach(match => {
    Object.entries(match.cricketStats || {}).forEach(([name, s]) => {
      if ((s.runs || 0) > best.runs) best = { name, runs: s.runs };
    });
  });
  return best;
}

function getBestMatchWickets(stats) {
  let best = { name: null, wickets: 0 };
  getCricketHistoryEntries().forEach(match => {
    Object.entries(match.cricketStats || {}).forEach(([name, s]) => {
      if ((s.wickets || 0) > best.wickets) best = { name, wickets: s.wickets };
    });
  });
  return best;
}

function renderPlayerStats() {
  const el = document.getElementById('player-stats-list');
  if (!el) return;
  const sport = S.sport || 'cricket';

  if (sport === 'cricket') {
    const stats = computeCricketAllStats();
    const rawEntries = Object.entries(stats);
    if (!rawEntries.length) { el.innerHTML = '<div class="alert info" style="font-size:12px;">Play cricket matches to unlock player stats.</div>'; return; }

    const sortKey = window._statsSortKey || 'runs';
    const sortFns = {
      runs:    (a,b) => b[1].runs - a[1].runs,
      sr:      (a,b) => { const sa = a[1].balls>0?(a[1].runs/a[1].balls)*100:0, sb = b[1].balls>0?(b[1].runs/b[1].balls)*100:0; return sb-sa; },
      wickets: (a,b) => b[1].wickets - a[1].wickets,
      avg:     (a,b) => { const aa = a[1].outs>0?a[1].runs/a[1].outs:a[1].runs, ab = b[1].outs>0?b[1].runs/b[1].outs:b[1].runs; return ab-aa; },
      sixes:   (a,b) => (b[1].sixes||0) - (a[1].sixes||0),
      fours:   (a,b) => (b[1].fours||0) - (a[1].fours||0),
      matches: (a,b) => b[1].matches - a[1].matches,
      fifers:  (a,b) => (b[1].fifers||0) - (a[1].fifers||0),
    };
    const entries = rawEntries.sort(sortFns[sortKey] || sortFns.runs);

    const sortLabels = [
      {k:'runs',l:'Runs'},{k:'wickets',l:'Wickets'},{k:'sr',l:'Strike Rate'},
      {k:'avg',l:'Average'},{k:'sixes',l:'Sixes'},{k:'fours',l:'Fours'},
      {k:'matches',l:'Matches'},{k:'fifers',l:'5-Fers'},
    ];
    const sortBar = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center;">
      <span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-right:2px;">Sort:</span>
      ${sortLabels.map(({k,l})=>`<button onclick="window._statsSortKey='${k}';renderPlayerStats()" style="padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;cursor:pointer;border:1px solid ${k===sortKey?'var(--sport-primary-m)':'var(--border)'};background:${k===sortKey?'var(--sport-primary-l)':'var(--surface-2)'};color:${k===sortKey?'var(--sport-primary)':'var(--text3)'};">${l}</button>`).join('')}
    </div>`;

    const rows = entries.map(([name, s]) => {
      const sr = s.balls ? ((s.runs / s.balls) * 100).toFixed(0) : '0';
      const avg = s.outs>0 ? (s.runs/s.outs).toFixed(1) : s.runs>0?s.runs:'—';
      const srNum = parseFloat(sr);
      const srClass = srNum >= 200 ? 'amber' : srNum >= 150 ? 'green' : srNum >= 100 ? 'blue' : '';
      const wktsClass = s.wickets >= 5 ? 'amber' : s.wickets >= 3 ? 'green' : s.wickets > 0 ? 'hi' : 'dim';
      return `<tr><td>${esc(name)}</td><td>${s.matches}</td><td class="hi">${s.runs}</td><td class="${srClass}">${sr}</td><td>${avg}</td><td>${s.sixes||0}</td><td>${s.fours||0}</td><td class="${wktsClass}">${s.wickets}</td><td>${s.threefers||0}</td><td>${s.fifers||0}</td></tr>`;
    }).join('');
    el.innerHTML = sortBar + `<div class="stats-table-wrap"><table class="stats-table"><thead><tr><th>Player</th><th>M</th><th>Runs</th><th>SR</th><th>Avg</th><th>6s</th><th>4s</th><th>Wkts</th><th>3W</th><th>5W</th></tr></thead><tbody>${rows}</tbody></table></div>`;

  } else if (sport === 'football') {
    // Build per-player football stats from history
    const totals = {};
    S.history.filter(m => m.sport === 'football').forEach(match => {
      (match.footballPlayerStats || []).forEach(ps => {
        if (!ps.name) return;
        if (!totals[ps.name]) totals[ps.name] = { matches:0, goals:0, assists:0, yellow:0, red:0, fouls:0 };
        const t = totals[ps.name];
        t.matches++; t.goals += ps.goals||0; t.assists += ps.assists||0;
        t.yellow += ps.yellow||0; t.red += ps.red||0; t.fouls += ps.fouls||0;
      });
    });
    const entries = Object.entries(totals).sort((a,b) => b[1].goals - a[1].goals);
    if (!entries.length) { el.innerHTML = '<div class="alert info" style="font-size:12px;">Complete football matches with a squad to unlock player stats.</div>'; return; }
    const rows = entries.map(([name, s]) => `<tr><td>${esc(name)}</td><td>${s.matches}</td><td class="hi" style="color:var(--football-primary)">${s.goals}</td><td>${s.assists}</td><td style="color:var(--amber)">${s.yellow}</td><td style="color:var(--red)">${s.red}</td><td>${s.fouls}</td></tr>`).join('');
    el.innerHTML = `<div class="stats-table-wrap"><table class="stats-table"><thead><tr><th>Player</th><th>M</th><th>Goals</th><th>Assist</th><th>YC</th><th>RC</th><th>Fouls</th></tr></thead><tbody>${rows}</tbody></table></div>`;

  } else if (sport === 'badminton') {
    const totals = {};
    S.history.filter(m => m.sport === 'badminton').forEach(match => {
      (match.badmintonPlayerStats || []).forEach(ps => {
        if (!ps.name) return;
        if (!totals[ps.name]) totals[ps.name] = { matches:0, wins:0, losses:0, setsWon:0, setsLost:0 };
        const t = totals[ps.name];
        t.matches++; t.wins += ps.wins||0; t.losses += ps.losses||0;
        t.setsWon += ps.setsWon||0; t.setsLost += ps.setsLost||0;
      });
    });
    const entries = Object.entries(totals).sort((a,b) => b[1].wins - a[1].wins);
    if (!entries.length) { el.innerHTML = '<div class="alert info" style="font-size:12px;">Play badminton matches to unlock player stats.</div>'; return; }
    const rows = entries.map(([name, s]) => {
      const wr = s.matches > 0 ? Math.round((s.wins/s.matches)*100) : 0;
      return `<tr><td>${esc(name)}</td><td>${s.matches}</td><td class="hi" style="color:var(--badminton-primary)">${s.wins}</td><td>${s.losses}</td><td>${wr}%</td><td>${s.setsWon}</td><td>${s.setsLost}</td></tr>`;
    }).join('');
    el.innerHTML = `<div class="stats-table-wrap"><table class="stats-table"><thead><tr><th>Player</th><th>M</th><th>Wins</th><th>Loss</th><th>W%</th><th>Sets W</th><th>Sets L</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
}

function renderAchievements() {
  const el = document.getElementById('achievements-list');
  if (!el) return;
  const sport = S.sport || 'cricket';

  let achievements = [];

  if (sport === 'cricket') {
    const stats = computeCricketAllStats();
    const entries = Object.entries(stats).filter(([n]) => n && n !== 'undefined');
    if (!entries.length) { el.innerHTML = '<div class="alert info" style="font-size:12px;">Play cricket matches to unlock achievements.</div>'; window._achData = []; return; }
    const lb = (pick, min=0) => entries.map(([name,s]) => ({ name, val:pick(s), s })).filter(r => r.val > min).sort((a,b) => b.val - a.val);
    const matchRunsLb = () => { const best={}; getCricketHistoryEntries().forEach(m => Object.entries(m.cricketStats||{}).forEach(([n,s]) => { if(n&&n!=='undefined') best[n] = Math.max(best[n]||0, s.runs||0); })); return Object.entries(best).map(([name,val]) => ({name,val})).sort((a,b) => b.val-a.val); };
    const matchWktsLb = () => { const best={}; getCricketHistoryEntries().forEach(m => Object.entries(m.cricketStats||{}).forEach(([n,s]) => { if(n&&n!=='undefined') best[n] = Math.max(best[n]||0, s.wickets||0); })); return Object.entries(best).map(([name,val]) => ({name,val})).sort((a,b) => b.val-a.val); };
    achievements = [
      { icon:'<i class="ti ti-cricket" style="color:#ef4444"></i>', label:'Most Runs All Time', gold:true, lb:lb(s=>s.runs), fmt:r=>`${r.val} runs`, col:'Runs', sub:'Total runs across all matches', extraFn:r=>`SR ${r.s.balls?((r.s.runs/r.s.balls)*100).toFixed(0):'—'}` },
      { icon:'<i class="ti ti-target" style="color:#f87171"></i>', label:'Most Wickets All Time', gold:true, lb:lb(s=>s.wickets), fmt:r=>`${r.val} wickets`, col:'Wkts', sub:'Total wickets across all matches', extraFn:r=>`${r.s.fifers||0} five-fers` },
      { icon:'<i class="ti ti-bolt" style="color:#fbbf24"></i>', label:'Most Runs in a Match', lb:matchRunsLb(), fmt:r=>`${r.val} runs best`, col:'Best', sub:'Highest individual score in a single match', extraFn:()=>'' },
      { icon:'<i class="ti ti-bowling" style="color:#a78bfa"></i>', label:'Most Wickets in a Match', lb:matchWktsLb(), fmt:r=>`${r.val} wickets best`, col:'Best', sub:'Most wickets in a single match', extraFn:()=>'' },
      { icon:'<i class="ti ti-star-filled" style="color:#ffd700"></i>', label:'Most Player of the Match', gold:true, lb:lb(s=>s.potm), fmt:r=>`${r.val} award${r.val>1?'s':''}`, col:'POTM', sub:'Player of the Match awards', extraFn:r=>`${r.s.matches} matches` },
      { icon:'<i class="ti ti-trophy" style="color:#ffd700"></i>', label:'Most Player of the Series', lb:lb(s=>s.pots), fmt:r=>`${r.val} award${r.val>1?'s':''}`, col:'POTS', sub:'Player of the Series awards', extraFn:r=>`${r.s.matches} matches` },
      { icon:'<i class="ti ti-bolt" style="color:#38bdf8"></i>', label:'Best Finisher (SR, 10+ balls)', lb:entries.filter(([,s])=>(s.balls||0)>=10).map(([name,s])=>({name,val:parseFloat(((s.runs/s.balls)*100).toFixed(1)),s})).sort((a,b)=>b.val-a.val), fmt:r=>`SR ${r.val}`, col:'SR', sub:'Strike rate (minimum 10 balls faced)', extraFn:r=>`${r.s.runs} runs` },
      { icon:'<i class="ti ti-flame" style="color:#fb923c"></i>', label:'Hitman — Most Boundaries', lb:lb(s=>(s.fours||0)+(s.sixes||0)), fmt:r=>`${r.val} boundaries`, col:'Bdry', sub:'Total fours and sixes combined', extraFn:r=>`${r.s.fours||0}×4  ${r.s.sixes||0}×6` },
      { icon:'<i class="ti ti-ball-baseball" style="color:#fb923c"></i>', label:'Most Sixes', lb:lb(s=>s.sixes), fmt:r=>`${r.val} sixes`, col:'Sixes', sub:'Total sixes hit across all matches', extraFn:r=>`${r.s.fours||0} fours` },
      { icon:'<i class="ti ti-cricket" style="color:#4ade80"></i>', label:'Most Fours', lb:lb(s=>s.fours), fmt:r=>`${r.val} fours`, col:'Fours', sub:'Total fours hit across all matches', extraFn:r=>`${r.s.sixes||0} sixes` },
      { icon:'<i class="ti ti-target" style="color:#ef4444"></i>', label:'Most Five-fers', lb:lb(s=>s.fifers), fmt:r=>`${r.val} five-fer${r.val>1?'s':''}`, col:'Fifers', sub:'Five-wicket hauls in a single match', extraFn:r=>`${r.s.wickets} total wkts` },
      { icon:'<i class="ti ti-bowling" style="color:#a78bfa"></i>', label:'Most Three-fers', lb:lb(s=>s.threefers), fmt:r=>`${r.val} three-fer${r.val>1?'s':''}`, col:'3W+', sub:'Three-wicket hauls in a single match', extraFn:r=>`${r.s.wickets} total wkts` },
    ];

  } else if (sport === 'football') {
    // Build per-player football totals
    const totals = {};
    S.history.filter(m => m.sport === 'football').forEach(match => {
      (match.footballPlayerStats || []).forEach(ps => {
        if (!ps.name) return;
        if (!totals[ps.name]) totals[ps.name] = { matches:0, goals:0, assists:0, yellow:0, red:0, fouls:0 };
        const t = totals[ps.name];
        t.matches++; t.goals+=ps.goals||0; t.assists+=ps.assists||0; t.yellow+=ps.yellow||0; t.red+=ps.red||0; t.fouls+=ps.fouls||0;
      });
    });
    const entries = Object.entries(totals).filter(([n]) => n);
    if (!entries.length) { el.innerHTML = '<div class="alert info" style="font-size:12px;">Complete football matches with a named squad to unlock achievements.</div>'; window._achData = []; return; }
    const lb = (pick, min=0) => entries.map(([name,s]) => ({name,val:pick(s),s})).filter(r=>r.val>min).sort((a,b)=>b.val-a.val);
    achievements = [
      { icon:'<i class="ti ti-ball-football" style="color:#22c55e"></i>', label:'Top Scorer', gold:true, lb:lb(s=>s.goals), fmt:r=>`${r.val} goal${r.val!==1?'s':''}`, col:'Goals', sub:'Total goals across all matches', extraFn:r=>`${r.s.matches} matches` },
      { icon:'<i class="ti ti-arrow-right" style="color:#38bdf8"></i>', label:'Most Assists', lb:lb(s=>s.assists), fmt:r=>`${r.val} assist${r.val!==1?'s':''}`, col:'Ast', sub:'Total assists across all matches', extraFn:r=>`${r.s.goals} goals` },
      { icon:'<i class="ti ti-cards" style="color:#facc15"></i>', label:'Most Yellow Cards', lb:lb(s=>s.yellow), fmt:r=>`${r.val} yellow card${r.val!==1?'s':''}`, col:'YC', sub:'Yellow cards received', extraFn:r=>`${r.s.matches} matches` },
      { icon:'<i class="ti ti-cards" style="color:#f87171"></i>', label:'Most Red Cards', lb:lb(s=>s.red), fmt:r=>`${r.val} red card${r.val!==1?'s':''}`, col:'RC', sub:'Red cards received', extraFn:r=>`${r.s.yellow} yellows` },
      { icon:'<i class="ti ti-alert-triangle" style="color:#fb923c"></i>', label:'Most Fouls', lb:lb(s=>s.fouls), fmt:r=>`${r.val} foul${r.val!==1?'s':''}`, col:'Fouls', sub:'Total fouls committed', extraFn:r=>`${r.s.matches} matches` },
    ];

  } else if (sport === 'badminton') {
    const totals = {};
    S.history.filter(m => m.sport === 'badminton').forEach(match => {
      (match.badmintonPlayerStats || []).forEach(ps => {
        if (!ps.name) return;
        if (!totals[ps.name]) totals[ps.name] = { matches:0, wins:0, losses:0, setsWon:0, setsLost:0 };
        const t = totals[ps.name];
        t.matches++; t.wins+=ps.wins||0; t.losses+=ps.losses||0; t.setsWon+=ps.setsWon||0; t.setsLost+=ps.setsLost||0;
      });
    });
    const entries = Object.entries(totals).filter(([n]) => n);
    if (!entries.length) { el.innerHTML = '<div class="alert info" style="font-size:12px;">Play badminton matches to unlock achievements.</div>'; window._achData = []; return; }
    const lb = (pick, min=0) => entries.map(([name,s]) => ({name,val:pick(s),s})).filter(r=>r.val>min).sort((a,b)=>b.val-a.val);
    achievements = [
      { icon:'<i class="ti ti-ping-pong" style="color:#facc15"></i>', label:'Most Match Wins', gold:true, lb:lb(s=>s.wins), fmt:r=>`${r.val} win${r.val!==1?'s':''}`, col:'Wins', sub:'Total match wins', extraFn:r=>`${r.s.matches} played` },
      { icon:'<i class="ti ti-trophy" style="color:#ffd700"></i>', label:'Best Win Rate', lb:lb(s=>s.matches>=2?Math.round((s.wins/s.matches)*100):0), fmt:r=>`${r.val}% win rate`, col:'W%', sub:'Win rate (min. 2 matches)', extraFn:r=>`${r.s.wins}W–${r.s.losses}L` },
      { icon:'<i class="ti ti-bolt" style="color:#38bdf8"></i>', label:'Most Sets Won', lb:lb(s=>s.setsWon), fmt:r=>`${r.val} set${r.val!==1?'s':''}`, col:'Sets', sub:'Total sets won across all matches', extraFn:r=>`${r.s.matches} matches` },
      { icon:'<i class="ti ti-flame" style="color:#fb923c"></i>', label:'Most Matches Played', lb:lb(s=>s.matches), fmt:r=>`${r.val} match${r.val!==1?'es':''}`, col:'Played', sub:'Total matches played', extraFn:r=>`${r.s.wins}W–${r.s.losses}L` },
    ];
  }

  const filledAchievements = achievements.filter(a => a.lb && a.lb.length > 0);
  window._achData = filledAchievements;
  const cards = filledAchievements.map((a, i) => {
    const top = a.lb[0];
    return `<div class="achieve-card ${a.gold ? 'gold' : ''}" onclick="openAchSheet(${i})">
      <div class="achieve-icon-wrap">${a.icon}</div>
      <div class="achieve-body">
        <div class="achieve-label">${esc(a.label)}</div>
        <div class="achieve-player">${esc(top.name)}</div>
        <div class="achieve-value">${esc(a.fmt(top))}</div>
      </div>
      <i class="ti ti-chevron-right achieve-chevron"></i>
    </div>`;
  }).join('');
  el.innerHTML = cards || `<div class="alert info" style="font-size:12px;">No ${sport} achievements yet.</div>`;
}

function openAchSheet(idx) {
  const a = window._achData[idx];
  if (!a || !a.lb || !a.lb.length) return;
  document.getElementById('ach-sheet-icon').innerHTML = a.icon;
  document.getElementById('ach-sheet-title').textContent = a.label;
  document.getElementById('ach-sheet-sub').textContent = a.sub;

  const lb = a.lb;
  const getLib = name => (S.library || []).find(p => p.name === name) || {};

  function avatarHtml(name, size) {
    const lib = getLib(name);
    const cls = size === 'lg' ? 'lb-avatar' : 'lb-list-avatar';
    if (lib.photo) return `<div class="${cls}"><img src="${lib.photo}" alt="${esc(name)}"/></div>`;
    return `<div class="${cls}">${esc(name.charAt(0).toUpperCase())}</div>`;
  }

  // ── TOP 3 PODIUM ──
  const podiumOrder = [lb[1], lb[0], lb[2]]; // 2nd, 1st, 3rd
  const podiumRanks = ['rank2','rank1','rank3'];
  const podiumNums  = ['2','1','3'];
  const podiumBadges = ['<i class="ti ti-medal" style="color:#94a3b8;font-size:16px;"></i>','<i class="ti ti-trophy" style="color:#ffd700;font-size:16px;"></i>','<i class="ti ti-award" style="color:#fb923c;font-size:16px;"></i>'];
  const podiumExtra = ['','',''];

  const podiumHtml = podiumOrder.map((r, pi) => {
    if (!r) return `<div class="lb-podium-item ${podiumRanks[pi]}"><div class="lb-podium-block">${podiumNums[pi]}</div></div>`;
    const extra = a.extraFn ? a.extraFn(r) : '';
    return `
    <div class="lb-podium-item ${podiumRanks[pi]}">
      <div class="lb-avatar" style="${podiumRanks[pi]==='rank1'?'width:74px;height:74px;':''}">
        ${getLib(r.name).photo ? `<img src="${getLib(r.name).photo}" alt="${esc(r.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>` : `<span>${esc(r.name.charAt(0).toUpperCase())}</span>`}
        <span class="lb-avatar-badge">${podiumBadges[pi]}</span>
      </div>
      <div class="lb-podium-name">${esc(r.name)}</div>
      <div class="lb-score-pill">${r.val} ${esc(a.col)}</div>
      <div class="lb-podium-block">${podiumNums[pi]}</div>
    </div>`;
  }).join('');

  // ── REST OF LIST (rank 4+) ──
  const restHtml = lb.slice(3).map((r, i) => {
    const rank = i + 4;
    const extra = a.extraFn ? a.extraFn(r) : '';
    return `
    <div class="lb-list-row">
      <div class="lb-list-rank">${rank}</div>
      <div class="lb-list-trophy"><i class="ti ti-medal" style="color:#fbbf24;font-size:16px;"></i></div>
      ${avatarHtml(r.name, 'sm')}
      <div class="lb-list-info">
        <div class="lb-list-name">${esc(r.name)}</div>
        <div class="lb-list-sub">${extra || (r.s && r.s.matches ? r.s.matches+' matches' : '')}</div>
      </div>
      <div style="text-align:right">
        <div class="lb-list-val">${r.val}</div>
        <div class="lb-list-extra">${esc(a.col)}</div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('ach-sheet-body').innerHTML = `
    <div class="lb-podium">${podiumHtml}</div>
    ${lb.length > 3 ? `<div class="lb-list">${restHtml}</div>` : ''}
  `;

  document.getElementById('ach-sheet-overlay').classList.add('open');
}

function closeAchSheet() {
  document.getElementById('ach-sheet-overlay').classList.remove('open');
}

function getPlayerStatsForName(name) {
  const totals = { runs:0, balls:0, fours:0, sixes:0, wickets:0, matches:0, outs:0 };
  getCricketHistoryEntries().forEach(match => {
    const stat = match.cricketStats?.[name];
    if (!stat) return;
    totals.matches += 1;
    totals.runs += stat.runs || 0;
    totals.balls += stat.balls || 0;
    totals.fours += stat.fours || 0;
    totals.sixes += stat.sixes || 0;
    totals.wickets += stat.wickets || 0;
    totals.outs += stat.outs || 0;
  });
  return totals;
}

function renderH2H() {
  const sport = S.sport || 'cricket';
  const aSel = document.getElementById('h2h-player-a');
  const bSel = document.getElementById('h2h-player-b');
  const contentEl = document.getElementById('h2h-content');
  const rivalryEl = document.getElementById('rivalries-list');
  if (!aSel || !bSel || !contentEl || !rivalryEl) return;

  if (sport === 'football') {
    // Build player list from football history squad
    const playerSet = new Set();
    S.history.filter(m => m.sport === 'football').forEach(m => (m.footballPlayerStats||[]).forEach(ps => { if(ps.name) playerSet.add(ps.name); }));
    const names = [...playerSet];
    const prevA = aSel.value, prevB = bSel.value;
    const opts = ['<option value="">Select player...</option>', ...names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`)].join('');
    aSel.innerHTML = opts; bSel.innerHTML = opts;
    if (prevA) aSel.value = prevA; if (prevB) bSel.value = prevB;
    const a = aSel.value, b = bSel.value;

    // Rivalries: pairs by most combined goals
    const totals = {};
    S.history.filter(m=>m.sport==='football').forEach(m=>(m.footballPlayerStats||[]).forEach(ps=>{
      if(!ps.name) return;
      if(!totals[ps.name]) totals[ps.name]={goals:0,matches:0};
      totals[ps.name].goals+=ps.goals||0; totals[ps.name].matches++;
    }));
    const allNames = Object.keys(totals);
    const rivalryPairs = [];
    for(let i=0;i<Math.min(allNames.length,6);i++) for(let j=i+1;j<Math.min(allNames.length,6);j++) {
      const nA=allNames[i],nB=allNames[j];
      const combined = (totals[nA].goals||0)+(totals[nB].goals||0);
      if(combined>0) rivalryPairs.push({nA,nB,combined,diff:Math.abs((totals[nA].goals||0)-(totals[nB].goals||0))});
    }
    rivalryPairs.sort((x,y)=>y.combined-x.combined);
    rivalryEl.innerHTML = rivalryPairs.slice(0,4).map(r=>`
      <div class="h2h-rivalry-card" onclick="document.getElementById('h2h-player-a').value='${r.nA.replace(/'/g,"\\'")}';document.getElementById('h2h-player-b').value='${r.nB.replace(/'/g,"\\'")}';renderH2H();">
        <div class="h2h-rivalry-flame"><i class="ti ti-ball-football" style="color:var(--football-primary)"></i></div>
        <div class="h2h-rivalry-info">
          <div class="h2h-rivalry-names">${esc(r.nA)} vs ${esc(r.nB)}</div>
          <div class="h2h-rivalry-sub">${r.combined} combined goals · goal diff ${r.diff}</div>
        </div>
        <div class="h2h-rivalry-score">${r.diff===0?'LEVEL':r.diff}</div>
      </div>`).join('') || '<div class="alert info" style="font-size:12px;">Play more football matches to reveal rivalries.</div>';

    if (!a || !b || a===b) { contentEl.innerHTML='<div class="alert info" style="font-size:12px;">Select two different players to compare football stats.</div>'; return; }
    const sA = totals[a]||{goals:0,matches:0}, sB = totals[b]||{goals:0,matches:0};
    const maxG = Math.max(sA.goals,sB.goals,1);
    contentEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;margin-bottom:16px;">
        <div style="text-align:center"><div style="font-weight:900;font-size:15px;">${esc(a)}</div><div style="font-size:11px;color:var(--text3)">${sA.matches}M · ${sA.goals} goals</div></div>
        <div style="font-weight:900;font-size:18px;color:var(--text3)">VS</div>
        <div style="text-align:center"><div style="font-weight:900;font-size:15px;">${esc(b)}</div><div style="font-size:11px;color:var(--text3)">${sB.matches}M · ${sB.goals} goals</div></div>
      </div>
      <div style="margin-bottom:10px"><div style="font-size:10px;color:var(--text3);font-weight:800;margin-bottom:4px;">GOALS</div>
        <div style="display:flex;gap:6px;align-items:center">
          <div style="height:10px;border-radius:5px;background:var(--football-primary);width:${(sA.goals/maxG)*100}%;min-width:4px;flex:none;transition:width .4s"></div>
          <span style="font-size:12px;font-weight:800;color:var(--football-primary)">${sA.goals}</span>
          <span style="flex:1"></span>
          <span style="font-size:12px;font-weight:800;color:#60a5fa">${sB.goals}</span>
          <div style="height:10px;border-radius:5px;background:#60a5fa;width:${(sB.goals/maxG)*100}%;min-width:4px;flex:none;transition:width .4s"></div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text3);text-align:center;margin-top:8px;">Football H2H — goals and match stats compared</div>`;
    return;
  }

  if (sport === 'badminton') {
    const playerSet = new Set();
    S.history.filter(m=>m.sport==='badminton').forEach(m=>(m.badmintonPlayerStats||[]).forEach(ps=>{if(ps.name)playerSet.add(ps.name);}));
    const names = [...playerSet];
    const prevA = aSel.value, prevB = bSel.value;
    const opts = ['<option value="">Select player...</option>',...names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`)].join('');
    aSel.innerHTML = opts; bSel.innerHTML = opts;
    if(prevA) aSel.value=prevA; if(prevB) bSel.value=prevB;
    const a=aSel.value, b=bSel.value;

    const totals = {};
    S.history.filter(m=>m.sport==='badminton').forEach(m=>(m.badmintonPlayerStats||[]).forEach(ps=>{
      if(!ps.name) return;
      if(!totals[ps.name]) totals[ps.name]={matches:0,wins:0,losses:0,setsWon:0,setsLost:0};
      const t=totals[ps.name]; t.matches++; t.wins+=ps.wins||0; t.losses+=ps.losses||0; t.setsWon+=ps.setsWon||0; t.setsLost+=ps.setsLost||0;
    }));
    const allNames = Object.keys(totals);
    const rivalryPairs = [];
    for(let i=0;i<Math.min(allNames.length,6);i++) for(let j=i+1;j<Math.min(allNames.length,6);j++){
      const nA=allNames[i],nB=allNames[j]; const combined=(totals[nA].matches||0)+(totals[nB].matches||0);
      if(combined>0) rivalryPairs.push({nA,nB,combined});
    }
    rivalryPairs.sort((x,y)=>y.combined-x.combined);
    rivalryEl.innerHTML = rivalryPairs.slice(0,4).map(r=>`
      <div class="h2h-rivalry-card" onclick="document.getElementById('h2h-player-a').value='${r.nA.replace(/'/g,"\\'")}';document.getElementById('h2h-player-b').value='${r.nB.replace(/'/g,"\\'")}';renderH2H();">
        <div class="h2h-rivalry-flame"><i class="ti ti-ping-pong" style="color:var(--badminton-primary)"></i></div>
        <div class="h2h-rivalry-info"><div class="h2h-rivalry-names">${esc(r.nA)} vs ${esc(r.nB)}</div><div class="h2h-rivalry-sub">${r.combined} combined matches</div></div>
      </div>`).join('') || '<div class="alert info" style="font-size:12px;">Play more badminton matches to reveal rivalries.</div>';

    if(!a||!b||a===b){contentEl.innerHTML='<div class="alert info" style="font-size:12px;">Select two players to compare badminton records.</div>';return;}
    const sA=totals[a]||{matches:0,wins:0,losses:0,setsWon:0,setsLost:0}, sB=totals[b]||{matches:0,wins:0,losses:0,setsWon:0,setsLost:0};
    const wrA=sA.matches>0?Math.round((sA.wins/sA.matches)*100):0, wrB=sB.matches>0?Math.round((sB.wins/sB.matches)*100):0;
    const maxWR=Math.max(wrA,wrB,1);
    contentEl.innerHTML=`
      <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;margin-bottom:16px;">
        <div style="text-align:center"><div style="font-weight:900;font-size:15px;">${esc(a)}</div><div style="font-size:11px;color:var(--text3)">${sA.wins}W–${sA.losses}L</div></div>
        <div style="font-weight:900;font-size:18px;color:var(--text3)">VS</div>
        <div style="text-align:center"><div style="font-weight:900;font-size:15px;">${esc(b)}</div><div style="font-size:11px;color:var(--text3)">${sB.wins}W–${sB.losses}L</div></div>
      </div>
      ${[['Win Rate','%',wrA,wrB,maxWR,'var(--badminton-primary)','#60a5fa'],['Sets Won','sets',sA.setsWon,sB.setsWon,Math.max(sA.setsWon,sB.setsWon,1),'var(--badminton-primary)','#60a5fa']].map(([lbl,unit,vA,vB,mx,cA,cB])=>`
        <div style="margin-bottom:10px"><div style="font-size:10px;color:var(--text3);font-weight:800;margin-bottom:4px;">${lbl.toUpperCase()}</div>
          <div style="display:flex;gap:6px;align-items:center">
            <div style="height:10px;border-radius:5px;background:${cA};width:${(vA/mx)*100}%;min-width:4px;flex:none"></div>
            <span style="font-size:12px;font-weight:800;color:${cA}">${vA}${unit}</span>
            <span style="flex:1"></span>
            <span style="font-size:12px;font-weight:800;color:${cB}">${vB}${unit}</span>
            <div style="height:10px;border-radius:5px;background:${cB};width:${(vB/mx)*100}%;min-width:4px;flex:none"></div>
          </div>
        </div>`).join('')}`;
    return;
  }

  // ── CRICKET (original full radar) ──
  const allStats = computeCricketAllStats();
  const names = Object.keys(allStats);
  // aSel, bSel, contentEl, rivalryEl already declared above

  // Populate selects (preserve selection)
  const prevA = aSel.value, prevB = bSel.value;
  const options = ['<option value="">Select player...</option>', ...names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`)].join('');
  aSel.innerHTML = options; bSel.innerHTML = options;
  if (prevA) aSel.value = prevA;
  if (prevB) bSel.value = prevB;

  const a = aSel.value, b = bSel.value;

  // ── Always render Potential Rivalries ──
  const allEntries = Object.entries(allStats).filter(([n]) => n && n !== 'undefined');
  const rivalryPairs = [];
  for (let i = 0; i < Math.min(allEntries.length, 6); i++) {
    for (let j = i+1; j < Math.min(allEntries.length, 6); j++) {
      const [nA, sA] = allEntries[i], [nB, sB] = allEntries[j];
      const srA = sA.balls > 0 ? (sA.runs/sA.balls)*100 : 0;
      const srB = sB.balls > 0 ? (sB.runs/sB.balls)*100 : 0;
      // rivalry score = how evenly matched they are (lower diff = hotter rivalry)
      const runDiff = Math.abs((sA.runs||0) - (sB.runs||0));
      const wktDiff = Math.abs((sA.wickets||0) - (sB.wickets||0));
      const srDiff  = Math.abs(srA - srB);
      const heat = 1000 - runDiff - wktDiff*10 - srDiff;
      const totalRuns = (sA.runs||0) + (sB.runs||0);
      const totalWkts = (sA.wickets||0) + (sB.wickets||0);
      if (totalRuns > 0 || totalWkts > 0) {
        rivalryPairs.push({ nA, nB, sA, sB, heat, totalRuns, totalWkts, runDiff });
      }
    }
  }
  rivalryPairs.sort((x,y) => y.heat - x.heat);

  const flameFor = heat => heat > 800 ? '<i class="ti ti-flame" style="color:#fb923c"></i>' : heat > 600 ? '<i class="ti ti-bolt" style="color:#38bdf8"></i>' : heat > 400 ? '<i class="ti ti-cricket" style="color:#ef4444"></i>' : '<i class="ti ti-star" style="color:#fbbf24"></i>';
  const tagFor   = heat => heat > 800 ? 'Intense Rivalry' : heat > 600 ? 'Close Contest' : heat > 400 ? 'Building Rivalry' : 'Emerging Pair';

  rivalryEl.innerHTML = rivalryPairs.slice(0,4).map(r => `
    <div class="h2h-rivalry-card" onclick="
      document.getElementById('h2h-player-a').value='${r.nA.replace(/'/g,"\\'")}';
      document.getElementById('h2h-player-b').value='${r.nB.replace(/'/g,"\\'")}';
      renderH2H();">
      <div class="h2h-rivalry-flame">${flameFor(r.heat)}</div>
      <div class="h2h-rivalry-info">
        <div class="h2h-rivalry-names">${esc(r.nA)} vs ${esc(r.nB)}</div>
        <div class="h2h-rivalry-sub">${tagFor(r.heat)} · ${r.totalRuns} combined runs · ${r.totalWkts} combined wkts</div>
      </div>
      <div class="h2h-rivalry-score">${r.runDiff === 0 ? 'TIED' : r.runDiff}</div>
    </div>`).join('') || '<div class="alert info" style="font-size:12px;">Play more matches to reveal rivalries.</div>';

  if (!a || !b || a === b) {
    contentEl.innerHTML = '<div class="alert info" style="font-size:12px;">Select two different players above to compare their cricket stats.</div>';
    return;
  }

  const aS = getPlayerStatsForName(a);
  const bS = getPlayerStatsForName(b);
  const getLib = name => (S.library || []).find(p => p.name === name) || {};

  // ── 5 Pure Cricket Radar Axes ──
  const allVals = Object.values(allStats);
  const maxOf = pick => { const v = allVals.map(pick).filter(x=>x>0); return v.length ? Math.max(...v) : 1; };

  const axes = [
    {
      label: 'RUNS',
      fullName: 'Total Runs Scored',
      icon: 'ti-cricket',
      aRaw: aS.runs || 0,
      bRaw: bS.runs || 0,
      cap: maxOf(s => s.runs || 0),
    },
    {
      label: 'SR',
      fullName: 'Strike Rate (Runs per 100 balls)',
      icon: 'ti-bolt',
      aRaw: aS.balls > 0 ? parseFloat(((aS.runs/aS.balls)*100).toFixed(1)) : 0,
      bRaw: bS.balls > 0 ? parseFloat(((bS.runs/bS.balls)*100).toFixed(1)) : 0,
      cap: 250,
    },
    {
      label: 'WKTS',
      fullName: 'Wickets Taken',
      icon: 'ti-target',
      aRaw: aS.wickets || 0,
      bRaw: bS.wickets || 0,
      cap: maxOf(s => s.wickets || 0),
    },
    {
      label: 'BDRY',
      fullName: 'Boundaries Hit (4s + 6s)',
      icon: 'ti-bolt',
      aRaw: (aS.fours||0) + (aS.sixes||0),
      bRaw: (bS.fours||0) + (bS.sixes||0),
      cap: maxOf(s => (s.fours||0)+(s.sixes||0)),
    },
    {
      label: 'AVG',
      fullName: 'Batting Average (Runs per Dismissal)',
      icon: 'ti-chart-bar',
      aRaw: aS.outs > 0 ? parseFloat((aS.runs/aS.outs).toFixed(1)) : (aS.runs > 0 ? aS.runs : 0),
      bRaw: bS.outs > 0 ? parseFloat((bS.runs/bS.outs).toFixed(1)) : (bS.runs > 0 ? bS.runs : 0),
      cap: maxOf(s => s.outs > 0 ? s.runs/s.outs : (s.runs > 0 ? s.runs : 0)),
    },
  ];

  axes.forEach(ax => {
    ax.aNorm = Math.min(100, ax.cap > 0 ? Math.round((ax.aRaw/ax.cap)*100) : 0);
    ax.bNorm = Math.min(100, ax.cap > 0 ? Math.round((ax.bRaw/ax.cap)*100) : 0);
    ax.aDisp = Number.isInteger(ax.aRaw) ? ax.aRaw : ax.aRaw.toFixed(1);
    ax.bDisp = Number.isInteger(ax.bRaw) ? ax.bRaw : ax.bRaw.toFixed(1);
  });

  // Overall rating (weighted: runs 25%, SR 25%, wkts 20%, bdry 15%, avg 15%)
  const weights = [0.25, 0.25, 0.20, 0.15, 0.15];
  const aScore = axes.reduce((s,ax,i) => s + ax.aNorm*weights[i], 0);
  const bScore = axes.reduce((s,ax,i) => s + ax.bNorm*weights[i], 0);
  const aRating = (aScore/10).toFixed(1);
  const bRating = (bScore/10).toFixed(1);

  // ── SVG Radar ──
  const W=300, H=255, cx=W/2, cy=H/2+8, R=88;
  const ANG = -Math.PI/2;
  const ptAt = (norm,i) => {
    const a = ANG + 2*Math.PI*i/5;
    return [cx + R*(norm/100)*Math.cos(a), cy + R*(norm/100)*Math.sin(a)];
  };
  const axisEnd = i => { const a=ANG+2*Math.PI*i/5; return [cx+R*Math.cos(a), cy+R*Math.sin(a)]; };
  const poly = norm => [0,1,2,3,4].map(i=>ptAt(norm,i).join(',')).join(' ');
  const path = norms => [0,1,2,3,4].map((i,idx) => (idx===0?'M':'L')+ptAt(norms[i],i).map(v=>v.toFixed(1)).join(',')).join(' ')+'Z';

  const aNorms = axes.map(ax=>ax.aNorm);
  const bNorms = axes.map(ax=>ax.bNorm);

  // Label layout: each axis gets label + A value + B value
  const LABEL_R = R+22;
  const labelSvg = axes.map((ax,i) => {
    const ang = ANG + 2*Math.PI*i/5;
    const lx = cx + LABEL_R*Math.cos(ang);
    const ly = cy + LABEL_R*Math.sin(ang);
    const isTop    = i===0;
    const isLeft   = lx < cx-8;
    const isRight  = lx > cx+8;
    const aColor='#4ade80', bColor='#60a5fa';
    const GAP = 26;

    if (isTop) {
      // top: label above, values on sides
      return `
        <text x="${lx-GAP}" y="${ly+4}" fill="${aColor}" font-size="10" font-weight="900" text-anchor="end" font-family="'Barlow Condensed',sans-serif">${ax.aDisp}</text>
        <text x="${lx}" y="${ly-12}" fill="#94a3b8" font-size="9" font-weight="800" text-anchor="middle" font-family="'DM Sans',sans-serif">${ax.label}</text>
        <text x="${lx+GAP}" y="${ly+4}" fill="${bColor}" font-size="10" font-weight="900" text-anchor="start" font-family="'Barlow Condensed',sans-serif">${ax.bDisp}</text>`;
    }
    const labelY = ly + (ly>cy ? 2 : -4);
    const valY   = ly + (ly>cy ? 14 : -14);
    if (isLeft) {
      return `
        <text x="${lx}" y="${valY}" fill="${aColor}" font-size="10" font-weight="900" text-anchor="end" font-family="'Barlow Condensed',sans-serif">${ax.aDisp}</text>
        <text x="${lx}" y="${labelY}" fill="#94a3b8" font-size="9" font-weight="800" text-anchor="end" font-family="'DM Sans',sans-serif">${ax.label}</text>
        <text x="${lx+GAP*0.7}" y="${ly+4}" fill="${bColor}" font-size="10" font-weight="900" text-anchor="start" font-family="'Barlow Condensed',sans-serif">${ax.bDisp}</text>`;
    }
    // right side
    return `
      <text x="${lx-GAP*0.7}" y="${ly+4}" fill="${aColor}" font-size="10" font-weight="900" text-anchor="end" font-family="'Barlow Condensed',sans-serif">${ax.aDisp}</text>
      <text x="${lx}" y="${labelY}" fill="#94a3b8" font-size="9" font-weight="800" text-anchor="start" font-family="'DM Sans',sans-serif">${ax.label}</text>
      <text x="${lx}" y="${valY}" fill="${bColor}" font-size="10" font-weight="900" text-anchor="start" font-family="'Barlow Condensed',sans-serif">${ax.bDisp}</text>`;
  }).join('');

  const radarSvg = `
    <svg class="h2h-radar-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      ${[20,40,60,80,100].map(lvl=>`<polygon points="${poly(lvl)}" fill="none" stroke="rgba(148,163,184,.1)" stroke-width="1"/>`).join('')}
      ${[0,1,2,3,4].map(i=>{const[ex,ey]=axisEnd(i);return `<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="rgba(148,163,184,.14)" stroke-width="1"/>`;}).join('')}
      <path d="${path(bNorms)}" fill="rgba(96,165,250,.13)" stroke="#60a5fa" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="${path(aNorms)}" fill="rgba(74,222,128,.11)" stroke="#4ade80" stroke-width="2.5" stroke-linejoin="round"/>
      ${labelSvg}
    </svg>`;

  // ── Edge/Advantage Bar ──
  const total = aScore + bScore || 1;
  const aPct  = Math.round((aScore/total)*100);
  const bPct  = 100 - aPct;
  const winner = aScore >= bScore ? a : b;

  // ── Avatar ──
  const libA = getLib(a), libB = getLib(b);
  const avA = libA.photo
    ? `<img src="${libA.photo}" alt="${esc(a)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`
    : `<span>${esc(a.charAt(0).toUpperCase())}</span>`;
  const avB = libB.photo
    ? `<img src="${libB.photo}" alt="${esc(b)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`
    : `<span>${esc(b.charAt(0).toUpperCase())}</span>`;

  contentEl.innerHTML = `
    <div class="h2h-wrap">
      <div class="h2h-title-bar">
        <h3>Featured Players</h3>
        <p>Based on past performance</p>
      </div>
      <div class="h2h-players">
        <div class="h2h-player h2h-player-a">
          <div class="h2h-avatar">${avA}<span class="h2h-rating">${aRating}</span></div>
          <div class="h2h-player-name">${esc(a)}</div>
        </div>
        <div class="h2h-vs">VS</div>
        <div class="h2h-player h2h-player-b">
          <div class="h2h-avatar">${avB}<span class="h2h-rating">${bRating}</span></div>
          <div class="h2h-player-name">${esc(b)}</div>
        </div>
      </div>
      <div class="h2h-radar-wrap">${radarSvg}</div>
      <div class="h2h-legend">
        <div class="h2h-legend-item"><div class="h2h-legend-dot" style="background:#4ade80;"></div>${esc(a)}</div>
        <div class="h2h-legend-item"><div class="h2h-legend-dot" style="background:#60a5fa;"></div>${esc(b)}</div>
      </div>

      <!-- Axis legend -->
      <div class="h2h-axis-key">
        ${axes.map(ax=>`
          <div class="h2h-axis-key-row">
            <span class="h2h-axis-key-label"><i class="ti ${ax.icon}" style="font-size:12px;vertical-align:-1px;margin-right:3px;"></i>${ax.label}</span>
            <span class="h2h-axis-key-desc">${ax.fullName}</span>
          </div>`).join('')}
      </div>

      <!-- Advantage bar -->
      <div class="h2h-edge-bar">
        <div class="h2h-edge-label">Overall Edge</div>
        <div class="h2h-edge-track">
          <div class="h2h-edge-fill-a" style="width:${aPct}%"></div>
          <div class="h2h-edge-fill-b" style="width:${bPct}%"></div>
        </div>
        <div class="h2h-edge-names">
          <span style="color:#4ade80;">${esc(a)} ${aPct}%</span>
          <span style="color:#60a5fa;">${bPct}% ${esc(b)}</span>
        </div>
        <div class="h2h-edge-winner"><i class="ti ti-trophy" style="color:#ffd700;font-size:13px;vertical-align:-2px;margin-right:4px;"></i>${esc(winner)} has the edge</div>
      </div>
    </div>`;
}

function calPrev() {
  _calendarMonth = new Date(_calendarMonth.getFullYear(), _calendarMonth.getMonth() - 1, 1);
  renderCalendar();
}

function calNext() {
  _calendarMonth = new Date(_calendarMonth.getFullYear(), _calendarMonth.getMonth() + 1, 1);
  renderCalendar();
}

function renderCalendar() {
  const label = document.getElementById('cal-month-label');
  const grid = document.getElementById('cal-grid');
  const stats = document.getElementById('calendar-stats');
  if (!label || !grid || !stats) return;

  const month = _calendarMonth;
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);

  // Monday=0 offset (the screenshot uses Mon-Sun)
  let startOffset = (first.getDay() + 6) % 7; // convert Sun=0 to Mon=0

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;
  const todayDate = today.getDate();

  // Build match date set — filtered to current sport
  const sportMatches = S.history.filter(m => m.sport === (S.sport || 'cricket'));
  const dateCounts = {};
  sportMatches.forEach(match => {
    const raw = match.dateISO || match.date;
    const parse = new Date(raw);
    if (!isNaN(parse) && parse.getMonth() === monthIndex && parse.getFullYear() === year) {
      dateCounts[parse.getDate()] = (dateCounts[parse.getDate()] || 0) + 1;
    }
  });
  const total = Object.values(dateCounts).reduce((s, v) => s + v, 0);

  label.textContent = month.toLocaleString('en-US', { month: 'short', year: 'numeric' }).replace(',', '');
  stats.textContent = `${total} match${total === 1 ? '' : 'es'} played in ${month.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`;

  const cells = [];

  // Leading empty cells (Mon-based)
  for (let i = 0; i < startOffset; i++) {
    cells.push(`<div class="cal-day other-month"></div>`);
  }

  for (let d = 1; d <= last.getDate(); d++) {
    const hasMatch = !!dateCounts[d];
    const isToday = isCurrentMonth && d === todayDate;
    let cls = 'cal-day';
    if (hasMatch) cls += ' has-match';
    if (isToday) cls += ' today';
    cells.push(`<div class="${cls}" title="${hasMatch ? dateCounts[d] + ' match(es)' : ''}">${d}</div>`);
  }

  // Trailing cells to fill last row
  const totalCells = cells.length;
  const remainder = totalCells % 7;
  if (remainder !== 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      cells.push(`<div class="cal-day other-month"></div>`);
    }
  }

  grid.innerHTML = cells.join('');
}

// ═══════════════════════════════════════════════════════
// SCORING MODEL + POINTS TABLE
// ═══════════════════════════════════════════════════════

const DEFAULT_SCORING = {
  run:          { label:'RUN',                   def:1,   min:-10, max:10 },
  four:         { label:'4S',                    def:3,   min:-10, max:20 },
  six:          { label:'6S',                    def:6,   min:-10, max:30 },
  duck:         { label:'DUCK',                  def:-5,  min:-20, max:0  },
  goldenDuck:   { label:'GOLDEN DUCK',           def:-10, min:-30, max:0  },
  maidenBat:    { label:'MAIDEN (BAT)',           def:-5,  min:-20, max:0  },
  mostRunsOver: { label:'MOST RUNS IN OVER (BAT)',def:5,   min:-10, max:20 },
  wicket:       { label:'WICKET',                def:12,  min:0,   max:50 },
  wide:         { label:'WIDE',                  def:-1,  min:-10, max:0  },
  noBall:       { label:'NO BALL',               def:-1,  min:-10, max:0  },
  maidenBowl:   { label:'MAIDEN (BOWL)',          def:8,   min:0,   max:30 },
  fourConceded: { label:'4S CONCEDED',           def:-2,  min:-10, max:0  },
  mostRunsBowl: { label:'MOST RUNS IN OVER (BOWL)',def:-5, min:-20, max:0  },
  potm:         { label:'PLAYER OF THE MATCH',   def:20,  min:0,   max:50 },
};

function getScoringModel() {
  const model = {};
  Object.entries(DEFAULT_SCORING).forEach(([key, cfg]) => {
    const stored = S.scoringModel?.[key];
    model[key] = (stored !== undefined) ? stored : cfg.def;
  });
  return model;
}

function saveScoringModel(key, val) {
  if (!S.scoringModel) S.scoringModel = {};
  S.scoringModel[key] = val;
  save();
  renderPointsTable();
}

function resetScoringModel() {
  if (!confirm('Reset all scoring sliders to defaults?')) return;
  S.scoringModel = {};
  save();
  renderScoringSliders();
  renderPointsTable();
  toast('Scoring reset to defaults.');
}

function toggleScoringSliders() {
  const panel = document.getElementById('scoring-sliders-panel');
  const btn   = document.getElementById('sliders-toggle-btn');
  const hidden = panel.classList.toggle('hidden');
  btn.innerHTML = hidden
    ? '<i class="ti ti-adjustments-horizontal"></i> Adjust scoring'
    : '<i class="ti ti-eye-off"></i> Hide sliders';
  if (!hidden) renderScoringSliders();
}

function renderScoringSliders() {
  const panel = document.getElementById('scoring-sliders-panel');
  if (!panel) return;
  const model = getScoringModel();
  panel.innerHTML = Object.entries(DEFAULT_SCORING).map(([key, cfg]) => {
    const val = model[key];
    const range = cfg.max - cfg.min;
    const pct = range > 0 ? Math.round(((val - cfg.min) / range) * 100) : 50;
    const valClass = val < 0 ? 'neg' : '';
    return `
      <div class="slider-row">
        <div class="slider-label">${cfg.label}</div>
        <input type="range" class="pts-slider" min="${cfg.min}" max="${cfg.max}" value="${val}"
          style="--pct:${pct}%"
          oninput="updateSlider(this,'${key}',${cfg.min},${cfg.max})"
          onchange="saveScoringModel('${key}',parseInt(this.value))"/>
        <div class="slider-val ${valClass}" id="sliderval-${key}">${val >= 0 ? '+' : ''}${val}</div>
      </div>`;
  }).join('');
}

function updateSlider(el, key, min, max) {
  const val = parseInt(el.value);
  const pct = Math.round(((val - min) / (max - min)) * 100);
  el.style.setProperty('--pct', pct + '%');
  const valEl = document.getElementById('sliderval-' + key);
  if (valEl) {
    valEl.textContent = (val >= 0 ? '+' : '') + val;
    valEl.className = 'slider-val' + (val < 0 ? ' neg' : '');
  }
}

function computePlayerPoints(s, model) {
  // batting
  let bat = 0;
  bat += (s.runs || 0) * model.run;
  bat += (s.fours || 0) * model.four;
  bat += (s.sixes || 0) * model.six;
  if ((s.outs || 0) > 0 && (s.runs || 0) === 0) bat += model.duck;
  if ((s.outs || 0) > 0 && (s.runs || 0) === 0 && (s.balls || 0) === 0) bat += model.goldenDuck; // extra penalty
  bat += (s.potm || 0) * model.potm;

  // bowling
  let bowl = 0;
  bowl += (s.wickets || 0) * model.wicket;
  // estimate conceded fours: we don't track these precisely per player, so skip fourConceded for now

  return { bat: Math.round(bat), bowl: Math.round(bowl), total: Math.round(bat + bowl) };
}

function renderPointsTable() {
  const el = document.getElementById('points-table');
  if (!el) return;
  const sport = S.sport || 'cricket';

  // Scoring sliders are cricket-only
  const slidersWrap = document.getElementById('scoring-sliders-wrap');
  if (slidersWrap) slidersWrap.style.display = sport === 'cricket' ? '' : 'none';

  if (sport === 'cricket') {
    const stats = computeCricketAllStats();
    const model = getScoringModel();
    if (!Object.keys(stats).length) { el.innerHTML = '<div class="alert info" style="font-size:12px;">Play cricket matches to build the points table.</div>'; return; }
    const rows = Object.entries(stats).map(([name, s]) => {
      const pts = computePlayerPoints(s, model);
      return { name, bat: pts.bat, bowl: pts.bowl, total: pts.total };
    }).sort((a, b) => b.total - a.total);
    el.innerHTML = rows.map((r, i) => {
      const rank = i+1, rankClass = rank===1?'rank-1':rank===2?'rank-2':rank===3?'rank-3':'';
      const totalClass = r.total>0?'positive':r.total<0?'negative':'zero';
      return `<div class="pts-row"><div class="pts-rank ${rankClass}">${rank}</div><div class="pts-name">${esc(r.name)}</div><div class="pts-breakdown">Bat:${r.bat>=0?'+':''}${r.bat} Bowl:${r.bowl>=0?'+':''}${r.bowl}</div><div class="pts-total ${totalClass}">${r.total>=0?'+':''}${r.total}</div></div>`;
    }).join('');

  } else if (sport === 'football') {
    const totals = {};
    S.history.filter(m=>m.sport==='football').forEach(m=>(m.footballPlayerStats||[]).forEach(ps=>{
      if(!ps.name) return;
      if(!totals[ps.name]) totals[ps.name]={goals:0,assists:0,yellow:0,red:0,fouls:0,matches:0};
      const t=totals[ps.name]; t.matches++; t.goals+=ps.goals||0; t.assists+=ps.assists||0; t.yellow+=ps.yellow||0; t.red+=ps.red||0; t.fouls+=ps.fouls||0;
    }));
    if(!Object.keys(totals).length){el.innerHTML='<div class="alert info" style="font-size:12px;">Complete football matches with a named squad to build the points table.</div>';return;}
    const rows = Object.entries(totals).map(([name,s])=>{
      const pts = s.goals*6 + s.assists*3 - s.yellow*2 - s.red*5 - s.fouls;
      return {name, pts, goals:s.goals, assists:s.assists, yellow:s.yellow, red:s.red};
    }).sort((a,b)=>b.pts-a.pts);
    el.innerHTML = `<div style="font-size:10px;color:var(--text3);margin-bottom:8px;">Goal=+6, Assist=+3, Yellow=-2, Red=-5, Foul=-1</div>` +
      rows.map((r,i)=>{
        const rank=i+1, rankClass=rank===1?'rank-1':rank===2?'rank-2':rank===3?'rank-3':'';
        const totalClass=r.pts>0?'positive':r.pts<0?'negative':'zero';
        return `<div class="pts-row"><div class="pts-rank ${rankClass}">${rank}</div><div class="pts-name">${esc(r.name)}</div><div class="pts-breakdown">${r.goals}G · ${r.assists}A · ${r.yellow}YC · ${r.red}RC</div><div class="pts-total ${totalClass}">${r.pts>=0?'+':''}${r.pts}</div></div>`;
      }).join('');

  } else if (sport === 'badminton') {
    const totals = {};
    S.history.filter(m=>m.sport==='badminton').forEach(m=>(m.badmintonPlayerStats||[]).forEach(ps=>{
      if(!ps.name) return;
      if(!totals[ps.name]) totals[ps.name]={matches:0,wins:0,losses:0,setsWon:0,setsLost:0};
      const t=totals[ps.name]; t.matches++; t.wins+=ps.wins||0; t.losses+=ps.losses||0; t.setsWon+=ps.setsWon||0; t.setsLost+=ps.setsLost||0;
    }));
    if(!Object.keys(totals).length){el.innerHTML='<div class="alert info" style="font-size:12px;">Play badminton matches to build the points table.</div>';return;}
    const rows = Object.entries(totals).map(([name,s])=>{
      const pts = s.wins*10 + s.setsWon*2 - s.losses*3;
      return {name, pts, wins:s.wins, losses:s.losses, setsWon:s.setsWon};
    }).sort((a,b)=>b.pts-a.pts);
    el.innerHTML = `<div style="font-size:10px;color:var(--text3);margin-bottom:8px;">Match Win=+10, Set Won=+2, Match Loss=-3</div>` +
      rows.map((r,i)=>{
        const rank=i+1, rankClass=rank===1?'rank-1':rank===2?'rank-2':rank===3?'rank-3':'';
        const totalClass=r.pts>0?'positive':r.pts<0?'negative':'zero';
        return `<div class="pts-row"><div class="pts-rank ${rankClass}">${rank}</div><div class="pts-name">${esc(r.name)}</div><div class="pts-breakdown">${r.wins}W · ${r.losses}L · ${r.setsWon} sets</div><div class="pts-total ${totalClass}">${r.pts>=0?'+':''}${r.pts}</div></div>`;
      }).join('');
  }
}

function showHistoryDetail(id) {
  const match = S.history.find(m => m.id === id);
  if (!match) return;
  document.getElementById('history-detail-content').innerHTML = `
    <h3><i class="ti ti-history"></i> Match Summary</h3>
    <div style="margin-top:12px;display:grid;gap:8px;font-size:13px;">
      <div><strong>Sport:</strong> ${match.sport}</div>
      <div><strong>Match:</strong> ${esc(match.title)}</div>
      <div><strong>Result:</strong> ${esc(match.result)}</div>
      <div><strong>Score:</strong> ${esc(match.detail || '—')}</div>
      <div><strong>Date:</strong> ${match.date}</div>
    </div>`;
  openModal('history-detail-modal');
}

function clearHistory() {
  if (!confirm('Clear all match history?')) return;
  S.history = [];
  save();
  renderHistory();
  renderPlayerStats();
  renderAchievements();
  renderH2H();
  renderCalendar();
  renderPointsTable();
  toast('History cleared.');
}

// ═══════════════════════════════════════════════════════
// GALLERY
// ═══════════════════════════════════════════════════════