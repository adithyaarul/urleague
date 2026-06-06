function showMatchSummary() {
  const inn1 = S.cricket.innings[0];
  const inn2 = S.cricket.innings[1];
  const stats = collectCricketMatchStats();

  const batFirst = S.cricket.tossChoice === 'bat' ? S.cricket.teamAName : S.cricket.teamBName;
  const chaseTeam = batFirst === S.cricket.teamAName ? S.cricket.teamBName : S.cricket.teamAName;

  // Determine winner/margin
  let winner, margin;
  if (inn2.runs > inn1.runs) {
    const wkts = (S.cricket.teamA.length) - inn2.wickets;
    winner = chaseTeam;
    margin = `Won by ${wkts} wicket${wkts !== 1 ? 's' : ''}`;
  } else if (inn2.runs === inn1.runs) {
    winner = 'Match Tied';
    margin = 'An incredible tie!';
  } else {
    const diff = inn1.runs - inn2.runs;
    winner = batFirst;
    margin = `Won by ${diff} run${diff !== 1 ? 's' : ''}`;
  }

  // Hero
  (function(){
      var el = document.getElementById('msummary-trophy');
      el.innerHTML = winner === 'Match Tied'
        ? '<i class="ti ti-handshake" style="color:#38bdf8;font-size:52px;filter:drop-shadow(0 0 20px rgba(56,189,248,.4));"></i>'
        : '<i class="ti ti-trophy" style="color:#ffd700;font-size:52px;filter:drop-shadow(0 0 20px rgba(255,215,0,.4));"></i>';
    })();
  document.getElementById('msummary-result-title').textContent = winner === 'Match Tied' ? 'Match Tied!' : `${winner} Win!`;
  document.getElementById('msummary-result-sub').textContent = margin;

  // Scores — highlight winner
  const inn1Team = batFirst, inn2Team = chaseTeam;
  const inn1Str = `${inn1.runs}/${inn1.wickets}`;
  const inn2Str = `${inn2.runs}/${inn2.wickets}`;
  document.getElementById('msummary-team-a-label').textContent = S.cricket.teamAName;
  document.getElementById('msummary-team-b-label').textContent = S.cricket.teamBName;
  const aRuns = document.getElementById('msummary-team-a-runs');
  const bRuns = document.getElementById('msummary-team-b-runs');
  aRuns.textContent = `${S.cricket.innings[0].runs}/${S.cricket.innings[0].wickets}`;
  bRuns.textContent = `${S.cricket.innings[1].runs}/${S.cricket.innings[1].wickets}`;
  aRuns.className = 'msummary-team-runs' + (winner === S.cricket.teamAName ? ' winner' : '');
  bRuns.className = 'msummary-team-runs' + (winner === S.cricket.teamBName ? ' winner' : '');

  // Innings bars
  const maxRuns = Math.max(inn1.runs, inn2.runs, 1);
  document.getElementById('msummary-inn-bars').innerHTML = `
    <div class="msummary-inn-bar-row">
      <div class="msummary-inn-bar-label">
        <span class="msummary-inn-bar-name">${esc(inn1Team)} — 1st Innings</span>
        <span class="msummary-inn-bar-val">${inn1.runs}/${inn1.wickets}</span>
      </div>
      <div class="msummary-inn-bar-track">
        <div class="msummary-inn-bar-fill" style="width:0%;background:linear-gradient(90deg,var(--sport-primary),color-mix(in srgb,var(--sport-primary) 60%,#000));" id="msummary-bar1"></div>
      </div>
    </div>
    <div class="msummary-inn-bar-row">
      <div class="msummary-inn-bar-label">
        <span class="msummary-inn-bar-name">${esc(inn2Team)} — 2nd Innings</span>
        <span class="msummary-inn-bar-val">${inn2.runs}/${inn2.wickets}</span>
      </div>
      <div class="msummary-inn-bar-track">
        <div class="msummary-inn-bar-fill" style="width:0%;background:linear-gradient(90deg,#f59e0b,#b45309);" id="msummary-bar2"></div>
      </div>
    </div>
  `;
  // Animate bars after render
  setTimeout(() => {
    const b1 = document.getElementById('msummary-bar1');
    const b2 = document.getElementById('msummary-bar2');
    if (b1) b1.style.width = `${(inn1.runs / maxRuns) * 100}%`;
    if (b2) b2.style.width = `${(inn2.runs / maxRuns) * 100}%`;
  }, 80);

  // Top performers
  const allPlayers = Object.entries(stats).map(([name, s]) => ({ name, ...s }));
  const topBat = [...allPlayers].sort((a, b) => (b.runs || 0) - (a.runs || 0))[0];
  const topBowl = [...allPlayers].sort((a, b) => (b.wickets || 0) - (a.wickets || 0))[0];
  let perfHtml = '';
  if (topBat) {
    const sr = topBat.balls > 0 ? ((topBat.runs / topBat.balls) * 100).toFixed(0) : '—';
    perfHtml += `
      <div class="msummary-performer">
        <div class="msummary-performer-role"><i class="ti ti-cricket" style="color:#ef4444;font-size:11px;vertical-align:-1px;margin-right:3px;"></i>Top Batter</div>
        <div class="msummary-performer-name">${esc(topBat.name)}</div>
        <div class="msummary-performer-stat">${topBat.runs}</div>
        <div class="msummary-performer-detail">${topBat.balls} balls · SR ${sr}</div>
      </div>`;
  }
  if (topBowl && topBowl.wickets > 0) {
    const eco = topBowl.runsConceded > 0 && topBowl.balls > 0
      ? ((topBowl.runsConceded / topBowl.balls) * 6).toFixed(1) : '—';
    perfHtml += `
      <div class="msummary-performer">
        <div class="msummary-performer-role"><i class="ti ti-target" style="color:#f87171;font-size:11px;vertical-align:-1px;margin-right:3px;"></i>Top Bowler</div>
        <div class="msummary-performer-name">${esc(topBowl.name)}</div>
        <div class="msummary-performer-stat">${topBowl.wickets}W</div>
        <div class="msummary-performer-detail">${topBowl.runsConceded} runs · Eco ${eco}</div>
      </div>`;
  }
  // Top sixes
  const topSix = [...allPlayers].sort((a, b) => (b.sixes || 0) - (a.sixes || 0))[0];
  if (topSix && topSix.sixes > 0) {
    perfHtml += `
      <div class="msummary-performer">
        <div class="msummary-performer-role"><i class="ti ti-bolt" style="color:#fbbf24;font-size:11px;vertical-align:-1px;margin-right:3px;"></i>Most Sixes</div>
        <div class="msummary-performer-name">${esc(topSix.name)}</div>
        <div class="msummary-performer-stat">${topSix.sixes}×6</div>
        <div class="msummary-performer-detail">${topSix.fours || 0} fours too</div>
      </div>`;
  }
  // Highest over scorer
  document.getElementById('msummary-performers').innerHTML = perfHtml || '<div style="color:rgba(255,255,255,.4);font-size:12px;">No stats recorded.</div>';

  // Highlights — generate from ball log + player stats
  const highlights = buildMatchHighlights(inn1, inn2, stats, inn1Team, inn2Team);
  const hlEl = document.getElementById('msummary-highlights');
  if (highlights.length) {
    hlEl.innerHTML = highlights.map(h => `
      <div class="msummary-highlight">
        <div class="msummary-highlight-icon ${h.type}">${h.icon}</div>
        <div class="msummary-highlight-text">
          <div class="msummary-highlight-main">${h.main}</div>
          ${h.sub ? `<div class="msummary-highlight-sub">${h.sub}</div>` : ''}
        </div>
        ${h.badge ? `<div class="msummary-highlight-badge ${h.badgeColor}">${h.badge}</div>` : ''}
      </div>`).join('');
  } else {
    hlEl.innerHTML = '<div style="color:rgba(255,255,255,.4);font-size:12px;padding:4px 0;">No highlights logged.</div>';
  }

  // POTM strip
  let potmName = '', best = -1;
  Object.entries(stats).forEach(([name, s]) => {
    const sc = (s.runs || 0) + (s.wickets || 0) * 18 + (s.sixes || 0) * 2;
    if (sc > best) { best = sc; potmName = name; }
  });
  if (potmName) {
    const ps = stats[potmName];
    const lib = (S.library || []).find(p => p.name === potmName) || {};
    const avatarEl = document.getElementById('msummary-motm-avatar');
    if (lib.photo) {
      avatarEl.innerHTML = `<img src="${lib.photo}" alt="${esc(potmName)}"/>`;
    } else {
      avatarEl.textContent = potmName.charAt(0).toUpperCase();
    }
    document.getElementById('msummary-motm-name').textContent = potmName;
    const sr = ps.balls > 0 ? ` · SR ${((ps.runs / ps.balls) * 100).toFixed(0)}` : '';
    document.getElementById('msummary-motm-stats').textContent =
      `${ps.runs || 0} runs, ${ps.wickets || 0} wkts${sr}`;
  }

  // MOTS strip — show only when series is complete
  const motsData = getMOTSData();
  const motsStrip = document.getElementById('msummary-mots-strip');
  const motsBtn = document.getElementById('mots-action-btn');
  if (motsData) {
    motsStrip.classList.remove('hidden');
    if (motsBtn) motsBtn.style.display = '';
    document.getElementById('msummary-mots-name').textContent = motsData.name;
    document.getElementById('msummary-mots-stats').textContent =
      `${motsData.runs} runs · ${motsData.wickets} wkts · ${motsData.sixes} sixes — ${motsData.seriesLabel}`;
  } else {
    motsStrip.classList.add('hidden');
    if (motsBtn) motsBtn.style.display = 'none';
  }

  // Confetti
  spawnSummaryConfetti();

  document.getElementById('msummary-overlay').classList.add('visible');
}

