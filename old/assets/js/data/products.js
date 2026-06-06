const API_BASE = window.API_BASE || 'http://localhost:3001';
const PLACEHOLDER_IMG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect fill="#EDE7D9" width="400" height="500"/><text fill="#8A8478" font-family="Georgia" font-size="16" text-anchor="middle" x="200" y="260">LORENZO</text></svg>');

function attrEsc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let products = {};
let productsList = [];

function imgUrl(storagePath) {
  if (!storagePath) return PLACEHOLDER_IMG;
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) return storagePath;
  return API_BASE + '/api/products/image/' + encodeURIComponent(storagePath);
}

async function loadProducts() {
  try {
    const res = await fetch(API_BASE + '/api/products');
    if (!res.ok) throw new Error('Failed to load products');
    const data = await res.json();

    products = {};
    productsList = data.map((p, i) => {
      const slug = p.slug || `product-${i}`;

      const catMap = { polo: 'Polo', pants: 'Pants', suits: 'Suits', chemise: 'Chemise', watches: 'Watches', vests: 'Vests', boots: 'Boots' };
      const categoryLabel = catMap[p.category] || p.category;
      const fabric = p.fabric || t('prod.italian');

      const mapped = {
        id: p.id,
        slug,
        name: p.name,
        displayName: p.name,
        category: `${categoryLabel} · ${fabric}`,
        price: p.price_dzd,
        promotion: p.promotion || null,
        unavailableSizes: p.unavailable_sizes || [],
        get discountedPrice() {
          return this.promotion ? Math.round(this.price * (1 - this.promotion.discount_percent / 100)) : this.price;
        },
        img: imgUrl(p.primary_image),
        thumbs: [imgUrl(p.primary_image)],
        desc: p.description || '',
        badge: p.badge || null,
        categorySlug: p.category,
        sizes: p.sizes || [],
        colors: []
      };

      products[slug] = mapped;
      return mapped;
    });

    // Fetch top sellers
    try {
      const topRes = await fetch(API_BASE + '/api/products/top');
      if (topRes.ok) {
        const topSlugs = await topRes.json();
        topSlugs.forEach(s => { if (products[s]) products[s].isTopSeller = true; });
      }
    } catch (e) { /* ignore */ }

    renderAllProducts();
  } catch (err) {
    console.error('Failed to load products:', err);
  }
}

function renderAllProducts() {
  renderFeaturedCollection();
  renderBestSellers();
  renderSuits();
  renderShopGrid();
  renderCartItems();
}

function productCardHTML(p, isFeatured) {
  const badgeHtml = p.badge
    ? `<span class="product-tag ${p.badge === 'Bestseller' ? 'tag-gold' : 'tag-dark'}">${p.badge}</span>`
    : '';
  const priceHtml = p.promotion
    ? `<span class="product-price"><span class="price-original">${p.price.toLocaleString('fr-DZ')}</span> <span class="price-sale">${p.discountedPrice.toLocaleString('fr-DZ')} <span>DZD</span></span></span>`
    : `<span class="product-price">${p.price.toLocaleString('fr-DZ')} <span>DZD</span></span>`;
  return `
    <div class="product-card${isFeatured ? ' featured-main' : ''} reveal${isFeatured ? '' : ' reveal-delay-1'}" data-category="${p.categorySlug}" onclick="openProduct('${attrEsc(p.slug)}')">
      <div class="product-img-wrap">
        <img class="product-photo" src="${p.img}" alt="${p.name}" loading="lazy" onload="this.classList.add('loaded')">
        ${badgeHtml}
        ${p.promotion ? '<span class="product-tag tag-sale">-' + p.promotion.discount_percent + '%</span>' : ''}
        <div class="card-overlay"></div>
        <div class="card-order-btn" onclick="event.stopPropagation();quickAdd('${attrEsc(p.slug)}')">${t('prod.addtocart')}</div>
      </div>
      <div class="product-info">
        <p class="product-cat">${p.category}</p>
        <h3 class="product-name">${p.displayName}</h3>
        <div class="product-price-row">
          ${priceHtml}
        </div>
      </div>
    </div>
  `;
}

function renderFeaturedCollection() {
  const grid = document.getElementById('featuredGrid');
  if (!grid) return;
  const featured = productsList.filter(p => p.badge === 'New').slice(0, 3);
  grid.innerHTML = featured.map((p, i) => productCardHTML(p, i === 0)).join('');
  setTimeout(initReveal, 50);
}

