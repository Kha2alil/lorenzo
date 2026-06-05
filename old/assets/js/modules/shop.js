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

document.addEventListener('DOMContentLoaded', initFilterArrows);