function buildMatchHighlights(inn1, inn2, stats, inn1Team, inn2Team) {
  const hl = [];

  // Match result highlight
  const inn1T = S.cricket.teamAName === inn1Team ? 'teamA' : 'teamB';

  // Highest individual score
  let topRuns = 0, topScorer = '';
  Object.entries(stats).forEach(([n, s]) => {
    if ((s.runs || 0) > topRuns) { topRuns = s.runs; topScorer = n; }
  });
  if (topScorer && topRuns > 0) {
    const s = stats[topScorer];
    const sr = s.balls > 0 ? ` (SR ${((s.runs / s.balls) * 100).toFixed(0)})` : '';
    hl.push({ type:'milestone', icon:'<i class="ti ti-cricket" style="color:#ef4444"></i>', main:`${esc(topScorer)} top-scored`, sub:`${topRuns} runs off ${s.balls || 0} balls${sr}`, badge:`${topRuns}`, badgeColor:'green' });
  }

  // Sixes
  let totalSixes = 0;
  Object.values(stats).forEach(s => { totalSixes += s.sixes || 0; });
  if (totalSixes > 0) {
    const topSixer = Object.entries(stats).sort((a, b) => (b[1].sixes||0) - (a[1].sixes||0))[0];
    hl.push({ type:'six', icon:'<i class="ti ti-bolt" style="color:#fbbf24"></i>', main:`${totalSixes} sixes hit in this match`, sub:`${topSixer[0]} hit most with ${topSixer[1].sixes || 0}`, badge:`${totalSixes}×6`, badgeColor:'gold' });
  }

  // Fours
  let totalFours = 0;
  Object.values(stats).forEach(s => { totalFours += s.fours || 0; });
  if (totalFours > 0) {
    hl.push({ type:'four', icon:'<i class="ti ti-run" style="color:#38bdf8"></i>', main:`${totalFours} boundaries (fours) hit`, sub:`Across both innings`, badge:`${totalFours}×4`, badgeColor:'blue' });
  }

  // Best bowling
  let topWkts = 0, topBowler = '', topRC = 0;
  Object.entries(stats).forEach(([n, s]) => {
    if ((s.wickets || 0) > topWkts || ((s.wickets||0) === topWkts && (s.runsConceded||0) < topRC)) {
      topWkts = s.wickets; topBowler = n; topRC = s.runsConceded || 0;
    }
  });
  if (topBowler && topWkts > 0) {
    const label = topWkts >= 5 ? 'Five-fer!' : topWkts >= 3 ? 'Three-fer' : `${topWkts} wickets`;
    hl.push({ type:'wicket', icon:'<i class="ti ti-target" style="color:#f87171"></i>', main:`${esc(topBowler)} best bowler`, sub:`${topWkts}/${topRC} — ${label}`, badge:`${topWkts}W`, badgeColor:'red' });
  }

  // Centuries / fifties
  Object.entries(stats).forEach(([n, s]) => {
    if ((s.runs || 0) >= 100) hl.push({ type:'milestone', icon:'<i class="ti ti-circle-check" style="color:#4ade80"></i>', main:`${esc(n)} scored a century!`, sub:`${s.runs} runs — incredible knock`, badge:'100+', badgeColor:'gold' });
    else if ((s.runs || 0) >= 50) hl.push({ type:'milestone', icon:'5️⃣0', main:`${esc(n)} reached a half-century`, sub:`${s.runs} runs`, badge:'50+', badgeColor:'green' });
  });

  // Close match
  const diff = Math.abs(inn1.runs - inn2.runs);
  if (diff <= 5 && diff > 0) {
    hl.push({ type:'match', icon:'<i class="ti ti-heartbeat" style="color:#f87171"></i>', main:`Nail-biting finish — ${diff} run${diff !== 1 ? 's' : ''} margin`, sub:'Could have gone either way!', badge:null });
  } else if (inn1.runs === inn2.runs) {
    hl.push({ type:'match', icon:'<i class="ti ti-handshake" style="color:#38bdf8"></i>', main:'Incredibly rare tie!', sub:'Scores level at the end', badge:null });
  }

  // Dot ball pressure — high wickets
  if (inn2.wickets >= (S.cricket.teamA.length - 2)) {
    hl.push({ type:'wicket', icon:'<i class="ti ti-skull" style="color:#f87171"></i>', main:`${inn2Team} bowling dominance`, sub:`${inn2.wickets} wickets taken in 2nd innings`, badge:`${inn2.wickets}W`, badgeColor:'red' });
  }

  // Run rate
  const inn1Overs = inn1.balls > 0 ? (inn1.balls / 6).toFixed(1) : S.cricket.overs;
  const rr1 = inn1.balls > 0 ? ((inn1.runs / inn1.balls) * 6).toFixed(2) : '—';
  if (inn1.runs > 0 && parseFloat(rr1) >= 10) {
    hl.push({ type:'milestone', icon:'<i class="ti ti-rocket" style="color:#fbbf24"></i>', main:`Explosive 1st innings run rate`, sub:`${rr1} runs per over`, badge:`${rr1} RR`, badgeColor:'gold' });
  }

  return hl.slice(0, 8); // cap at 8 highlights
}

