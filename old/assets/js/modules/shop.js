let currentFilter = 'all';

function filterShop(chip, category) {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  currentFilter = category;
  renderShopGrid(category === 'all' ? null : category);
  setTimeout(initReveal, 50);
}

function initFilterArrows() {
  const leftBtn = document.getElementById('filterArrowLeft');
  const rightBtn = document.getElementById('filterArrowRight');
  const container = document.querySelector('.shop-filters');
  if (!leftBtn || !rightBtn || !container) return;

  if (window.innerWidth < 1024) {
    leftBtn.style.display = 'flex';
    rightBtn.style.display = 'flex';
  }

  const scrollBy = container.querySelector('.filter-chip')?.offsetWidth * 3.5 || 200;

  leftBtn.addEventListener('click', () => {
    container.scrollBy({ left: -scrollBy, behavior: 'smooth' });
  });

  rightBtn.addEventListener('click', () => {
    container.scrollBy({ left: scrollBy, behavior: 'smooth' });
  });

  container.addEventListener('scroll', updateArrowVisibility);
  updateArrowVisibility();

  function updateArrowVisibility() {
    if (window.innerWidth >= 1024) return;
    leftBtn.style.opacity = container.scrollLeft <= 4 ? '0.3' : '1';
    rightBtn.style.opacity = container.scrollLeft + container.clientWidth >= container.scrollWidth - 4 ? '0.3' : '1';
  }
}

async function loadCategories() {
  try {
    const res = await fetch(API_BASE + '/api/products/categories');
    if (!res.ok) { console.error('Categories fetch failed:', res.status); return; }
    const cats = await res.json();
    if (!cats || !cats.length) { console.log('No categories returned from API'); return; }
    const container = document.getElementById('shopFilters');
    if (!container) return;
    cats.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'filter-chip';
      btn.textContent = c.name;
      btn.onclick = function () { filterShop(this, c.slug); };
      container.appendChild(btn);
    });
  } catch (err) { console.error('loadCategories error:', err); }
}

document.addEventListener('DOMContentLoaded', () => {
  initFilterArrows();
  loadCategories();
});
