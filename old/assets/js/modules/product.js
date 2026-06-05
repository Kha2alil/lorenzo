let currentProduct = null;
let currentProductSlug = '';
let selectedSize = 'S';
let selectedColor = null;
let selectedColorHex = '';

function openProduct(slug) {
  currentProductSlug = slug;
  currentProduct = products[slug] || productsList[0];
  if (!currentProduct) return;

  document.getElementById('detailCategory').textContent = currentProduct.category;
  document.getElementById('detailName').innerHTML = currentProduct.displayName.replace(/(\S+)\s*$/, '<em>$1</em>');
  if (currentProduct.promotion) {
    const endDateStr = currentProduct.promotion.end_date
      ? '<span class="promo-end"> \u00b7 Sale ends ' + new Date(currentProduct.promotion.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + '</span>'
      : '';
    document.getElementById('detailPrice').innerHTML = '<span class="price-original">' + currentProduct.price.toLocaleString('fr-DZ') + '</span> <span class="price-sale">' + currentProduct.discountedPrice.toLocaleString('fr-DZ') + ' <span>DZD</span></span>' + endDateStr;
    document.getElementById('detailCartPrice').innerHTML = '<span class="price-original">' + currentProduct.price.toLocaleString('fr-DZ') + '</span> ' + currentProduct.discountedPrice.toLocaleString('fr-DZ') + ' DZD';
  } else {
    document.getElementById('detailPrice').innerHTML = currentProduct.price.toLocaleString('fr-DZ') + ' <span>DZD</span>';
    document.getElementById('detailCartPrice').textContent = currentProduct.price.toLocaleString('fr-DZ') + ' DZD';
  }
  document.getElementById('stickyOrderBtnDirect').textContent = t('sticky.ordernow') + ' \u2014 ' + (currentProduct.promotion ? currentProduct.discountedPrice : currentProduct.price).toLocaleString('fr-DZ') + ' DZD';
  document.getElementById('detailDesc').textContent = currentProduct.desc;

  const allImages = currentProduct.allImages || [currentProduct.img];

  const mainImg = document.getElementById('galleryMainImg');
  mainImg.style.opacity = '0';
  mainImg.src = allImages[0];
  mainImg.alt = currentProduct.name;

  const thumbsEl = document.getElementById('galleryThumbs');
  thumbsEl.innerHTML = allImages.map((url, i) => `
    <div class="gallery-thumb ${i===0?'active':''}" onclick="switchGalleryImg(this,'${attrEsc(url)}',${i+1})">
      <img src="${url}" alt="${currentProduct.name}" loading="lazy" onload="this.classList.add('loaded')">
    </div>`).join('');
  document.getElementById('galleryCounter').textContent = '1 / ' + allImages.length;
  document.getElementById('stickyOrderBtnDirect').textContent = t('sticky.ordernow') + ` \u2014 ${currentProduct.price.toLocaleString('fr-DZ')} DZD`;

  renderSizeGrid();
  renderStickySizes();
  selectedColor = null;
  renderColorSwatches([]);

  fetch(API_BASE + '/api/products/' + slug).then(r => r.json()).then(detail => {
    if (currentProductSlug !== slug) return;
    if (detail) {
      if (detail.unavailable_sizes) currentProduct.unavailableSizes = detail.unavailable_sizes;
      if (detail.promotion) currentProduct.promotion = detail.promotion;
      renderSizeGrid();
      renderStickySizes();
      if (currentProduct.promotion) {
        const endDateStr = currentProduct.promotion.end_date
          ? '<span class="promo-end"> \u00b7 Sale ends ' + new Date(currentProduct.promotion.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + '</span>'
          : '';
        document.getElementById('detailPrice').innerHTML = '<span class="price-original">' + currentProduct.price.toLocaleString('fr-DZ') + '</span> <span class="price-sale">' + currentProduct.discountedPrice.toLocaleString('fr-DZ') + ' <span>DZD</span></span>' + endDateStr;
        document.getElementById('detailCartPrice').innerHTML = '<span class="price-original">' + currentProduct.price.toLocaleString('fr-DZ') + '</span> ' + currentProduct.discountedPrice.toLocaleString('fr-DZ') + ' DZD';
        document.getElementById('stickyOrderBtnDirect').textContent = t('sticky.ordernow') + ' \u2014 ' + currentProduct.discountedPrice.toLocaleString('fr-DZ') + ' DZD';
      }
      if (detail.images && detail.images.length > 0) {
        const detailImages = detail.images.map(img => ({ url: imgUrl(img.storage_path), colorId: img.color_id || null }));
        currentProduct._rawImages = detail.images;
        currentProduct.allImages = detailImages.map(i => i.url);
        currentProduct.colors = (detail.colors || []).map(c => ({
          id: c.id || null,
          name: c.color_name || '',
          hex: c.color_hex || ''
        }));
        function renderGallery(images) {
          const thumbsEl2 = document.getElementById('galleryThumbs');
          thumbsEl2.innerHTML = images.map((img, i) => {
            const url = img.url || img;
            const cid = img.colorId || '';
            return `<div class="gallery-thumb ${i===0?'active':''}" onclick="switchGalleryImg(this,'${attrEsc(url)}',${i+1},'${attrEsc(cid)}')">
              <img src="${url}" alt="${currentProduct.name}" loading="lazy" onload="this.classList.add('loaded')">
            </div>`;
          }).join('');
          const mainImg2 = document.getElementById('galleryMainImg');
          mainImg2.src = (images[0]?.url || images[0]) || detailImages[0].url;
          document.getElementById('galleryCounter').textContent = '1 / ' + images.length;
        }
        renderGallery(detailImages);
        const hasColorImages = detailImages.some(i => i.colorId);
        currentProduct._colorImages = hasColorImages ? detailImages : null;
        renderColorSwatches(currentProduct.colors);
      }
    }
  }).catch(() => {});

  navigate('product');
}

function renderSizeGrid() {
  const available = currentProduct.sizes || [];
  const unavailableSizes = currentProduct.unavailableSizes || [];
  const allSizes = ['XS', 'S', 'M', 'L', 'XL'];
  const grid = document.getElementById('sizeGrid');
  grid.innerHTML = allSizes.map(s => {
    const isAvail = available.includes(s) && !unavailableSizes.includes(s);
    const isActive = s === 'S' && isAvail;
    const lowStock = isAvail && s === 'M';
    return `<button class="size-btn${isActive ? ' active' : ''}${!isAvail ? ' out-of-stock' : ''}" onclick="selectSize(this)"${!isAvail ? '' : ''}>${s}${lowStock ? ' <span class="size-low"></span>' : ''}</button>`;
  }).join('');
  selectedSize = available.includes('S') && !unavailableSizes.includes('S') ? 'S' : (available.filter(s => !unavailableSizes.includes(s))[0] || 'M');
}

function renderStickySizes() {
  const available = currentProduct.sizes || [];
  const unavailableSizes = currentProduct.unavailableSizes || [];
  const allSizes = ['XS', 'S', 'M', 'L', 'XL'];
  const select = document.getElementById('stickySizeSelect');
  select.innerHTML = allSizes.filter(s => available.includes(s) && !unavailableSizes.includes(s)).map(s =>
    `<option value="${s}"${s === selectedSize ? ' selected' : ''}>${s}</option>`
  ).join('');
  if (select.options.length === 0) {
    select.innerHTML = '<option value="N/A">N/A</option>';
  }
  select.value = selectedSize;
}

function switchGalleryImg(thumb, url, idx, colorId) {
  document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
  thumb.classList.add('active');
  const mainImg = document.getElementById('galleryMainImg');
  mainImg.style.opacity = '0';
  setTimeout(() => { mainImg.src = url; mainImg.style.opacity = '1'; }, 200);
  const total = document.querySelectorAll('#galleryThumbs .gallery-thumb').length;
  document.getElementById('galleryCounter').textContent = idx + ' / ' + total;
  if (colorId && currentProduct && currentProduct.colors) {
    const match = currentProduct.colors.find(c => String(c.id) === String(colorId));
    if (match && match.name) {
      selectedColor = match.name;
      selectedColorHex = match.hex;
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      const swatch = Array.from(document.querySelectorAll('.color-swatch')).find(s => s.title === match.name);
      if (swatch) swatch.classList.add('active');
      const label = document.getElementById('colorSelected');
      if (label) label.textContent = match.name;
    }
  }
}

function selectSize(btn) {
  if (btn.classList.contains('out-of-stock')) return;
  document.querySelectorAll('#sizeGrid .size-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedSize = btn.textContent.trim().replace(/\s+/g,'').slice(0,2);
  const stickySelect = document.getElementById('stickySizeSelect');
  if (stickySelect) stickySelect.value = selectedSize;
}

function toggleAccordion(header) {
  const item = header.parentElement;
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

function renderColorSwatches(colors) {
  const container = document.getElementById('colorSwatches');
  const selectedLabel = document.getElementById('colorSelected');
  if (!container) return;
  const withColor = colors.filter(c => c.name && c.hex);
  if (withColor.length === 0) {
    container.innerHTML = '';
    if (selectedLabel) selectedLabel.textContent = '';
    selectedColor = null;
    return;
  }
  selectedColor = null;
  selectedColorHex = '';
  container.innerHTML = withColor.map(c =>
    `<div class="color-swatch" style="background:${c.hex}" title="${c.name}" onclick="selectColor('${c.name.replace(/'/g, "\\'")}','${c.hex}','${c.id || ''}')"></div>`
  ).join('');
  if (selectedLabel) selectedLabel.textContent = t('prod.selectcolor');
}

function selectColor(name, hex, colorId) {
  selectedColor = name;
  selectedColorHex = hex;
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
  event.target.classList.add('active');
  const label = document.getElementById('colorSelected');
  if (label) label.textContent = name;
  if (currentProduct && currentProduct._colorImages) {
    filterGalleryByColor(colorId || null);
  }
}

function filterGalleryByColor(colorId) {
  if (!currentProduct || !currentProduct._colorImages) return;
  const filtered = colorId
    ? currentProduct._colorImages.filter(i => String(i.colorId) === String(colorId))
    : currentProduct._colorImages;
  const images = filtered.length > 0 ? filtered : currentProduct._colorImages;
  const thumbsEl = document.getElementById('galleryThumbs');
  thumbsEl.innerHTML = images.map((img, i) => {
    const cid = img.colorId || '';
    return `<div class="gallery-thumb ${i===0?'active':''}" onclick="switchGalleryImg(this,'${attrEsc(img.url)}',${i+1},'${attrEsc(cid)}')">
      <img src="${img.url}" alt="${currentProduct.name}" loading="lazy" onload="this.classList.add('loaded')">
    </div>`;
  }).join('');
  const mainImg = document.getElementById('galleryMainImg');
  mainImg.src = images[0].url;
  mainImg.style.opacity = '1';
  document.getElementById('galleryCounter').textContent = '1 / ' + images.length;
}

function openSizeGuide() {
  document.getElementById('sizeGuideModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSizeGuide() {
  document.getElementById('sizeGuideModal').classList.remove('open');
  document.body.style.overflow = '';
}
