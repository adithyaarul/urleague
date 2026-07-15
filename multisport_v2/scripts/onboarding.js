// ONBOARDING FLOW
// ═══════════════════════════════════════════════════════
(function initOnboarding() {
  const OB_KEY      = 'arena_onboarded';
  const SQUAD_KEY   = 'arena_squad_name';
  const TOTAL       = 3;
  let   current     = 0;
  let   dragStartX  = 0, dragStartY = 0, dragDx = 0;
  let   isDragging  = false;

  // ── Check if already onboarded
  if (localStorage.getItem(OB_KEY) === '1') {
    const el = document.getElementById('screen-onboarding');
    if (el) el.remove();
    return;
  }

  function getEls() {
    return {
      track:    document.getElementById('ob-track'),
      dots:     document.querySelectorAll('.ob-dot'),
      nextBtn:  document.getElementById('ob-next-btn'),
      skipBtn:  document.getElementById('ob-skip-btn'),
      input:    document.getElementById('ob-squad-input'),
    };
  }

  function goTo(idx, animate) {
    current = Math.max(0, Math.min(TOTAL - 1, idx));
    const { track, dots, nextBtn, skipBtn } = getEls();
    if (!track) return;

    // Animate track
    if (animate !== false) track.classList.remove('dragging');
    else track.classList.add('dragging');
    track.style.transform = `translateX(calc(-${current * 100}vw + ${animate === false ? dragDx : 0}px))`;

    // Update dots
    dots.forEach((d, i) => d.classList.toggle('active', i === current));

    // Update button text
    if (nextBtn) {
      nextBtn.innerHTML = current === TOTAL - 1
        ? `Let's Play <i class="ti ti-trophy"></i>`
        : `Next <i class="ti ti-arrow-right"></i>`;
    }

    // Hide skip on last screen
    if (skipBtn) {
      skipBtn.style.opacity = current === TOTAL - 1 ? '0' : '1';
      skipBtn.style.pointerEvents = current === TOTAL - 1 ? 'none' : 'auto';
    }

    // Auto-focus input on screen 3
    if (current === 2) {
      setTimeout(() => {
        const inp = document.getElementById('ob-squad-input');
        if (inp) inp.focus();
      }, 450);
    }
  }

  function finish(squadName) {
    const name = (squadName || '').trim() || 'Squad';
    localStorage.setItem(SQUAD_KEY, name);
    localStorage.setItem(OB_KEY, '1');

    // Update greeting if function exists
    if (typeof updateGreeting === 'function') updateGreeting();

    // Dismiss onboarding with animation
    const el = document.getElementById('screen-onboarding');
    if (el) {
      el.classList.add('hidden');
      setTimeout(() => el.remove(), 520);
    }

    // Show main app
    if (typeof goHome === 'function') goHome();
  }

  // ── Public actions
  window.obNext = function() {
    if (current < TOTAL - 1) {
      goTo(current + 1, true);
    } else {
      const inp = document.getElementById('ob-squad-input');
      finish(inp ? inp.value : '');
    }
  };

  window.obSkip = function() {
    finish('Squad');
  };

  // ── Touch / mouse drag
  function onStart(e) {
    const p = e.touches ? e.touches[0] : e;
    dragStartX = p.clientX; dragStartY = p.clientY; dragDx = 0;
    isDragging = true;
    const { track } = getEls();
    if (track) track.classList.add('dragging');
  }
  function onMove(e) {
    if (!isDragging) return;
    const p = e.touches ? e.touches[0] : e;
    const dx = p.clientX - dragStartX;
    const dy = p.clientY - dragStartY;
    if (Math.abs(dy) > Math.abs(dx) + 8) { isDragging = false; return; }
    if (e.cancelable) e.preventDefault();
    dragDx = dx;
    // Live follow finger
    const { track } = getEls();
    if (track) {
      track.classList.add('dragging');
      track.style.transform = `translateX(calc(-${current * 100}vw + ${dragDx}px))`;
    }
  }
  function onEnd() {
    if (!isDragging) return;
    isDragging = false;
    const threshold = window.innerWidth * 0.25;
    if (dragDx < -threshold && current < TOTAL - 1) goTo(current + 1, true);
    else if (dragDx > threshold && current > 0) goTo(current - 1, true);
    else goTo(current, true); // snap back
    dragDx = 0;
  }

  // ── Enter key on squad input → finish
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && current === 2) window.obNext();
    if (e.key === 'ArrowRight') goTo(current + 1, true);
    if (e.key === 'ArrowLeft')  goTo(current - 1, true);
  });

  // ── Dot click
  document.querySelectorAll('.ob-dot').forEach(d => {
    d.addEventListener('click', () => goTo(+d.dataset.idx, true));
  });

  // ── Attach drag events to onboarding element
  function attach() {
    const el = document.getElementById('screen-onboarding');
    if (!el) return;
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove',  onMove,  { passive: false });
    el.addEventListener('touchend',   onEnd);
    el.addEventListener('mousedown',  onStart);
    window.addEventListener('mousemove', e => { if (isDragging) onMove(e); });
    window.addEventListener('mouseup',   onEnd);
    // Init state
    goTo(0, true);
  }

  // Run after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();