function spawnSummaryConfetti() {
  const container = document.getElementById('msummary-confetti');
  container.innerHTML = '';
  const colors = ['#ffd700','#38bdf8','#4ade80','#f87171','#a78bfa','#fb923c'];
  for (let i = 0; i < 22; i++) {
    const p = document.createElement('div');
    p.className = 'msummary-confetti-piece';
    const color = colors[Math.floor(Math.random() * colors.length)];
    p.style.cssText = `
      left:${Math.random() * 100}%;
      top:${-10 + Math.random() * 20}px;
      background:${color};
      width:${5 + Math.random() * 5}px;
      height:${8 + Math.random() * 8}px;
      transform:rotate(${Math.random() * 360}deg);
      animation-duration:${2 + Math.random() * 2.5}s;
      animation-delay:${Math.random() * 1.5}s;
    `;
    container.appendChild(p);
  }
}

function closeSummary(e) {
  if (e && e.target !== document.getElementById('msummary-overlay')) return;
  document.getElementById('msummary-overlay').classList.remove('visible');
}

function openMOTMFromSummary() {
  document.getElementById('msummary-overlay').classList.remove('visible');
  setTimeout(showMOTMCard, 200);
}

// ═══════════════════════════════════════════════════════
// MOTM CARD
// ═══════════════════════════════════════════════════════
function showMOTMCard() {
  const stats = collectCricketMatchStats();
  let potmName = '', best = -1;
  Object.entries(stats).forEach(([name, s]) => {
    const score = (s.runs || 0) + (s.wickets || 0) * 18 + (s.sixes || 0) * 2;
    if (score > best) { best = score; potmName = name; }
  });
  if (!potmName) { toast('No player stats yet.'); return; }

  const s = stats[potmName];
  const libPlayer = (S.library || []).find(p => p.name === potmName) || {};
  const inA = (S.cricket.teamA || []).includes(potmName);
  const teamName = inA ? S.cricket.teamAName : S.cricket.teamBName;

  const runs = s.runs || 0;
  const balls = s.balls || 0;
  const wickets = s.wickets || 0;
  const fours = s.fours || 0;
  const sixes = s.sixes || 0;
  const sr = balls > 0 ? ((runs / balls) * 100).toFixed(0) : '—';
  const batContrib = runs;
  const bowlContrib = wickets * 18;
  const total = batContrib + bowlContrib || 1;
  const batPct = Math.round((batContrib / total) * 100);
  const bowlPct = 100 - batPct;

  const avatarEl = document.getElementById('motm-avatar');
  if (libPlayer.photo) {
    avatarEl.innerHTML = `<img src="${libPlayer.photo}" alt="${esc(potmName)}" style="width:100%;height:100%;object-fit:cover;"/>`;
  } else {
    avatarEl.innerHTML = `<div class="motm-hero-avatar-initial">${esc(potmName.charAt(0).toUpperCase())}</div>`;
  }

  document.getElementById('motm-name').textContent = potmName;
  document.getElementById('motm-team-name').textContent = teamName || 'Arena';
  document.getElementById('motm-team-initial').textContent = (teamName || 'A').charAt(0).toUpperCase();
  document.getElementById('motm-score-chip').textContent = `${runs} runs · ${wickets} wkt${wickets !== 1 ? 's' : ''}`;
  document.getElementById('motm-sr').textContent = sr;
  document.getElementById('motm-bat-pct').textContent = `${batPct}%`;
  document.getElementById('motm-bowl-pct').textContent = `${bowlPct}%`;
  document.getElementById('motm-match-date').textContent = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });

  const srColor = parseFloat(sr) >= 200 ? 'gold' : parseFloat(sr) >= 150 ? 'green' : parseFloat(sr) >= 100 ? '' : 'red';
  document.getElementById('motm-stats-grid').innerHTML = `
    <div class="motm-stat"><div class="motm-stat-val green">${runs}</div><div class="motm-stat-lbl">Runs</div></div>
    <div class="motm-stat"><div class="motm-stat-val gold">${wickets}</div><div class="motm-stat-lbl">Wickets</div></div>
    <div class="motm-stat"><div class="motm-stat-val">${balls}</div><div class="motm-stat-lbl">Balls</div></div>
    <div class="motm-stat"><div class="motm-stat-val green">${fours}</div><div class="motm-stat-lbl">Fours</div></div>
    <div class="motm-stat"><div class="motm-stat-val gold">${sixes}</div><div class="motm-stat-lbl">Sixes</div></div>
    <div class="motm-stat"><div class="motm-stat-val ${srColor}">${sr}</div><div class="motm-stat-lbl">Strike Rate</div></div>
  `;

  spawnMOTMParticles();
  document.getElementById('motm-overlay').classList.add('visible');
}

