function initSlider(id, prevId, nextId) {
    const slider = document.getElementById(id);
    const track = slider && slider.querySelector('.slider-track');
    if (!slider || !track) return;

    let isDown = false, startX, scrollLeft;
    slider.addEventListener('mousedown', e => {
      isDown = true; slider.classList.add('grabbing');
      startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft;
    });
    slider.addEventListener('mouseleave', () => { isDown = false; slider.classList.remove('grabbing'); });
    slider.addEventListener('mouseup', () => { isDown = false; slider.classList.remove('grabbing'); });
    slider.addEventListener('mousemove', e => {
      if (!isDown) return; e.preventDefault();
      slider.scrollLeft = scrollLeft - (e.pageX - slider.offsetLeft - startX) * 1.5;
    });
    let touchStart = 0;
    slider.addEventListener('touchstart', e => { touchStart = e.touches[0].clientX; scrollLeft = slider.scrollLeft; }, { passive: true });
    slider.addEventListener('touchmove', e => {
      const diff = touchStart - e.touches[0].clientX;
      slider.scrollLeft = scrollLeft + diff;
    }, { passive: true });

    document.getElementById(prevId).addEventListener('click', () => {
      const card = track.querySelector('.product-card');
      if (card) slider.scrollBy({ left: -card.offsetWidth - 12, behavior: 'smooth' });
    });
    document.getElementById(nextId).addEventListener('click', () => {
      const card = track.querySelector('.product-card');
      if (card) slider.scrollBy({ left: card.offsetWidth + 12, behavior: 'smooth' });
    });
}

function initSliders() {
    initSlider('bestSellersSlider', 'sliderPrev', 'sliderNext');
    initSlider('suitsSlider', 'suitsSliderPrev', 'suitsSliderNext');
}
