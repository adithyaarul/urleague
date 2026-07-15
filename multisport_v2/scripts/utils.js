function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ═══════════════════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════════════════
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ═══════════════════════════════════════════════════════
// THEME & MODE
// ═══════════════════════════════════════════════════════
function toggleTheme(btn) {
  S.theme = S.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  save();
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', S.theme || 'dark');
  // Update theme-color meta for Android Chrome
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = (S.theme === 'light') ? '#f8fbff' : '#03060c';
}

function toggleMode() {
  S.mode = S.mode === 'scorer' ? 'viewer' : 'scorer';
  applyMode();
  save();
}

function applyMode() {
  // In a room, show actual room role (host/scorer/viewer); outside, show solo mode
  let label, isScorer;
  if (_roomState && _roomState.active) {
    const role = _roomState.role || 'viewer';
    isScorer = role === 'host' || role === 'scorer';
    const roleIcons = { host: 'ti-crown', scorer: 'ti-pencil', viewer: 'ti-eye' };
    const icon = roleIcons[role] || 'ti-eye';
    label = role.charAt(0).toUpperCase() + role.slice(1);
    const badge = document.getElementById('mode-badge');
    if (badge) {
      badge.innerHTML = `<i class="ti ${icon}"></i> ${label}`;
      badge.className = `mode-badge ${isScorer ? 'mode-scorer' : 'mode-viewer'}`;
    }
  } else {
    isScorer = S.mode === 'scorer';
    const badge = document.getElementById('mode-badge');
    if (badge) {
      badge.innerHTML = isScorer ? '<i class="ti ti-pencil"></i> Scorer' : '<i class="ti ti-eye"></i> Viewer';
      badge.className = `mode-badge ${isScorer ? 'mode-scorer' : 'mode-viewer'}`;
    }
    label = isScorer ? 'Scorer' : 'Viewer';
  }
  const lbl = document.getElementById('settings-mode-label');
  if (lbl) lbl.textContent = `Currently: ${label}`;

  const vOverlay = document.getElementById('viewer-overlay');
  if (vOverlay) vOverlay.classList.toggle('hidden', isScorer);
}

function canEdit() {
  if (_roomState.active) return roomCan('score.edit');
  return S.mode === 'scorer';
}

const HOUSE_RULES_CONFIG = [
  { id:'one_pitch_out', name:'One Pitch One Hand Out', desc:'Ball caught off one hand after one bounce counts as out.', default:false },
  { id:'three_dots_out', name:'3 Dot Balls = Out', desc:'Three consecutive dot balls send the batsman back.', default:true },
  { id:'no_six', name:'No Sixes Allowed', desc:'A six is treated as an out instead of a boundary.', default:false },
  { id:'no_four', name:'No Fours Allowed', desc:'A four is not awarded for the shot.', default:false },
  { id:'super_over', name:'Super Over on Tie', desc:'A tied match goes to a super over.', default:false },
];