function spawnMOTMParticles() {
  const container = document.getElementById('motm-particles');
  container.innerHTML = '';
  const icons = ['ti-star-filled','ti-sparkles','ti-stars','ti-sun','ti-cricket'];
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('div');
    p.className = 'motm-particle';
    p.style.cssText = `left:${Math.random()*95}%;width:${12+Math.random()*14}px;height:${12+Math.random()*14}px;animation-duration:${3+Math.random()*3}s;animation-delay:${Math.random()*2.5}s;font-size:${12+Math.random()*10}px;display:flex;align-items:center;justify-content:center;`;
    var ic = icons[Math.floor(Math.random() * icons.length)];
    p.innerHTML = '<i class="ti ' + ic + '" style="color:#ffd700;"></i>';
    container.appendChild(p);
  }
}

function closeMOTM() {
  document.getElementById('motm-overlay').classList.remove('visible');
}

function downloadMOTMCard() {
  toast('Generating card...');

  // ── Gather all data from current MOTM state ──
  const name      = document.getElementById('motm-name').textContent || '—';
  const teamName  = document.getElementById('motm-team-name').textContent || '';
  const teamInit  = document.getElementById('motm-team-initial').textContent || '';
  const scoreChip = document.getElementById('motm-score-chip').textContent || '';
  const srVal     = document.getElementById('motm-sr').textContent || '—';
  const batPct    = document.getElementById('motm-bat-pct').textContent || '—';
  const bowlPct   = document.getElementById('motm-bowl-pct').textContent || '—';
  const dateVal   = document.getElementById('motm-match-date').textContent || '';

  // Parse stat grid cells
  const statCells = document.querySelectorAll('#motm-stats-grid .motm-stat');
  const stats = Array.from(statCells).map(c => ({
    val:   c.querySelector('.motm-stat-val')?.textContent || '—',
    lbl:   c.querySelector('.motm-stat-lbl')?.textContent || '',
    color: c.querySelector('.motm-stat-val')?.classList.contains('gold') ? '#ffd700'
         : c.querySelector('.motm-stat-val')?.classList.contains('green') ? '#4ade80'
         : c.querySelector('.motm-stat-val')?.classList.contains('red')   ? '#f87171'
         : '#ffffff'
  }));

  // Get photo if any
  const avatarImg = document.querySelector('#motm-avatar img');
  const photoSrc  = avatarImg ? avatarImg.src : null;

  function drawCard(photoImg) {
    const W = 420, H = 620;
    const DPR = 3;
    const c = document.createElement('canvas');
    c.width  = W * DPR;
    c.height = H * DPR;
    const ctx = c.getContext('2d');
    ctx.scale(DPR, DPR);

    // ── helpers ──
    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    // ── Card background ──
    roundRect(0, 0, W, H, 24);
    ctx.clip();

    // Dark base
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#0a0e1a');
    bgGrad.addColorStop(1, '#060810');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Gold border
    roundRect(0, 0, W, H, 24);
    ctx.strokeStyle = 'rgba(255,215,0,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ── Hero zone (top 240px) ──
    const heroH = 240;
    const heroGrad = ctx.createLinearGradient(0, 0, W, heroH);
    heroGrad.addColorStop(0, '#0d1117');
    heroGrad.addColorStop(0.5, '#1a1f35');
    heroGrad.addColorStop(1, '#0d1117');
    ctx.fillStyle = heroGrad;
    ctx.fillRect(0, 0, W, heroH);

    // subtle radial glows in hero
    const g1 = ctx.createRadialGradient(W * 0.2, heroH * 0.3, 0, W * 0.2, heroH * 0.3, 120);
    g1.addColorStop(0, 'rgba(255,200,50,0.09)');
    g1.addColorStop(1, 'transparent');
    ctx.fillStyle = g1; ctx.fillRect(0, 0, W, heroH);
    const g2 = ctx.createRadialGradient(W * 0.8, heroH * 0.7, 0, W * 0.8, heroH * 0.7, 110);
    g2.addColorStop(0, 'rgba(255,150,0,0.07)');
    g2.addColorStop(1, 'transparent');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, heroH);

    // ── Player photo or initial ──
    const avW = 160, avH = 160;
    const avX = (W - avW) / 2, avY = heroH - avH;

    ctx.save();
    // Clip to avatar rounded-top rect
    ctx.beginPath();
    const r = 20;
    ctx.moveTo(avX + r, avY);
    ctx.lineTo(avX + avW - r, avY);
    ctx.quadraticCurveTo(avX + avW, avY, avX + avW, avY + r);
    ctx.lineTo(avX + avW, avY + avH);
    ctx.lineTo(avX, avY + avH);
    ctx.lineTo(avX, avY + r);
    ctx.quadraticCurveTo(avX, avY, avX + r, avY);
    ctx.closePath();
    ctx.clip();

    if (photoImg) {
      // Draw photo — cover-fit
      const iw = photoImg.naturalWidth  || photoImg.width;
      const ih = photoImg.naturalHeight || photoImg.height;
      const scale = Math.max(avW / iw, avH / ih);
      const dw = iw * scale, dh = ih * scale;
      const dx = avX + (avW - dw) / 2;
      const dy = avY + (avH - dh) / 2;
      ctx.drawImage(photoImg, dx, dy, dw, dh);
    } else {
      // Initial letter
      const initGrad = ctx.createLinearGradient(avX, avY, avX + avW, avY + avH);
      initGrad.addColorStop(0, '#1e2d4d');
      initGrad.addColorStop(1, '#2d3f6d');
      ctx.fillStyle = initGrad;
      ctx.fillRect(avX, avY, avW, avH);
      ctx.fillStyle = 'rgba(255,215,0,0.75)';
      ctx.font = '900 72px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name.charAt(0).toUpperCase(), avX + avW / 2, avY + avH / 2);
    }
    ctx.restore();

    // Avatar gold border (top sides only)
    ctx.save();
    ctx.beginPath();
    const br = 20;
    ctx.moveTo(avX + br, avY);
    ctx.lineTo(avX + avW - br, avY);
    ctx.quadraticCurveTo(avX + avW, avY, avX + avW, avY + br);
    ctx.lineTo(avX + avW, avY + avH);
    ctx.moveTo(avX, avY + avH);
    ctx.lineTo(avX, avY + br);
    ctx.quadraticCurveTo(avX, avY, avX + br, avY);
    ctx.strokeStyle = 'rgba(255,215,0,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // ── PLAYER OF THE MATCH badge ──
    const badgeTxt = '★  PLAYER OF THE MATCH';
    ctx.font = '900 11px "Barlow Condensed", sans-serif';
    const badgeW = ctx.measureText(badgeTxt).width + 36;
    const badgeX = (W - badgeW) / 2, badgeY = 14;
    const badgeGrad = ctx.createLinearGradient(badgeX, 0, badgeX + badgeW, 0);
    badgeGrad.addColorStop(0, '#b8860b');
    badgeGrad.addColorStop(0.5, '#ffd700');
    badgeGrad.addColorStop(1, '#b8860b');
    roundRect(badgeX, badgeY, badgeW, 26, 13);
    ctx.fillStyle = badgeGrad;
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = '900 11px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeTxt, W / 2, badgeY + 13);

    // ── Score chip (bottom of hero) ──
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(0, heroH - 36, W, 36);
    ctx.strokeStyle = 'rgba(255,215,0,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, heroH - 36); ctx.lineTo(W, heroH - 36); ctx.stroke();
    ctx.fillStyle = '#ffd700';
    ctx.font = '900 20px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255,215,0,0.5)';
    ctx.shadowBlur = 12;
    ctx.fillText(scoreChip, W / 2, heroH - 18);
    ctx.shadowBlur = 0;

    // ── Info section ──
    let y = heroH;
    const infoGrad = ctx.createLinearGradient(0, y, 0, y + 80);
    infoGrad.addColorStop(0, '#0d1117');
    infoGrad.addColorStop(1, '#0a0e1a');
    ctx.fillStyle = infoGrad;
    ctx.fillRect(0, y, W, 80);

    // Player name
    y += 18;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 32px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(name, 18, y);

    // Team row
    y += 38;
    // Team dot circle
    ctx.beginPath();
    ctx.arc(18 + 11, y + 11, 11, 0, Math.PI * 2);
    const dotGrad = ctx.createLinearGradient(7, y, 40, y + 22);
    dotGrad.addColorStop(0, '#ffd700');
    dotGrad.addColorStop(1, '#b8860b');
    ctx.fillStyle = dotGrad;
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = '900 10px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(teamInit, 18 + 11, y + 11);
    // Team name
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '700 13px "DM Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(teamName.toUpperCase(), 18 + 28, y + 11);

    // ── Divider ──
    y += 30;
    const divGrad = ctx.createLinearGradient(18, 0, W - 18, 0);
    divGrad.addColorStop(0, 'transparent');
    divGrad.addColorStop(0.5, 'rgba(255,215,0,0.28)');
    divGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = divGrad;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(18, y); ctx.lineTo(W - 18, y); ctx.stroke();

    // ── Stats grid (3 cols × 2 rows if 6 stats) ──
    y += 14;
    const cols = 3;
    const cellW = (W - 36) / cols;
    const cellH = 48;
    const rows  = Math.ceil(stats.length / cols);

    // Grid background
    roundRect(18, y, W - 36, cellH * rows, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();

    stats.forEach((st, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const sx = 18 + col * cellW, sy = y + row * cellH;
      // Cell bg
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(sx + 1, sy + 1, cellW - 2, cellH - 2);
      // Value
      ctx.fillStyle = st.color;
      ctx.font = '900 22px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(st.val, sx + cellW / 2, sy + 8);
      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.38)';
      ctx.font = '700 8px "DM Sans", sans-serif';
      ctx.fillText(st.lbl.toUpperCase(), sx + cellW / 2, sy + 32);
    });

    // ── Earnings row (SR + contribution) ──
    y += cellH * rows + 12;
    const erH = 48;
    roundRect(18, y, W - 36, erH, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Divider line in middle
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(18 + (W - 36) / 2, y + 8);
    ctx.lineTo(18 + (W - 36) / 2, y + erH - 8);
    ctx.stroke();

    const halfW = (W - 36) / 2;
    // SR
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.font = '700 8px "DM Sans", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('STRIKE RATE', 18 + halfW / 2, y + 9);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 18px "Barlow Condensed", sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(srVal, 18 + halfW / 2, y + 22);

    // Contribution
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.font = '700 8px "DM Sans", sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('CONTRIBUTION', 18 + halfW + halfW / 2, y + 9);
    // Bat pct (green dot)
    ctx.beginPath(); ctx.arc(18 + halfW + halfW/2 - 28, y + 30, 5, 0, Math.PI*2);
    ctx.fillStyle = '#4ade80'; ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 16px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(batPct, 18 + halfW + halfW/2 - 20, y + 30);
    // Separator
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '700 14px "DM Sans", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('|', 18 + halfW + halfW/2 + 8, y + 30);
    // Bowl pct (purple dot)
    ctx.beginPath(); ctx.arc(18 + halfW + halfW/2 + 18, y + 30, 5, 0, Math.PI*2);
    ctx.fillStyle = '#a78bfa'; ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 16px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(bowlPct, 18 + halfW + halfW/2 + 26, y + 30);

    // ── Footer ──
    y += erH + 12;
    ctx.fillStyle = '#070a12';
    ctx.fillRect(0, y, W, H - y);
    ctx.strokeStyle = 'rgba(255,215,0,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '900 10px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('★  ARENA · MATCH HUB', 18, y + (H - y) / 2);

    // Date badge
    const dtW = ctx.measureText(dateVal).width + 22;
    const dtX = W - 18 - dtW, dtY = y + (H - y) / 2 - 10;
    roundRect(dtX, dtY, dtW, 20, 10);
    const dtGrad = ctx.createLinearGradient(dtX, 0, dtX + dtW, 0);
    dtGrad.addColorStop(0, 'rgba(255,215,0,0.15)');
    dtGrad.addColorStop(1, 'rgba(255,165,0,0.1)');
    ctx.fillStyle = dtGrad; ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,0,0.28)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#ffd700';
    ctx.font = '800 10px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(dateVal, dtX + dtW / 2, dtY + 10);

    // ── Save ──
    const link = document.createElement('a');
    link.download = `MOTM_${Date.now()}.png`;
    link.href = c.toDataURL('image/png');
    link.click();
    toast('Card saved!');
  }

  if (photoSrc) {
    const img = new Image();
    img.onload  = () => drawCard(img);
    img.onerror = ()  => drawCard(null);
    // If it's already a data-URL (base64) this works instantly;
    // for blob URLs it also works without CORS issues.
    img.crossOrigin = 'anonymous';
    img.src = photoSrc;
  } else {
    drawCard(null);
  }
}