function renderBestSellers() {
  const track = document.getElementById('bestSellersTrack');
  if (!track) return;
  const sellers = productsList.filter(p => p.badge === 'Bestseller' || p.isTopSeller);
  track.innerHTML = sellers.map(p => {
    const priceHtml = p.promotion
      ? `<span class="product-price"><span class="price-original">${p.price.toLocaleString('fr-DZ')}</span> <span class="price-sale">${p.discountedPrice.toLocaleString('fr-DZ')} <span>DZD</span></span></span>`
      : `<span class="product-price">${p.price.toLocaleString('fr-DZ')} <span>DZD</span></span>`;
    return `
    <div class="product-card" onclick="openProduct('${attrEsc(p.slug)}')">
      <div class="product-img-wrap">
        <img class="product-photo" src="${p.img}" alt="${p.name}" loading="lazy" onload="this.classList.add('loaded')">
        ${p.badge ? `<span class="product-tag ${p.badge === 'Bestseller' ? 'tag-gold' : 'tag-dark'}">${p.badge}</span>` : ''}
        ${p.promotion ? '<span class="product-tag tag-sale">-' + p.promotion.discount_percent + '%</span>' : ''}
        <div class="card-order-btn" onclick="event.stopPropagation();quickAdd('${attrEsc(p.slug)}')">${t('prod.addtocart')}</div>
      </div>
      <div class="product-info">
        <p class="product-cat">${p.category.split(' · ')[0]}</p>
        <h3 class="product-name">${p.name}</h3>
        <div class="product-price-row">${priceHtml}</div>
      </div>
    </div>`;
  }).join('');
}

function renderSuits() {
  const track = document.getElementById('suitsTrack');
  if (!track) return;
  const items = productsList.filter(p => p.categorySlug === 'suits');
  track.innerHTML = items.map(p => {
    const priceHtml = p.promotion
      ? `<span class="product-price"><span class="price-original">${p.price.toLocaleString('fr-DZ')}</span> <span class="price-sale">${p.discountedPrice.toLocaleString('fr-DZ')} <span>DZD</span></span></span>`
      : `<span class="product-price">${p.price.toLocaleString('fr-DZ')} <span>DZD</span></span>`;
    return `
    <div class="product-card" onclick="openProduct('${attrEsc(p.slug)}')">
      <div class="product-img-wrap">
        <img class="product-photo" src="${p.img}" alt="${p.name}" loading="lazy" onload="this.classList.add('loaded')">
        ${p.badge ? `<span class="product-tag ${p.badge === 'Bestseller' ? 'tag-gold' : 'tag-dark'}">${p.badge}</span>` : ''}
        ${p.promotion ? '<span class="product-tag tag-sale">-' + p.promotion.discount_percent + '%</span>' : ''}
        <div class="card-order-btn" onclick="event.stopPropagation();quickAdd('${attrEsc(p.slug)}')">${t('prod.addtocart')}</div>
      </div>
      <div class="product-info">
        <p class="product-cat">Suits</p>
        <h3 class="product-name">${p.name}</h3>
        <div class="product-price-row">${priceHtml}</div>
      </div>
    </div>`;
  }).join('');
}

function renderShopGrid(filter) {
  const grid = document.getElementById('shopGrid');
  if (!grid) return;
  const list = filter ? productsList.filter(p => p.categorySlug === filter) : productsList;
  grid.innerHTML = list.map((p, i) => {
    const priceHtml = p.promotion
      ? `<span class="product-price"><span class="price-original">${p.price.toLocaleString('fr-DZ')}</span> <span class="price-sale">${p.discountedPrice.toLocaleString('fr-DZ')} <span>DZD</span></span></span>`
      : `<span class="product-price">${p.price.toLocaleString('fr-DZ')} <span>DZD</span></span>`;
    return `
    <div class="product-card reveal${i % 2 === 0 ? '' : ' reveal-delay-1'}" data-category="${p.categorySlug}" onclick="openProduct('${attrEsc(p.slug)}')">
      <div class="product-img-wrap">
        <img class="product-photo" src="${p.img}" alt="${p.name}" loading="lazy" onload="this.classList.add('loaded')">
        ${p.badge ? `<span class="product-tag ${p.badge === 'Bestseller' ? 'tag-gold' : 'tag-dark'}">${p.badge}</span>` : ''}
        ${p.promotion ? '<span class="product-tag tag-sale">-' + p.promotion.discount_percent + '%</span>' : ''}
        <div class="card-overlay"></div>
        <div class="card-order-btn" onclick="event.stopPropagation();quickAdd('${attrEsc(p.slug)}')">${t('prod.addtocart')}</div>
      </div>
      <div class="product-info">
        <p class="product-cat">${p.category.split(' · ')[0]}</p>
        <h3 class="product-name">${p.name}</h3>
        <div class="product-price-row">
          ${priceHtml}
          <span class="product-rating">★★★★★</span>
        </div>
      </div>
    </div>`;
  }).join('');
}
