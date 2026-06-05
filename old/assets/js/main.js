function el(id) { return document.getElementById(id); }

document.addEventListener('DOMContentLoaded', async () => {
  setLanguage(currentLang);
  initTicker();
  initReveal();

  await loadProducts();

  initSliders();

  renderCartItems();
  el('ordersTickerText') && setInterval(cycleTicker, 4000);

  initMobileVideo();

  // Update sticky bar text on language switch
  document.addEventListener('langchange', () => {
    const btn = document.getElementById('stickyOrderBtnDirect');
    if (btn && btn.textContent.includes('\u2014')) {
      // Extract price part and rebuild with translated prefix
      const parts = btn.textContent.split('\u2014');
      if (parts.length > 1) {
        btn.textContent = t('sticky.ordernow') + ' \u2014' + parts.slice(1).join('\u2014');
      }
    }
  });
});

function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  if (!item) return;
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

function initMobileVideo() {
  if (window.innerWidth > 768) return;
  const video = document.getElementById('heroBgVideo');
  const img = document.getElementById('heroBgImg');
  if (!video || !img) return;
  img.style.display = 'none';
  video.setAttribute('autoplay', '');
  const source = document.createElement('source');
  source.src = 'assets/videos/hero-bg.mp4';
  source.type = 'video/mp4';
  video.appendChild(source);
  video.load();
  video.play().catch(() => {});
}