// ═══════════════════════════════════════════════════════
// MAN OF THE SERIES (MOTS) CARD
// ═══════════════════════════════════════════════════════
function getMOTSData() {
  const series = S.cricket.seriesInfo || {};
  const majority = Math.ceil((series.total || 3) / 2);
  const seriesOver = (series.wins?.A || 0) >= majority || (series.wins?.B || 0) >= majority;
  if (!seriesOver || S.cricket.format !== 'series') return null;

  // Aggregate stats across all series history entries
  const seriesMatches = S.history.filter(m =>
    m.sport === 'cricket' && m.seriesType === 'series' &&
    m.teamA === S.cricket.teamAName && m.teamB === S.cricket.teamBName
  ).slice(0, series.total || 3);

  const agg = {};
  seriesMatches.forEach(m => {
    Object.entries(m.cricketStats || {}).forEach(([n, s]) => {
      if (!agg[n]) agg[n] = { runs:0, balls:0, wickets:0, fours:0, sixes:0, runsConceded:0, matches:0 };
      agg[n].runs        += s.runs || 0;
      agg[n].balls       += s.balls || 0;
      agg[n].wickets     += s.wickets || 0;
      agg[n].fours       += s.fours || 0;
      agg[n].sixes       += s.sixes || 0;
      agg[n].runsConceded+= s.runsConceded || 0;
      agg[n].matches     += 1;
    });
  });

  // Also include current match stats if not in history yet
  const currentStats = collectCricketMatchStats();
  Object.entries(currentStats).forEach(([n, s]) => {
    if (!agg[n]) agg[n] = { runs:0, balls:0, wickets:0, fours:0, sixes:0, runsConceded:0, matches:0 };
    // Only add if not already counted (avoid double-counting if saved)
    const alreadyCounted = seriesMatches.some(m => m.cricketStats && m.cricketStats[n]);
    if (!alreadyCounted) {
      agg[n].runs         += s.runs || 0;
      agg[n].balls        += s.balls || 0;
      agg[n].wickets      += s.wickets || 0;
      agg[n].fours        += s.fours || 0;
      agg[n].sixes        += s.sixes || 0;
      agg[n].runsConceded += s.runsConceded || 0;
      agg[n].matches      += 1;
    }
  });

  let bestName = '', bestScore = -1;
  Object.entries(agg).forEach(([n, s]) => {
    const sc = (s.runs||0) + (s.wickets||0)*18 + (s.sixes||0)*2;
    if (sc > bestScore) { bestScore = sc; bestName = n; }
  });

  if (!bestName) return null;
  const s = agg[bestName];
  const inA = (S.cricket.teamA||[]).includes(bestName);
  const teamName = inA ? S.cricket.teamAName : S.cricket.teamBName;
  const seriesWinner = (series.wins?.A||0) >= majority ? S.cricket.teamAName : S.cricket.teamBName;

  return {
    name: bestName, teamName, teamInit: (teamName||'A').charAt(0).toUpperCase(),
    runs: s.runs||0, balls: s.balls||0, wickets: s.wickets||0,
    fours: s.fours||0, sixes: s.sixes||0, runsConceded: s.runsConceded||0,
    matches: s.matches||1,
    sr: s.balls > 0 ? ((s.runs/s.balls)*100).toFixed(0) : '—',
    eco: s.balls > 0 ? ((s.runsConceded/s.balls)*6).toFixed(1) : '—',
    seriesWinner,
    seriesLabel: `${series.total||3}-Match Series`,
    winsA: series.wins?.A||0, winsB: series.wins?.B||0,
    teamAName: S.cricket.teamAName, teamBName: S.cricket.teamBName,
    photo: ((S.library||[]).find(p=>p.name===bestName)||{}).photo || null,
  };
}

