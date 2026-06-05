function navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');
    document.querySelectorAll('.bottom-nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.getElementById('nav-' + page);
    if (navItem) navItem.classList.add('active');
    const stickyBar = document.getElementById('stickyBar');
    if (page === 'product') {
      setTimeout(() => stickyBar && stickyBar.classList.add('visible'), 700);
    } else {
      if (stickyBar) stickyBar.classList.remove('visible');
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    setTimeout(initReveal, 60);
}

function initReveal() {
    const els = document.querySelectorAll('.page.active .reveal');
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    els.forEach(el => obs.observe(el));
}

window.addEventListener('scroll', () => {
    const nav = document.getElementById('topNav');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 10);
});

function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? '' : 'dark');
    localStorage.setItem('lorenzo_theme', isDark ? 'light' : 'dark');
}

function initTheme() {
    const saved = localStorage.getItem('lorenzo_theme');
    if (saved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
}

document.addEventListener('DOMContentLoaded', initTheme);
