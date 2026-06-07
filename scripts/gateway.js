(function initGwCarousel() {
  const N = 5; // number of sport cards
  let currentIdx = 0;
  let dragStartX = 0, dragStartY = 0, dragDx = 0;
  let isDragging = false;
  let cardWidth = 0, cardGap = 14;

  function getEls() {
    return {
      viewport: document.getElementById('gw-carousel-viewport'),
      track:    document.getElementById('gw-carousel-track'),
      dots:     document.querySelectorAll('.gw-dot'),
    };
  }

  // Card width = viewport * 0.72 (matches CSS flex:0 0 72vw), capped at 280
  function calcCardWidth() {
    const vp = document.getElementById('gw-carousel-viewport');
    if (!vp) return 0;
    return Math.min(vp.offsetWidth * 0.72, 280);
  }

  function getOffset(idx, extraDx) {
    cardWidth = calcCardWidth();
    // Each step = cardWidth + gap; we don't transform the viewport scroll,
    // we use translateX on the track (track starts at left:0 inside viewport with padding-left:20px)
    return -(idx * (cardWidth + cardGap)) + (extraDx || 0);
  }

  function render(animate, extraDx) {
    const { track, dots } = getEls();
    if (!track) return;
    if (animate) track.classList.remove('dragging');
    else track.classList.add('dragging');
    track.style.transform = `translateX(${getOffset(currentIdx, extraDx || 0)}px)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === currentIdx));
  }

  window.gwGoTo = function(idx) {
    currentIdx = Math.max(0, Math.min(N - 1, idx));
    render(true);
  };

  // Touch / Mouse handlers
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
    if (Math.abs(dy) > Math.abs(dx) + 6) { isDragging = false; render(true); return; }
    if (e.cancelable) e.preventDefault();
    dragDx = dx;
    render(false, dragDx);
  }
  function onEnd() {
    if (!isDragging) return;
    isDragging = false;
    const thresh = calcCardWidth() * 0.25;
    if (dragDx < -thresh && currentIdx < N - 1) currentIdx++;
    else if (dragDx > thresh && currentIdx > 0) currentIdx--;
    dragDx = 0;
    render(true);
  }

  function attach() {
    const vp = document.getElementById('gw-carousel-viewport');
    if (!vp) { setTimeout(attach, 150); return; }

    vp.addEventListener('touchstart', onStart, { passive: true });
    vp.addEventListener('touchmove',  onMove,  { passive: false });
    vp.addEventListener('touchend',   onEnd);
    vp.addEventListener('mousedown',  onStart);
    window.addEventListener('mousemove', e => { if (isDragging) onMove(e); });
    window.addEventListener('mouseup',   onEnd);

    document.addEventListener('keydown', e => {
      if (!document.getElementById('screen-gateway').classList.contains('active')) return;
      if (e.key === 'ArrowRight') gwGoTo(currentIdx + 1);
      if (e.key === 'ArrowLeft')  gwGoTo(currentIdx - 1);
    });

    render(false);
  }

  setTimeout(attach, 80);
})();