function openMOTSCard() {
  document.getElementById('msummary-overlay').classList.remove('visible');
  setTimeout(showMOTSCard, 200);
}

function showMOTSCard() {
  const d = getMOTSData();
  if (!d) { toast('Series not complete yet.'); return; }

  // Avatar
  const avatarEl = document.getElementById('mots-avatar');
  if (d.photo) {
    avatarEl.innerHTML = `<img src="${d.photo}" alt="${esc(d.name)}" style="width:100%;height:100%;object-fit:cover;"/>`;
  } else {
    avatarEl.innerHTML = esc(d.name.charAt(0).toUpperCase());
  }

  document.getElementById('mots-name').textContent = d.name;
  document.getElementById('mots-team-name').textContent = d.teamName;
  document.getElementById('mots-team-initial').textContent = d.teamInit;
  document.getElementById('mots-mvp-chip').textContent = `${d.runs} runs · ${d.wickets} wkt${d.wickets!==1?'s':''}  ·  ${d.sixes} sixes`;
  document.getElementById('mots-matches').textContent = d.matches;
  document.getElementById('mots-sr').textContent = d.sr;
  document.getElementById('mots-economy').textContent = d.eco;
  document.getElementById('mots-series-label').innerHTML = `<span></span>${esc(d.seriesLabel)} · ${esc(d.seriesWinner)} won ${d.winsA}-${d.winsB}<span></span>`;
  document.getElementById('mots-series-info').textContent = d.seriesLabel;
  document.getElementById('mots-match-date') && (document.getElementById('mots-match-date').textContent = new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}));

  const srC = parseFloat(d.sr)>=150?'gold':parseFloat(d.sr)>=100?'purple':'amber';
  document.getElementById('mots-stats-grid').innerHTML = `
    <div class="mots-stat"><div class="mots-stat-val purple">${d.runs}</div><div class="mots-stat-lbl">Runs</div></div>
    <div class="mots-stat"><div class="mots-stat-val gold">${d.wickets}</div><div class="mots-stat-lbl">Wickets</div></div>
    <div class="mots-stat"><div class="mots-stat-val amber">${d.sixes}</div><div class="mots-stat-lbl">Sixes</div></div>
    <div class="mots-stat"><div class="mots-stat-val purple">${d.fours}</div><div class="mots-stat-lbl">Fours</div></div>
    <div class="mots-stat"><div class="mots-stat-val ${srC}">${d.sr}</div><div class="mots-stat-lbl">Strike Rate</div></div>
    <div class="mots-stat"><div class="mots-stat-val amber">${d.matches}</div><div class="mots-stat-lbl">Matches</div></div>
  `;

  spawnMOTSParticles();
  document.getElementById('mots-overlay').classList.add('visible');
}

