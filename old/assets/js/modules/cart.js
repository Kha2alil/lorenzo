let cart = [];

function getCartTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}
function getCartCount() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

function updateCartBadges() {
  const count = getCartCount();
  const badge = document.getElementById('cartBadge');
  const navCount = document.getElementById('cartNavCount');
  if (count > 0) {
    badge.textContent = count; badge.classList.add('show');
    if (navCount) { navCount.textContent = count; navCount.classList.add('show'); }
  } else {
    badge.classList.remove('show');
    if (navCount) navCount.classList.remove('show');
  }
}

function addToCart(slug, size, color, colorHex) {
  const p = products[slug];
  if (!p) return;
  color = color || selectedColor || '';
  colorHex = colorHex || selectedColorHex || '';
  const galleryImg = document.getElementById('galleryMainImg');
  const currentImg = galleryImg && galleryImg.src && !galleryImg.src.includes('placeholder') ? galleryImg.src : p.img;
  const existing = cart.find(i => i.slug === slug && i.size === size && i.color === color);
  if (existing) { existing.qty++; }
  else { cart.push({ slug, id: p.id, name: p.name, price: p.promotion ? p.discountedPrice : p.price, img: currentImg, size: size || 'M', color: color || '', colorHex: colorHex || '', qty: 1 }); }
  updateCartBadges();
  renderCartItems();
  const badge = document.getElementById('cartBadge');
  badge.style.transform = 'scale(1.4)';
  setTimeout(() => badge.style.transform = '', 200);
  showCartToast(p.name);
}

function removeFromCart(slug, size) {
  cart = cart.filter(i => !(i.slug === slug && i.size === size));
  updateCartBadges();
  renderCartItems();
}

function changeQty(slug, size, delta) {
  const item = cart.find(i => i.slug === slug && i.size === size);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) removeFromCart(slug, size);
  else { updateCartBadges(); renderCartItems(); }
}

function renderCartItems() {
  const list = document.getElementById('cartItemsList');
  const footer = document.getElementById('cartFooter');
  if (!list) return;

  if (cart.length === 0) {
    list.innerHTML = `
      <div class="cart-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        <div class="cart-empty-title">${t('cart.empty')}</div>
        <div class="cart-empty-sub">${t('cart.emptysub')}</div>
        <button class="cart-empty-btn" onclick="closeCartDrawer();navigate('shop')">${t('cart.browse')}</button>
      </div>`;
    if (footer) footer.style.display = 'none';
    return;
  }

  if (footer) footer.style.display = 'block';
  list.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-img">
        <img src="${item.img}" alt="${item.name}" loading="lazy" onload="this.classList.add('loaded')">
      </div>
      <div class="cart-item-info">
        <div class="cart-item-cat">Lorenzo</div>
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-size">${t('cart.size')} ${item.size}${item.color ? '<span style="display:inline-flex;align-items:center;gap:3px;margin-left:4px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;border:1px solid var(--border);background:' + (item.colorHex || '#ccc') + '"></span>' + item.color + '</span>' : ''}</div>
        <div class="cart-item-qty-row">
          <button class="qty-btn" onclick="changeQty('${attrEsc(item.slug)}','${attrEsc(item.size)}',-1)">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${attrEsc(item.slug)}','${attrEsc(item.size)}',1)">+</button>
          <button class="cart-item-remove" onclick="removeFromCart('${attrEsc(item.slug)}','${attrEsc(item.size)}')">${t('cart.remove')}</button>
        </div>
      </div>
      <div class="cart-item-price">${(item.price * item.qty).toLocaleString('fr-DZ')} <span style="font-size:10px;color:var(--warm-gray)">DZD</span></div>
    </div>
  `).join('');
  const subtotalEl = document.getElementById('cartSubtotal');
  if (subtotalEl) subtotalEl.textContent = getCartTotal().toLocaleString('fr-DZ') + ' DZD';
}

function addToCartDetail() {
  if (currentProduct && currentProduct.colors && currentProduct.colors.length > 0 && !selectedColor) {
    showCartToast(t('prod.mustselectcolor'));
    return false;
  }
  addToCart(currentProductSlug, selectedSize, selectedColor, selectedColorHex);
  return true;
}

function orderNow() {
  if (currentProduct && currentProduct.colors && currentProduct.colors.length > 0 && !selectedColor) {
    showCartToast(t('prod.mustselectcolor'));
    return;
  }
  addToCart(currentProductSlug, selectedSize, selectedColor, selectedColorHex);
  setTimeout(openOrderDrawer, 200);
}

function quickAdd(slug) {
  if (!selectedSize) selectedSize = 'M';
  addToCart(slug, selectedSize, selectedColor, selectedColorHex);
  setTimeout(openCartDrawer, 80);
}

function openCartDrawer() {
  renderCartItems();
  document.getElementById('cartDrawerOverlay').classList.add('open');
  document.getElementById('cartDrawer').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCartDrawer() {
  document.getElementById('cartDrawerOverlay').classList.remove('open');
  document.getElementById('cartDrawer').classList.remove('open');
  document.body.style.overflow = '';
}
function cartCheckout() {
  if (cart.length === 0) return;
  closeCartDrawer();
  setTimeout(() => openOrderDrawer(), 350);
}

let toastTimer = null;
function showCartToast(name) {
  const toast = document.getElementById('cartToast');
  if (!toast) return;
  toast.querySelector('.toast-name').textContent = name;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}
