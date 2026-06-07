// ─── Squad: name personalisation + share functions ───

function showSquadName() {
  const current = localStorage.getItem('arena_squad_name') || '';
  const name = prompt('What do you call your squad?', current);
  if (name !== null) {
    const trimmed = name.trim();
    localStorage.setItem('arena_squad_name', trimmed);
    updateGreeting();
    toast(trimmed ? `Squad set to "${trimmed}" 🎉` : 'Squad name cleared');
  }
}

function updateGreeting() {
  const el = document.getElementById('gw-greeting-text');
  if (!el) return;
  const squad = localStorage.getItem('arena_squad_name');
  const hour  = new Date().getHours();
  const time  = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  el.textContent = squad ? `${time}, ${squad} 👋` : `Hey, Squad 👋`;
}

// ── Gateway "Jump back in" recent sports ──
function renderGatewayRecent() {
  const section = document.getElementById('gateway-recent-section');
  const btns = document.getElementById('gateway-quick-btns');
  if (!section || !btns) return;

  // Find the last-played sport from history
  const sports = ['cricket','football','badminton','pickleball','chess'];
  const sportIcons = {cricket:'ti-cricket',football:'ti-ball-football',badminton:'ti-ping-pong',pickleball:'ti-tennis',chess:'ti-chess-knight'};
  const sportColors = {cricket:'var(--cricket-primary)',football:'var(--football-primary)',badminton:'var(--badminton-primary)',pickleball:'var(--pickleball-primary)',chess:'var(--chess-primary)'};
  const sportBg = {cricket:'var(--cricket-pl)',football:'var(--football-pl)',badminton:'var(--badminton-pl)',pickleball:'var(--pickleball-pl)',chess:'var(--chess-pl)'};

  // Get unique sports played recently (max 3)
  const seen = new Set();
  const recentSports = [];
  (S.history || []).forEach(m => {
    if (m.sport && sports.includes(m.sport) && !seen.has(m.sport)) {
      seen.add(m.sport);
      recentSports.push(m.sport);
    }
  });

  if (!recentSports.length) { section.style.display = 'none'; return; }
  section.style.display = '';

  btns.innerHTML = recentSports.slice(0,3).map(sp => `
    <button class="gateway-quick-btn" onclick="selectSport('${sp}')"
      style="color:${sportColors[sp]};background:${sportBg[sp]};border-color:${sportColors[sp]}22;">
      <i class="ti ${sportIcons[sp]}" style="font-size:15px;"></i>
      ${sp.charAt(0).toUpperCase()+sp.slice(1)}
    </button>`).join('');
}

// ── URL / hash routing ──
// The gateway IS the home page. If the URL has no hash (or #home), always show gateway.
// Only go directly into a sport if the hash matches e.g. #cricket
// ── PWA Service Worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.log('SW failed:', err));
  });
}

// ── PWA Install prompt ──
let _deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredInstall = e;
  // Show install banner after 30s if not dismissed
  setTimeout(() => {
    if (_deferredInstall) showInstallBanner();
  }, 30000);
});

function showInstallBanner() {
  if (document.getElementById('install-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'install-banner';
  banner.innerHTML = `
    <div class="install-banner">
      <div class="install-banner-icon"><i class="ti ti-download"></i></div>
      <div class="install-banner-text">
        <div class="install-banner-title">Add to Home Screen</div>
        <div class="install-banner-sub">Use Arena offline — no app store needed</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="install-btn-yes" onclick="installPWA()">Install</button>
        <button class="install-btn-no" onclick="document.getElementById('install-banner').remove();_deferredInstall=null;">✕</button>
      </div>
    </div>`;
  document.body.appendChild(banner);
}

async function installPWA() {
  if (!_deferredInstall) return;
  _deferredInstall.prompt();
  const { outcome } = await _deferredInstall.userChoice;
  _deferredInstall = null;
  document.getElementById('install-banner')?.remove();
  if (outcome === 'accepted') toast('Arena installed! 🎉 Find it on your home screen.');
}

(function initRoute() {
  const hash = window.location.hash.replace('#', '').toLowerCase();
  const validSports = ['cricket', 'football', 'badminton', 'pickleball', 'chess'];
  if (validSports.includes(hash)) {
    selectSport(hash);
  } else {
    // Always start at gateway — clear any stored sport selection so URL reload = home
    document.getElementById('screen-gateway').classList.add('active');
    document.getElementById('screen-app').classList.remove('active');
    document.getElementById('header-back-btn').classList.add('hidden');
    document.getElementById('mode-badge').classList.add('hidden');
    document.getElementById('header-sport-badge').classList.add('hidden');
  }
})();

// Handle browser back/forward
window.addEventListener('popstate', function(e) {
  const state = e.state;
  if (state && state.sport) {
    // Navigated forward into a sport via browser
    const appScreen = document.getElementById('screen-app');
    const gwScreen = document.getElementById('screen-gateway');
    if (!appScreen.classList.contains('active')) {
      selectSport(state.sport);
    }
  } else {
    // Navigated back to home
    const appScreen = document.getElementById('screen-app');
    if (appScreen.classList.contains('active')) {
      goHome();
    }
  }
});

// Football squad on load
if (S.football.squad.length) renderFootballSquad();

// Restore cricket players list
if (S.cricket.players.length) renderCricketPlayersList();
if (S.cricket.teamA.length) renderCricketTeams();

// Draw initial chess board with starting position (decorative)
setTimeout(() => {
  _resizeChessCanvas();
  // Show decorative starting position on load
  if (!_chBoard) {
    _chBoard = _chInitBoard();
    _drawChessBoard();
    _chBoard = null; // Reset so game isn't "started"
  } else {
    _drawChessBoard();
  }
}, 300);