function spawnMOTSParticles() {
  const c = document.getElementById('mots-particles');
  c.innerHTML = '';
  const icons = ['ti-crown','ti-star-filled','ti-sparkles','ti-trophy','ti-medal','ti-diamond'];
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'mots-particle';
    const size = 10 + Math.random()*16;
    const col = Math.random() > 0.5 ? '#c4b5fd' : '#fde68a';
    p.style.cssText = `left:${Math.random()*96}%;width:${size}px;height:${size}px;animation-duration:${3.5+Math.random()*4}s;animation-delay:${Math.random()*3}s;font-size:${size}px;display:flex;align-items:center;justify-content:center;color:${col};`;
    p.innerHTML = `<i class="ti ${icons[Math.floor(Math.random()*icons.length)]}"></i>`;
    c.appendChild(p);
  }
}

function closeMOTS() {
  document.getElementById('mots-overlay').classList.remove('visible');
}

function downloadMOTSCard() {
  const d = getMOTSData();
  if (!d) { toast('No series data.'); return; }
  toast('Generating MOTS card...');

  const photoSrc = d.photo;

  function drawCard(photoImg) {
    const W = 420, H = 680, DPR = 3;
    const c = document.createElement('canvas');
    c.width = W*DPR; c.height = H*DPR;
    const ctx = c.getContext('2d');
    ctx.scale(DPR, DPR);

    function rr(x,y,w,h,r){
      ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);
      ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);
      ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);
      ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);
      ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
    }

    // Clip to card shape
    rr(0,0,W,H,26); ctx.clip();

    // Background
    const bg = ctx.createLinearGradient(0,0,W,H);
    bg.addColorStop(0,'#080012');bg.addColorStop(.4,'#0d0820');bg.addColorStop(1,'#100610');
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

    // Nebula glows
    [[.15,.2,'rgba(124,58,237,.4)',160],[.85,.8,'rgba(245,158,11,.22)',130],[.5,.05,'rgba(167,139,250,.2)',120]].forEach(([cx,cy,col,r])=>{
      const g=ctx.createRadialGradient(W*cx,H*cy,0,W*cx,H*cy,r);
      g.addColorStop(0,col); g.addColorStop(1,'transparent');
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    });

    // Border — conic-like gradient (simulate with 4 strokes)
    const borderCols=['#7c3aed','#f59e0b','#a78bfa','#7c3aed'];
    borderCols.forEach((col,i)=>{
      rr(0,0,W,H,26); ctx.strokeStyle=col; ctx.lineWidth=2; ctx.globalAlpha=.4+i*.05; ctx.stroke(); ctx.globalAlpha=1;
    });
    ctx.globalAlpha=1;

    // ── Hero zone ──
    const heroH = 290;
    // Avatar circle
    const avR = 72, avCX = W/2, avCY = heroH - avR - 24;
    // Glow rings
    [['rgba(139,92,246,.35)',avR+28],['rgba(245,158,11,.18)',avR+16]].forEach(([col,r])=>{
      ctx.beginPath(); ctx.arc(avCX,avCY,r,0,Math.PI*2);
      ctx.strokeStyle=col; ctx.lineWidth=2; ctx.stroke();
    });
    // Avatar clip
    ctx.save();
    ctx.beginPath(); ctx.arc(avCX,avCY,avR,0,Math.PI*2); ctx.clip();
    if (photoImg) {
      const iw=photoImg.naturalWidth||photoImg.width, ih=photoImg.naturalHeight||photoImg.height;
      const sc=Math.max(avR*2/iw,avR*2/ih);
      ctx.drawImage(photoImg,avCX-iw*sc/2,avCY-ih*sc/2,iw*sc,ih*sc);
    } else {
      const ig=ctx.createLinearGradient(avCX-avR,avCY-avR,avCX+avR,avCY+avR);
      ig.addColorStop(0,'#2d1b5e'); ig.addColorStop(1,'#1a0e3a');
      ctx.fillStyle=ig; ctx.fillRect(avCX-avR,avCY-avR,avR*2,avR*2);
      ctx.fillStyle='rgba(196,181,253,.85)';
      ctx.font=`900 ${avR}px "Barlow Condensed",sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(d.name.charAt(0).toUpperCase(),avCX,avCY+4);
    }
    ctx.restore();
    // Avatar border ring
    ctx.beginPath(); ctx.arc(avCX,avCY,avR,0,Math.PI*2);
    const ring=ctx.createLinearGradient(avCX-avR,avCY-avR,avCX+avR,avCY+avR);
    ring.addColorStop(0,'#7c3aed'); ring.addColorStop(.5,'#f59e0b'); ring.addColorStop(1,'#a78bfa');
    ctx.strokeStyle=ring; ctx.lineWidth=3; ctx.stroke();

    // Crown badge at top
    const badgeTxt='👑  MAN OF THE SERIES  👑';
    ctx.font='900 11px "Barlow Condensed",sans-serif';
    const bw=ctx.measureText(badgeTxt).width+36, bx=(W-bw)/2, by=18;
    rr(bx,by,bw,26,13);
    const bg2=ctx.createLinearGradient(bx,0,bx+bw,0);
    bg2.addColorStop(0,'#4c1d95'); bg2.addColorStop(.5,'#7c3aed'); bg2.addColorStop(1,'#4c1d95');
    ctx.fillStyle=bg2; ctx.fill();
    ctx.strokeStyle='rgba(196,181,253,.5)'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#c4b5fd';
    ctx.font='900 11px "Barlow Condensed",sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(badgeTxt,W/2,by+13);

    // Stars row
    const stars='★★★★★', starY=heroH-14;
    ctx.font='16px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#fde68a';
    ctx.shadowColor='rgba(253,230,138,.6)'; ctx.shadowBlur=10;
    ctx.fillText(stars,W/2,starY);
    ctx.shadowBlur=0;

    // MVP chip bar under hero
    ctx.fillStyle='rgba(0,0,0,.75)';
    ctx.fillRect(0,heroH-38,W,38);
    ctx.strokeStyle='rgba(139,92,246,.3)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,heroH-38); ctx.lineTo(W,heroH-38); ctx.stroke();
    ctx.fillStyle='#c4b5fd';
    ctx.font='900 17px "Barlow Condensed",sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.shadowColor='rgba(196,181,253,.5)'; ctx.shadowBlur=12;
    ctx.fillText(`${d.runs} runs  ·  ${d.wickets} wkts  ·  ${d.sixes} sixes`,W/2,heroH-19);
    ctx.shadowBlur=0;

    // ── Name + team ──
    let y=heroH+18;
    ctx.fillStyle='#ffffff';
    ctx.font='900 34px "Barlow Condensed",sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.shadowColor='rgba(196,181,253,.35)'; ctx.shadowBlur=20;
    ctx.fillText(d.name,W/2,y); ctx.shadowBlur=0;
    y+=40;
    // Team pill
    const tPill=d.teamName.toUpperCase(), tW2=ctx.measureText(tPill).width+36;
    ctx.font='800 11px "Barlow Condensed",sans-serif';
    const tw=ctx.measureText(tPill).width+36, tx=(W-tw)/2;
    rr(tx,y,tw,22,11);
    ctx.fillStyle='rgba(139,92,246,.22)'; ctx.fill();
    ctx.strokeStyle='rgba(139,92,246,.4)'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#c4b5fd'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(tPill,W/2,y+11);
    y+=34;

    // Divider
    const div=ctx.createLinearGradient(18,0,W-18,0);
    div.addColorStop(0,'transparent');div.addColorStop(.3,'rgba(139,92,246,.5)');
    div.addColorStop(.7,'rgba(245,158,11,.35)');div.addColorStop(1,'transparent');
    ctx.strokeStyle=div; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(18,y); ctx.lineTo(W-18,y); ctx.stroke();
    y+=16;

    // Series label
    const sl=`${d.seriesLabel}  ·  ${d.seriesWinner} won ${d.winsA}-${d.winsB}`;
    ctx.font='700 10px "DM Sans",sans-serif';
    ctx.fillStyle='rgba(196,181,253,.5)'; ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText(sl.toUpperCase(),W/2,y); y+=22;

    // Stats grid 3x2
    const cols=3, cellW=(W-36)/cols, cellH=52, rows=2;
    const statsD=[
      {v:d.runs,l:'RUNS',col:'#c4b5fd'},{v:d.wickets,l:'WICKETS',col:'#fde68a'},{v:d.sixes,l:'SIXES',col:'#fb923c'},
      {v:d.fours,l:'FOURS',col:'#c4b5fd'},{v:d.sr,l:'STRIKE RATE',col:'#fde68a'},{v:d.matches,l:'MATCHES',col:'#c4b5fd'},
    ];
    rr(18,y,W-36,cellH*rows,14);
    ctx.fillStyle='rgba(139,92,246,.08)'; ctx.fill();
    ctx.strokeStyle='rgba(139,92,246,.2)'; ctx.lineWidth=1; ctx.stroke();
    statsD.forEach((st,i)=>{
      const col=i%cols, row=Math.floor(i/cols);
      const sx=18+col*cellW, sy=y+row*cellH;
      ctx.fillStyle='rgba(0,0,0,.2)'; ctx.fillRect(sx+1,sy+1,cellW-2,cellH-2);
      ctx.fillStyle=st.col;
      ctx.font='900 24px "Barlow Condensed",sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.shadowColor=st.col+'88'; ctx.shadowBlur=8;
      ctx.fillText(String(st.v),sx+cellW/2,sy+8); ctx.shadowBlur=0;
      ctx.fillStyle='rgba(196,181,253,.38)';
      ctx.font='700 8px "DM Sans",sans-serif';
      ctx.fillText(st.l,sx+cellW/2,sy+36);
    });
    y+=cellH*rows+14;

    // Record row: Matches / SR / Eco
    const recCols=[{v:String(d.matches),l:'MATCHES',col:'#c4b5fd'},{v:d.sr,l:'STRIKE RATE',col:'#fde68a'},{v:d.eco,l:'ECONOMY',col:'#fb923c'}];
    const recW=(W-36)/3;
    rr(18,y,W-36,46,12);
    ctx.fillStyle='rgba(139,92,246,.08)'; ctx.fill();
    ctx.strokeStyle='rgba(139,92,246,.2)'; ctx.lineWidth=1; ctx.stroke();
    recCols.forEach((r2,i)=>{
      const sx=18+i*recW;
      if(i>0){ctx.strokeStyle='rgba(139,92,246,.15)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(sx,y+8);ctx.lineTo(sx,y+38);ctx.stroke();}
      ctx.fillStyle=r2.col; ctx.font='900 20px "Barlow Condensed",sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillText(r2.v,sx+recW/2,y+7);
      ctx.fillStyle='rgba(196,181,253,.38)'; ctx.font='700 8px "DM Sans",sans-serif';
      ctx.fillText(r2.l,sx+recW/2,y+31);
    });
    y+=58;

    // Footer
    ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(0,y,W,H-y);
    ctx.strokeStyle='rgba(139,92,246,.2)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
    ctx.fillStyle='rgba(196,181,253,.35)'; ctx.font='900 10px "Barlow Condensed",sans-serif';
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText('★  ARENA · MATCH HUB',18,y+(H-y)/2);
    const dt=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
    const dtW2=ctx.measureText(dt).width+22, dtX=W-18-dtW2, dtY=y+(H-y)/2-10;
    rr(dtX,dtY,dtW2,20,10);
    const dtG=ctx.createLinearGradient(dtX,0,dtX+dtW2,0);
    dtG.addColorStop(0,'rgba(139,92,246,.2)'); dtG.addColorStop(1,'rgba(245,158,11,.15)');
    ctx.fillStyle=dtG; ctx.fill();
    ctx.strokeStyle='rgba(139,92,246,.4)'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#c4b5fd'; ctx.font='800 10px "Barlow Condensed",sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(dt,dtX+dtW2/2,dtY+10);

    const link=document.createElement('a');
    link.download=`MOTS_${Date.now()}.png`; link.href=c.toDataURL('image/png'); link.click();
    toast('MOTS card saved!');
  }

  if (photoSrc) {
    const img=new Image(); img.crossOrigin='anonymous';
    img.onload=()=>drawCard(img); img.onerror=()=>drawCard(null); img.src=photoSrc;
  } else { drawCard(null); }
}

// ═══════════════════════════════════════════════════════════════
// ROOM SYSTEM — Private Multiplayer Rooms
// ═══════════════════════════════════════════════════════════════

// ── Config (user fills these in Settings → Room Setup) ──
// Safe localStorage wrapper — mobile browsers (Safari private, WebViews) can throw