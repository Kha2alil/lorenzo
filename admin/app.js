/* LORENZO Admin — JWT Auth + Dashboard */

const API = '/api/admin';
const TOKEN_KEY = 'lorenzo_admin_token';

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

async function api(path, opts = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API + path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  if (res.status === 401) { logout(); throw new Error('Session expired'); }
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Request failed'); }
  return res.json();
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function logout() {
  clearToken();
  showScreen('login-screen');
  document.getElementById('login-error').textContent = '';
  document.getElementById('login-pwd').value = '';
}

// ───── Login ─────
document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-pwd').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  try {
    const res = await fetch(API + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error; return; }
    setToken(data.token);
    showScreen('dashboard-screen');
    initDashboard();
  } catch { errEl.textContent = 'Connection error'; }
});

// ───── Forgot Password ─────
document.getElementById('forgot-back').addEventListener('click', e => {
  e.preventDefault();
  showScreen('login-screen');
});

document.getElementById('forgot-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value.trim();
  const errEl = document.getElementById('forgot-error');
  const successEl = document.getElementById('forgot-success');
  errEl.textContent = '';
  successEl.textContent = '';
  try {
    const res = await fetch(API + '/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error; return; }
    successEl.textContent = data.message;
  } catch { errEl.textContent = 'Connection error'; }
});

// ───── Reset Password ─────
document.getElementById('reset-back').addEventListener('click', e => {
  e.preventDefault();
  showScreen('login-screen');
});

document.getElementById('reset-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('reset-email').value.trim();
  const token = document.getElementById('reset-token').value.trim();
  const new_password = document.getElementById('reset-pwd').value;
  const errEl = document.getElementById('reset-error');
  const successEl = document.getElementById('reset-success');
  errEl.textContent = '';
  successEl.textContent = '';
  try {
    const res = await fetch(API + '/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token, new_password })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error; return; }
    successEl.textContent = data.message;
    document.getElementById('reset-pwd').value = '';
    document.getElementById('reset-token').value = '';
    setTimeout(() => showScreen('login-screen'), 2000);
  } catch { errEl.textContent = 'Connection error'; }
});

// ───── Theme ─────
function toggleAdminTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? '' : 'dark');
  localStorage.setItem('lorenzo_admin_theme', isDark ? 'light' : 'dark');
  const label = document.getElementById('theme-toggle-label');
  if (label) label.textContent = isDark ? 'Dark Mode' : 'Light Mode';
}

function initAdminTheme() {
  if (localStorage.getItem('lorenzo_admin_theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    const label = document.getElementById('theme-toggle-label');
    if (label) label.textContent = 'Light Mode';
  }
}
initAdminTheme();

// ───── Check for reset link in URL ─────
const resetParams = (function() {
  const p = new URLSearchParams(window.location.search);
  const rt = p.get('reset_token');
  const em = p.get('email');
  if (rt && em) return { token: rt, email: em };
  return null;
})();

if (resetParams) {
  document.getElementById('reset-email').value = resetParams.email;
  document.getElementById('reset-token').value = resetParams.token;
  document.getElementById('reset-pwd').value = '';
  document.getElementById('reset-error').textContent = '';
  document.getElementById('reset-success').textContent = '';
  window.history.replaceState({}, document.title, window.location.pathname);
  showScreen('reset-screen');
} else if (getToken()) {
  api('/stats').then(() => {
    showScreen('dashboard-screen');
    initDashboard();
  }).catch(() => {
    showScreen('login-screen');
  });
} else {
  showScreen('login-screen');
}

// ───── Navigation ─────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const page = item.dataset.page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    if (page === 'overview') loadStats();
    if (page === 'products') loadProducts();
    if (page === 'orders') { clearOrderNotification(); loadOrders(); }
    if (page === 'top-products') loadTopProducts('all');
    if (page === 'contact') loadContacts();
    if (page === 'audit') { _auditPage = 1; loadAuditLogs(); }
    if (page === 'categories') loadCategories();
    if (page === 'badges') loadBadges();
    if (page === 'settings') loadProfile();
  });
});

document.getElementById('logout-btn').addEventListener('click', e => {
  e.preventDefault();
  logout();
});

// ───── Stats & Overview ─────
async function loadStats() {
  try {
    const [s, orders] = await Promise.all([
      api('/stats'),
      api('/orders?limit=6')
    ]);

    // Row 1: General
    document.getElementById('stat-products').textContent = s.totalProducts ?? '—';
    document.getElementById('stat-active').textContent = s.activeProducts ?? '—';
    document.getElementById('stat-orders').textContent = s.totalOrders ?? '—';
    document.getElementById('stat-pending').textContent = s.pendingOrders ?? '—';
    document.getElementById('stat-contacts').textContent = s.totalContacts ?? '—';

    // Row 2: Products Sold
    document.getElementById('stat-sold-today').textContent = s.productsSoldToday ?? '—';
    document.getElementById('stat-sold-week').textContent = s.productsSoldWeek ?? '—';
    document.getElementById('stat-sold-month').textContent = s.productsSoldMonth ?? '—';
    document.getElementById('stat-sold-all').textContent = s.productsSoldAll ?? '—';
    document.getElementById('stat-avg-order').textContent = (s.avgOrderValue ?? 0).toLocaleString('fr-DZ') + ' DZD';

    // Row 3: Revenue
    document.getElementById('stat-revenue-today').textContent = (s.revenueToday ?? 0).toLocaleString('fr-DZ') + ' DZD';
    document.getElementById('stat-revenue-week').textContent = (s.revenueWeek ?? 0).toLocaleString('fr-DZ') + ' DZD';
    document.getElementById('stat-revenue-month').textContent = (s.revenueMonth ?? 0).toLocaleString('fr-DZ') + ' DZD';
    document.getElementById('stat-revenue-all').textContent = (s.revenueAll ?? 0).toLocaleString('fr-DZ') + ' DZD';

    // Status breakdown
    const statusColors = { pending: '#C9A84C', confirmed: '#2E2E2B', shipped: '#2E7D32', delivered: '#1B5E20', returned: '#C0392B', cancelled: '#8A8478' };
    const statusLabels = { pending: 'Pending', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered', returned: 'Returned', cancelled: 'Cancelled' };
    const statusOrder = ['pending', 'confirmed', 'shipped', 'delivered', 'returned', 'cancelled'];
    const statusData = s.ordersByStatus || {};
    const statusMax = Math.max(...statusOrder.map(k => statusData[k] || 0), 1);
    const statusHtml = statusOrder.map(key => {
      const count = statusData[key] || 0;
      const pct = Math.round((count / statusMax) * 100);
      return '<div class="stat-bar-row">' +
        '<span class="stat-bar-label">' + statusLabels[key] + '</span>' +
        '<div class="stat-bar-track"><div class="stat-bar-fill" style="width:' + pct + '%;background:' + (statusColors[key] || '#8A8478') + '"></div></div>' +
        '<span class="stat-bar-count">' + count + '</span>' +
        '</div>';
    }).join('');
    document.getElementById('status-breakdown').innerHTML = statusHtml;

    // Top products
    const topProducts = s.topProducts || [];
    const topHtml = topProducts.length > 0 ? topProducts.map((p, i) =>
      '<div class="top-product-row">' +
      '<span class="top-product-rank">' + (i + 1) + '</span>' +
      '<span class="top-product-name">' + esc(p.name) + '</span>' +
      '<span class="top-product-qty">' + p.qty + ' sold</span>' +
      '<span class="top-product-revenue">' + (p.revenue || 0).toLocaleString('fr-DZ') + ' DZD</span>' +
      '</div>'
    ).join('') : '<div style="font-size:12px;color:var(--warm-gray);padding:12px 0">No sales yet</div>';
    document.getElementById('top-products-list').innerHTML = topHtml;

    // Products by category
    const catData = s.productsByCategory || {};
    const catKeys = Object.keys(catData);
    const catMax = Math.max(...catKeys.map(k => catData[k] || 0), 1);
    const catHtml = catKeys.map(key => {
      const count = catData[key];
      const pct = Math.round((count / catMax) * 100);
      return '<div class="category-row">' +
        '<span class="category-name">' + esc(key) + '</span>' +
        '<div class="category-bar-track"><div class="category-bar-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="category-count">' + count + '</span>' +
        '</div>';
    }).join('') || '<div style="font-size:12px;color:var(--warm-gray);padding:12px 0">No products</div>';
    document.getElementById('category-breakdown').innerHTML = catHtml;

    // Sales overview chart (today vs week vs month)
    const chartValues = [s.productsSoldToday || 0, Math.round((s.productsSoldWeek || 0) / 7), s.productsSoldMonth || 0, s.productsSoldAll || 0];
    const chartMax = Math.max(...chartValues, 1);
    const chartLabels = ['Today', 'Week\n(avg/d)', 'Month', 'All Time'];
    const chartHtml = chartValues.map((v, i) => {
      const height = Math.max(4, (v / chartMax) * 80);
      return '<div class="sales-bar" style="height:' + height + 'px">' +
        '<span class="sales-bar-value">' + v + '</span>' +
        '<span class="sales-bar-label">' + chartLabels[i] + '</span>' +
        '</div>';
    }).join('');
    document.getElementById('sales-overview-chart').innerHTML = '<div class="sales-chart">' + chartHtml + '</div>';

    // Recent Orders
    const tbody = document.getElementById('overview-orders-tbody');
    tbody.innerHTML = (orders || []).map(o => `
      <tr class="clickable-row" onclick="showOrderDetail('${attrEsc(o.id)}')">
        <td><strong>#${esc(o.order_number)}</strong></td>
        <td>${esc(o.customers?.full_name || '—')}</td>
        <td>${(o.total_dzd ?? 0).toLocaleString('fr-DZ')} DZD</td>
        <td>${statusPill(o.status)}</td>
        <td>${fmtDate(o.placed_at)}</td>
        <td></td>
      </tr>
    `).join('');
  } catch { /* ignore */ }
}

// ───── Products ─────
async function loadProducts() {
  try {
    window._productsList = await fetch('/api/products').then(r => r.json());
    if (!Array.isArray(window._productsList)) throw new Error('Invalid response');
    const tbody = document.getElementById('products-tbody');
    tbody.innerHTML = window._productsList.map(p => `
      <tr>
        <td data-label="Name">${esc(p.name)}</td>
        <td data-label="Category">${esc(p.category)}</td>
        <td data-label="Price">${p.promotion ? '<span class="price-original">' + p.price_dzd?.toLocaleString('fr-DZ') + '</span> <span class="price-sale">' + Math.round(p.price_dzd * (1 - p.promotion.discount_percent / 100)).toLocaleString('fr-DZ') + '</span>' : (p.price_dzd?.toLocaleString('fr-DZ') ?? '—')} DZD</td>
        <td data-label="Badge">${p.promotion ? `<span class="pill pill-sale">-${p.promotion.discount_percent}%</span>` : (p.badge ? `<span class="pill pill-gold">${esc(p.badge)}</span>` : '—')}</td>
        <td data-label="Status">${p.is_active !== false ? '<span class="pill pill-green">Active</span>' : '<span class="pill pill-gray">Inactive</span>'}</td>
        <td data-label="Actions" class="cell-actions">
          <button class="btn-icon" onclick="editProduct('${attrEsc(p.id)}')" title="Edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon" onclick="deleteProduct('${attrEsc(p.id)}')" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) { console.error('loadProducts:', err); }
}

// ───── Image preview helpers ─────
function initImagePreviews() {
  document.querySelectorAll('.pf-image-input').forEach(input => {
    input.addEventListener('change', function() {
      const slot = this.closest('.image-upload-slot');
      const preview = slot.querySelector('.image-upload-preview');
      const file = this.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
          slot.classList.add('has-image');
        };
        reader.readAsDataURL(file);
      } else {
        preview.innerHTML = '';
        slot.classList.remove('has-image');
      }
    });
  });
  document.querySelectorAll('.image-upload-remove').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const slot = this.closest('.image-upload-slot');
      const input = slot.querySelector('.pf-image-input');
      input.value = '';
      slot.querySelector('.image-upload-preview').innerHTML = '';
      slot.classList.remove('has-image');
    });
  });
}

function resetImagePreviews() {
  document.querySelectorAll('.image-upload-slot').forEach(slot => {
    slot.querySelector('.pf-image-input').value = '';
    slot.querySelector('.image-upload-preview').innerHTML = '';
    slot.classList.remove('has-image');
  });
}

function setExistingImagePreviews(images) {
  const slots = document.querySelectorAll('.image-upload-slot');
  slots.forEach((slot, i) => {
    const preview = slot.querySelector('.image-upload-preview');
    const input = slot.querySelector('.pf-image-input');
    const cell = slot.closest('.image-upload-cell');
    const colorSelect = cell ? cell.querySelector('.image-color-select') : null;
    input.value = '';
    preview.innerHTML = '';
    slot.classList.remove('has-image');
    if (colorSelect) colorSelect.value = '';
    if (images && images[i]) {
      const imgPath = images[i].storage_path;
      preview.innerHTML = `<img src="/api/products/image/${imgPath}" alt="Product image ${i+1}">`;
      slot.classList.add('has-image');
      if (colorSelect && images[i].color_id) colorSelect.value = images[i].color_id;
    }
  });
}

// ───── Categories ─────
async function populateCategoryDropdown() {
  try {
    const token = getToken();
    const cats = await fetch('/api/admin/categories', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(r => r.json());
    const sel = document.getElementById('pf-category');
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">Select</option>';
    (cats || []).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.slug;
      opt.textContent = c.name;
      sel.appendChild(opt);
    });
    sel.value = currentVal || '';
  } catch (e) { console.error('Failed to load categories', e); }
}

async function loadCategories() {
  try {
    const token = getToken();
    const cats = await fetch('/api/admin/categories', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(r => r.json());
    const tbody = document.getElementById('categories-tbody');
    tbody.innerHTML = (cats || []).map(c => {
      const productCount = c.product_count || 0;
      const canDelete = productCount === 0;
      return '<tr>' +
        '<td>' + esc(c.name) + '</td>' +
        '<td style="font-size:11px;color:var(--warm-gray)">' + esc(c.slug) + '</td>' +
        '<td>' + productCount + '</td>' +
        '<td>' +
        (canDelete
          ? '<button class="btn btn-danger btn-sm" onclick="deleteCategory(\'' + esc(c.slug) + '\')">Delete</button>'
          : '<span style="font-size:10px;color:var(--warm-gray)">In use</span>') +
        '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--warm-gray);padding:32px">No categories found</td></tr>';
  } catch (e) { console.error('Failed to load categories', e); }
}

async function deleteCategory(slug) {
  const ok = await showConfirm('Delete category "' + slug + '"?');
  if (!ok) return;
  try {
    const token = getToken();
    const res = await fetch('/api/admin/categories/' + encodeURIComponent(slug), {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) {
      const err = await res.json();
      return alert(err.error || 'Failed to delete category');
    }
    loadCategories();
    populateCategoryDropdown();
  } catch (e) { alert(e.message); }
}

document.getElementById('cat-name').addEventListener('input', function () {
  const slugEl = document.getElementById('cat-slug');
  if (!slugEl.dataset.manuallyEdited) {
    slugEl.value = this.value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }
});
document.getElementById('cat-slug').addEventListener('input', function () {
  this.dataset.manuallyEdited = this.value !== document.getElementById('cat-name').value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') ? 'true' : '';
});

document.getElementById('category-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('cat-name').value.trim();
  const slug = document.getElementById('cat-slug').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  const errorEl = document.getElementById('cat-error');
  errorEl.textContent = '';
  if (!name || !slug) { errorEl.textContent = 'Name and slug are required'; return; }
  try {
    const token = getToken();
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ name, slug })
    });
    if (!res.ok) {
      const err = await res.json();
      return errorEl.textContent = err.error || 'Failed to add category';
    }
    document.getElementById('cat-name').value = '';
    document.getElementById('cat-slug').value = '';
    delete document.getElementById('cat-slug').dataset.manuallyEdited;
    errorEl.textContent = '';
    loadCategories();
    populateCategoryDropdown();
  } catch (err) { errorEl.textContent = err.message; }
});

// ───── Badges ─────
async function loadBadges() {
  try {
    const data = await api('/badges');
    const tbody = document.getElementById('badges-tbody');
    tbody.innerHTML = data.map(b => `
      <tr>
        <td><span class="pill pill-gold">${esc(b.name)}</span></td>
        <td>${b.product_count ?? '—'}</td>
        <td class="cell-actions">
          <button class="btn btn-danger btn-sm" onclick="deleteBadge('${b.id}','${esc(b.name)}')">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) { console.error('loadBadges:', err); }
}

async function deleteBadge(id, name) {
  if (!await showConfirm('Delete badge "' + name + '" permanently?')) return;
  try {
    await api('/badges/' + id, { method: 'DELETE' });
    loadBadges();
  } catch (err) { alert(err.message); }
}

document.getElementById('badge-form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('badge-name').value.trim();
  const errorEl = document.getElementById('badge-error');
  errorEl.textContent = '';
  if (!name) { errorEl.textContent = 'Badge name is required'; return; }
  try {
    const token = getToken();
    const res = await fetch('/api/admin/badges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ name })
    });
    if (!res.ok) {
      const err = await res.json();
      return errorEl.textContent = err.error || 'Failed to add badge';
    }
    document.getElementById('badge-name').value = '';
    errorEl.textContent = '';
    loadBadges();
    populateBadgeDropdown();
  } catch (err) { errorEl.textContent = err.message; }
});

// ───── Product form helpers ─────
async function populateBadgeDropdown() {
  const sel = document.getElementById('pf-badge');
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">None</option>';
  try {
    const data = await api('/badges');
    data.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.name;
      opt.textContent = b.name;
      sel.appendChild(opt);
    });
  } catch {}
  sel.value = currentVal;
}

function populateImageColorSelects() {
  const selects = document.querySelectorAll('.image-color-select');
  const rows = document.querySelectorAll('#colorPalette .color-palette-row:not([data-template])');
  const colors = Array.from(rows).map((row, idx) => ({
    id: row.dataset.colorId || '__new_' + idx,
    name: row.querySelector('.cp-name').value,
    isNew: !row.dataset.colorId
  }));
  selects.forEach(sel => {
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">Any color</option>';
    colors.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name + (c.isNew ? '' : '');
      sel.appendChild(opt);
    });
    sel.value = currentVal;
  });
}

let editingProductId = null;

async function editProduct(id) {
  editingProductId = id;
  const product = (window._productsList || []).find(p => String(p.id) === String(id));
  if (!product) return;
  await populateCategoryDropdown();
  await populateBadgeDropdown();
  document.getElementById('pf-id').value = id;
  document.getElementById('pf-name').value = product.name || '';
  document.getElementById('pf-slug').value = product.slug || '';
  document.getElementById('pf-slug').dataset.manuallyEdited = 'true';
  document.getElementById('pf-category').value = product.category || '';
  document.getElementById('pf-price').value = product.price_dzd || '';
  document.getElementById('pf-fabric').value = product.fabric || '';
  document.getElementById('pf-badge').value = product.badge || '';
  const sizes = (product.sizes || []);
  document.getElementById('pf-sizes').value = Array.isArray(sizes) ? sizes.join(', ') : sizes;
  document.getElementById('pf-description').value = product.description || '';
  document.getElementById('product-form-title').textContent = 'Edit Product';
  document.getElementById('product-form-submit').textContent = 'Update';
  document.getElementById('product-form-container').classList.remove('hidden');
  try {
    const detail = await fetch(`/api/products/${product.slug}`).then(r => r.json());
    setExistingImagePreviews(detail.images || []);
  } catch {
    setExistingImagePreviews([]);
  }
  try { initImagePreviews(); } catch (e) { console.error(e); }
  await loadColors(id);
  populateImageColorSelects();
  loadPromotion(id);
  renderSizeToggles(sizes, product.unavailable_sizes || []);
}

async function deleteProduct(id) {
  if (!await showConfirm('Delete this product permanently?')) return;
  try {
    await api('/products/' + id, { method: 'DELETE' });
    await loadProducts();
  } catch (err) { alert(err.message); }
}

document.getElementById('pf-name').addEventListener('input', function () {
  const slugEl = document.getElementById('pf-slug');
  if (!slugEl.dataset.manuallyEdited) {
    slugEl.value = this.value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }
});
document.getElementById('pf-slug').addEventListener('input', function () {
  this.dataset.manuallyEdited = this.value !== document.getElementById('pf-name').value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') ? 'true' : '';
});

document.getElementById('add-product-btn').addEventListener('click', () => {
  editingProductId = null;
  document.getElementById('product-form').reset();
  document.getElementById('pf-id').value = '';
  delete document.getElementById('pf-slug').dataset.manuallyEdited;
  document.getElementById('product-form-title').textContent = 'Add Product';
  document.getElementById('product-form-submit').textContent = 'Save';
  document.getElementById('product-form-container').classList.remove('hidden');
  resetImagePreviews();
  resetColorPalette();
  populateImageColorSelects();
  populateCategoryDropdown();
  populateBadgeDropdown();
  try { initImagePreviews(); } catch (e) { console.error(e); }
});

document.getElementById('product-form-cancel').addEventListener('click', () => {
  document.getElementById('product-form-container').classList.add('hidden');
  resetColorPalette();
});

function getFormFiles() {
  const files = [];
  document.querySelectorAll('.pf-image-input').forEach(input => {
    if (input.files[0]) files.push(input.files[0]);
  });
  return files;
}

document.getElementById('product-form').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('pf-id').value;
  const token = getToken();
  const fd = new FormData();
  fd.append('name', document.getElementById('pf-name').value.trim());
  fd.append('slug', document.getElementById('pf-slug').value.trim());
  fd.append('category', document.getElementById('pf-category').value);
  fd.append('price_dzd', Number(document.getElementById('pf-price').value));
  const fabric = document.getElementById('pf-fabric').value.trim();
  if (fabric) fd.append('fabric', fabric);
  const badge = document.getElementById('pf-badge').value;
  if (badge) fd.append('badge', badge);
  const sizesArr = document.getElementById('pf-sizes').value.split(',').map(s => s.trim()).filter(Boolean);
  fd.append('sizes', JSON.stringify(sizesArr));
  const desc = document.getElementById('pf-description').value.trim();
  if (desc) fd.append('description', desc);
  const unavailSizes = [];
  document.querySelectorAll('.size-toggle.unavailable').forEach(b => unavailSizes.push(b.dataset.size));
  if (unavailSizes.length > 0) fd.append('unavailable_sizes', JSON.stringify(unavailSizes));
  const files = getFormFiles();
  files.forEach(f => fd.append('images', f));
  const imageColors = [];
  document.querySelectorAll('.pf-image-input').forEach(input => {
    if (input.files[0]) {
      const slot = input.closest('.image-upload-slot');
      const cell = slot.closest('.image-upload-cell');
      const colorSelect = cell ? cell.querySelector('.image-color-select') : null;
      imageColors.push(colorSelect ? colorSelect.value : '');
    }
  });
  if (imageColors.length) fd.append('image_colors', JSON.stringify(imageColors));
  const method = id ? 'PUT' : 'POST';
  const url = API + '/products' + (id ? '/' + id : '');
  try {
    const res = await fetch(url, {
      method,
      headers: token ? { 'Authorization': 'Bearer ' + token } : {},
      body: fd
    });
    if (res.status === 401) { logout(); throw new Error('Session expired'); }
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Request failed'); }
    // Save unsaved colors
    const result = await res.json().catch(() => ({}));
    const productId = result?.id || id;
    const rows = document.querySelectorAll('#colorPalette .color-palette-row:not([data-template])');
    for (const row of rows) {
      if (!row.dataset.colorId) {
        const name = row.querySelector('.cp-name').value.trim();
        const hex = row.querySelector('.cp-hex').value;
        try {
          const color = await api('/products/' + productId + '/colors', {
            method: 'POST',
            body: JSON.stringify({ color_name: name || 'New Color', color_hex: hex })
          });
          if (color?.id) row.dataset.colorId = color.id;
        } catch {}
      }
    }
    document.getElementById('product-form-container').classList.add('hidden');
    await loadProducts();
  } catch (err) { alert(err.message); }
});

// ───── Products search ─────
function filterProducts() {
  const q = document.getElementById('products-search').value.toLowerCase().trim();
  const rows = document.querySelectorAll('#products-tbody tr');
  rows.forEach(row => {
    const cell = row.querySelector('td');
    const name = cell ? cell.textContent.toLowerCase() : '';
    row.style.display = q && !name.includes(q) ? 'none' : '';
  });
}

// ───── Color Palette ─────

function resetColorPalette() {
  const container = document.getElementById('colorPalette');
  container.querySelectorAll('.color-palette-row:not([data-template])').forEach(el => el.remove());
}

function addColorRow(name, hex, id) {
  const container = document.getElementById('colorPalette');
  const template = container.querySelector('[data-template]');
  const row = template.cloneNode(true);
  row.removeAttribute('data-template');
  row.style.display = '';
  const nameInput = row.querySelector('.cp-name');
  const hexInput = row.querySelector('.cp-hex');
  nameInput.value = name || '';
  hexInput.value = hex || '#1A1A18';
  if (id) row.dataset.colorId = id;
  nameInput.addEventListener('blur', async function() {
    const cid = row.dataset.colorId;
    if (cid && editingProductId) {
      try { await api('/products/' + editingProductId + '/colors/' + cid, { method: 'PUT', body: JSON.stringify({ color_name: this.value.trim(), color_hex: hexInput.value }) }); } catch {}
    }
    populateImageColorSelects();
  });
  hexInput.addEventListener('change', async function() {
    const cid = row.dataset.colorId;
    if (cid && editingProductId) {
      try { await api('/products/' + editingProductId + '/colors/' + cid, { method: 'PUT', body: JSON.stringify({ color_name: nameInput.value.trim(), color_hex: this.value }) }); } catch {}
    }
    populateImageColorSelects();
  });
  const removeBtn = row.querySelector('.cp-remove');
  removeBtn.addEventListener('click', async () => {
    const cid = row.dataset.colorId;
    if (cid && editingProductId) {
      try {
        await api('/products/' + editingProductId + '/colors/' + cid, { method: 'DELETE' });
      } catch (err) { alert(err.message); return; }
    }
    row.remove();
    populateImageColorSelects();
  });
  container.appendChild(row);
  populateImageColorSelects();
}

async function loadColors(productId) {
  resetColorPalette();
  if (!productId) return;
  try {
    const colors = await api('/products/' + productId + '/colors');
    colors.forEach(c => addColorRow(c.color_name, c.color_hex, c.id));
  } catch {}
}

document.getElementById('addColorBtn').addEventListener('click', async () => {
  const pid = document.getElementById('pf-id').value;
  if (pid) {
    try {
      const color = await api('/products/' + pid + '/colors', {
        method: 'POST',
        body: JSON.stringify({ color_name: 'New Color', color_hex: '#C9A84C' })
      });
      addColorRow(color.color_name, color.color_hex, color.id);
      populateImageColorSelects();
    } catch (err) { alert(err.message); }
  } else {
    addColorRow('New Color', '#C9A84C');
    populateImageColorSelects();
  }
});

// ───── Size Availability ─────
function renderSizeToggles(sizes, unavailableSizes) {
  const container = document.getElementById('sizeToggles');
  const field = document.getElementById('size-availability-field');
  if (!sizes || sizes.length === 0) { field.style.display = 'none'; return; }
  field.style.display = '';
  container.innerHTML = sizes.map(s => {
    const isUnavail = (unavailableSizes || []).includes(s);
    return '<button type="button" class="size-toggle' + (isUnavail ? ' unavailable' : '') + '" data-size="' + s + '">' + s + '</button>';
  }).join('');
  container.querySelectorAll('.size-toggle').forEach(btn => {
    btn.addEventListener('click', async function () {
      const pid = document.getElementById('pf-id').value;
      if (!pid) return;
      const size = this.dataset.size;
      const wasUnavailable = this.classList.contains('unavailable');
      this.classList.toggle('unavailable');
      const currentUnavailable = [];
      container.querySelectorAll('.size-toggle.unavailable').forEach(b => currentUnavailable.push(b.dataset.size));
      try {
        await api('/products/' + pid, {
          method: 'PUT',
          body: JSON.stringify({ unavailable_sizes: currentUnavailable }),
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) { console.error('save size availability:', err); }
    });
  });
}

document.getElementById('pf-sizes').addEventListener('input', function () {
  const pid = document.getElementById('pf-id').value;
  if (!pid) { document.getElementById('size-availability-field').style.display = 'none'; return; }
  const sizesArr = this.value.split(',').map(s => s.trim()).filter(Boolean);
  renderSizeToggles(sizesArr, []);
});

// ───── Product Promotions ─────
async function loadPromotion(productId) {
  try {
    const promo = await api('/products/' + productId + '/promotion');
    document.getElementById('removePromoBtn').style.display = promo ? '' : 'none';
    document.getElementById('pf-promo-discount').value = promo ? promo.discount_percent : '';
    document.getElementById('pf-promo-start').value = promo && promo.start_date ? promo.start_date.slice(0,10) : '';
    document.getElementById('pf-promo-end').value = promo && promo.end_date ? promo.end_date.slice(0,10) : '';
    document.getElementById('pf-promo-active').checked = promo ? promo.is_active : true;
  } catch { /* no promotion */ }
}

async function savePromotion() {
  const pid = document.getElementById('pf-id').value;
  if (!pid) return;
  const discount = parseInt(document.getElementById('pf-promo-discount').value, 10);
  if (!discount || discount < 1 || discount > 100) return;
  try {
    const result = await api('/products/' + pid + '/promotion', {
      method: 'PUT',
      body: JSON.stringify({
        discount_percent: discount,
        start_date: document.getElementById('pf-promo-start').value || null,
        end_date: document.getElementById('pf-promo-end').value || null,
        is_active: document.getElementById('pf-promo-active').checked
      })
    });
    document.getElementById('removePromoBtn').style.display = '';
  } catch (err) { console.error('save promotion:', err); }
}

document.getElementById('pf-promo-discount').addEventListener('change', savePromotion);
document.getElementById('pf-promo-start').addEventListener('change', savePromotion);
document.getElementById('pf-promo-end').addEventListener('change', savePromotion);
document.getElementById('pf-promo-active').addEventListener('change', savePromotion);

document.getElementById('removePromoBtn').addEventListener('click', async function () {
  const pid = document.getElementById('pf-id').value;
  if (!pid) return;
  if (!await showConfirm('Remove this promotion?')) return;
  try {
    await api('/products/' + pid + '/promotion', { method: 'DELETE' });
    document.getElementById('pf-promo-discount').value = '';
    document.getElementById('pf-promo-start').value = '';
    document.getElementById('pf-promo-end').value = '';
    document.getElementById('pf-promo-active').checked = true;
    this.style.display = 'none';
  } catch (err) { alert('Failed to remove promotion: ' + err.message); }
});

// ───── Orders ─────
let ordersSearchTimeout;
let ordersDaysFilter = '';

function setDaysFilter(btn, days) {
  ordersDaysFilter = days;
  document.querySelectorAll('#orders-filter-bar .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const q = document.getElementById('orders-search').value.trim();
  if (q) {
    searchOrders();
  } else {
    loadOrders();
  }
}

function ordersUrl() {
  const params = [];
  if (ordersDaysFilter) params.push('days=' + ordersDaysFilter);
  return params.length ? '?' + params.join('&') : '';
}

async function loadOrders() {
  try {
    const data = await api('/orders' + ordersUrl());
    const tbody = document.getElementById('orders-tbody');
    tbody.innerHTML = data.map(o => `
      <tr class="clickable-row" onclick="showOrderDetail('${attrEsc(o.id)}')">
        <td data-label="Order"><strong>#${esc(o.order_number)}</strong></td>
        <td data-label="Customer">${esc(o.customers?.full_name || '—')}<br><span style="font-size:10px;color:#8A8478">${esc(o.customers?.phone || '')}</span></td>
        <td data-label="Total">${(o.total_dzd ?? 0).toLocaleString('fr-DZ')} DZD</td>
        <td data-label="Status">${statusPill(o.status)}</td>
        <td data-label="Date">${fmtDate(o.placed_at)}</td>
        <td data-label="" class="cell-actions">
          <button class="btn-icon" onclick="event.stopPropagation(); deleteOrder('${attrEsc(o.id)}')" title="Delete" style="color:var(--error)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </td>
      </tr>
    `).join('');
  } catch (err) { console.error('loadOrders:', err); }
}

function statusPill(s) {
  const map = { pending: 'pill-gold', confirmed: 'pill-charcoal', shipped: 'pill-green', delivered: 'pill-green', returned: 'pill-red', cancelled: 'pill-red' };
  return `<span class="pill ${map[s] || 'pill-gray'}">${esc(s)}</span>`;
}

// ───── Orders search ─────
function searchOrders() {
  clearTimeout(ordersSearchTimeout);
  ordersSearchTimeout = setTimeout(async () => {
    const q = document.getElementById('orders-search').value.trim();
    const params = [];
    if (q) params.push('q=' + encodeURIComponent(q));
    if (ordersDaysFilter) params.push('days=' + ordersDaysFilter);
    const qs = params.length ? '?' + params.join('&') : '';
    try {
      const data = await api('/orders/search' + qs);
      const tbody = document.getElementById('orders-tbody');
      tbody.innerHTML = data.map(o => `
        <tr class="clickable-row" onclick="showOrderDetail('${attrEsc(o.id)}')">
          <td data-label="Order"><strong>#${esc(o.order_number)}</strong></td>
          <td data-label="Customer">${esc(o.customers?.full_name || '—')}<br><span style="font-size:10px;color:#8A8478">${esc(o.customers?.phone || '')}</span></td>
          <td data-label="Total">${(o.total_dzd ?? 0).toLocaleString('fr-DZ')} DZD</td>
          <td data-label="Status">${statusPill(o.status)}</td>
          <td data-label="Date">${fmtDate(o.placed_at)}</td>
          <td data-label="" class="cell-actions">
            <button class="btn-icon" onclick="event.stopPropagation(); deleteOrder('${attrEsc(o.id)}')" title="Delete" style="color:var(--error)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
          </td>
        </tr>
      `).join('');
    } catch (err) { console.error('searchOrders:', err); }
  }, 250);
}

async function deleteOrder(id) {
  if (!id) id = _currentOrderId;
  if (!id) return;
  if (!await showConfirm('Delete this order permanently?')) return;
  try {
    await api('/orders/' + id, { method: 'DELETE' });
    closeDrawer();
    await loadOrders();
  } catch (err) { alert(err.message); }
}

// ───── Drawer ─────
let _currentOrderId = null;

async function openDrawer(id) {
  _currentOrderId = id;
  try {
    const order = await api('/orders/' + id);
    document.getElementById('drawer-order-number').textContent = '#' + order.order_number;
    document.getElementById('drawer-customer').textContent = order.customers?.full_name || '—';
    document.getElementById('drawer-phone').textContent = order.customers?.phone || '—';
    document.getElementById('drawer-email').textContent = order.customers?.email || '—';
    document.getElementById('drawer-delivery-type').textContent = order.delivery_type === 'home' ? 'À domicile' : order.delivery_type === 'office' ? 'Bureau de livraison' : '—';
    document.getElementById('drawer-wilaya').textContent = order.delivery_wilaya || '—';
    document.getElementById('drawer-commune').textContent = order.delivery_commune || '—';
    document.getElementById('drawer-address').textContent = order.delivery_address || '—';
    document.getElementById('drawer-subtotal').textContent = (order.subtotal_dzd ?? 0).toLocaleString('fr-DZ') + ' DZD';
    document.getElementById('drawer-total').textContent = (order.total_dzd ?? 0).toLocaleString('fr-DZ') + ' DZD';
    document.getElementById('drawer-fee').textContent = (order.delivery_fee_dzd ?? 0).toLocaleString('fr-DZ') + ' DZD';
    document.getElementById('drawer-method').textContent = order.payment_method || 'COD';
    document.getElementById('drawer-notes').textContent = order.notes || '—';
    document.getElementById('drawer-status').value = order.status || 'pending';
    document.getElementById('drawer-status').dataset.orderId = order.id;
    const itemsEl = document.getElementById('drawer-items');
    itemsEl.innerHTML = (order.items || []).map(item => `
      <tr>
        <td>${item.image_url ? '<img src="' + item.image_url + '" alt="" style="width:40px;height:50px;object-fit:cover;border-radius:4px;display:block">' : '<span style="color:#8A8478;font-size:10px">—</span>'}</td>
        <td>${esc(item.product_name || item.name || '')}</td>
        <td>${esc(item.size || '—')}${item.color ? '<br><span style="font-size:9px;color:var(--warm-gray);display:flex;align-items:center;gap:4px;margin-top:2px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;border:1px solid var(--border);flex-shrink:0;background:' + (item.color_hex || '#ccc') + '"></span>' + esc(item.color) + '</span>' : ''}</td>
        <td>${item.quantity ?? 1}</td>
        <td>${(item.unit_price_dzd ?? 0).toLocaleString('fr-DZ')} DZD</td>
      </tr>
    `).join('');
    document.getElementById('drawer-overlay').classList.add('open');
    document.getElementById('drawer').classList.add('open');
  } catch (err) { console.error(err); }
}

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.remove('open');
  document.getElementById('drawer').classList.remove('open');
}

// ───── Order Detail Page ─────
function showOrdersPage() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-orders').classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector('[data-page="orders"]').classList.add('active');
  clearOrderNotification();
  loadOrders();
}

async function showOrderDetail(id) {
  try {
    const order = await api('/orders/' + id);
    _currentOrderId = id;
    document.getElementById('odetail-number').textContent = '#' + order.order_number;
    document.getElementById('odetail-customer').textContent = order.customers?.full_name || '—';
    document.getElementById('odetail-phone').textContent = order.customers?.phone || '—';
    document.getElementById('odetail-email').textContent = order.customers?.email || '—';
    document.getElementById('odetail-delivery-type').textContent = order.delivery_type === 'home' ? 'À domicile' : order.delivery_type === 'office' ? 'Bureau de livraison' : '—';
    document.getElementById('odetail-wilaya').textContent = order.delivery_wilaya || '—';
    document.getElementById('odetail-commune').textContent = order.delivery_commune || '—';
    document.getElementById('odetail-address').textContent = order.delivery_address || '—';
    document.getElementById('odetail-subtotal').textContent = (order.subtotal_dzd ?? 0).toLocaleString('fr-DZ') + ' DZD';
    document.getElementById('odetail-fee').textContent = (order.delivery_fee_dzd ?? 0).toLocaleString('fr-DZ') + ' DZD';
    document.getElementById('odetail-total').textContent = (order.total_dzd ?? 0).toLocaleString('fr-DZ') + ' DZD';
    document.getElementById('odetail-method').textContent = order.payment_method || 'COD';
    document.getElementById('odetail-notes').textContent = order.notes || '—';
    document.getElementById('odetail-status').value = order.status || 'pending';
    document.getElementById('odetail-status').dataset.orderId = order.id;
    const itemsEl = document.getElementById('odetail-items');
    itemsEl.innerHTML = (order.items || []).map(item => `
      <tr>
        <td>${item.image_url ? '<img src="' + item.image_url + '" alt="" style="width:40px;height:50px;object-fit:cover;border-radius:4px;display:block">' : '<span style="color:#8A8478;font-size:10px">—</span>'}</td>
        <td>${esc(item.product_name || item.name || '')}</td>
        <td>${esc(item.size || '—')}${item.color ? '<br><span style="font-size:9px;color:var(--warm-gray);display:flex;align-items:center;gap:4px;margin-top:2px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;border:1px solid var(--border);flex-shrink:0;background:' + (item.color_hex || '#ccc') + '"></span>' + esc(item.color) + '</span>' : ''}</td>
        <td>${item.quantity ?? 1}</td>
        <td>${(item.unit_price_dzd ?? 0).toLocaleString('fr-DZ')} DZD</td>
      </tr>
    `).join('');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-order-detail').classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  } catch (err) { alert('Failed to load order: ' + err.message); }
}

document.getElementById('drawer-overlay').addEventListener('click', closeDrawer);

document.getElementById('drawer-status').addEventListener('change', async e => {
  const status = e.target.value;
  const orderId = e.target.dataset.orderId;
  try {
    await api('/orders/' + orderId + '/status', {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    await loadOrders();
  } catch (err) { alert(err.message); }
});

document.getElementById('odetail-status').addEventListener('change', async e => {
  const status = e.target.value;
  const orderId = e.target.dataset.orderId;
  try {
    await api('/orders/' + orderId + '/status', {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  } catch (err) { alert(err.message); }
});

document.getElementById('odetail-delete-btn').addEventListener('click', async () => {
  const id = _currentOrderId;
  if (!id) return;
  if (!await showConfirm('Delete this order permanently?')) return;
  try {
    await api('/orders/' + id, { method: 'DELETE' });
    showOrdersPage();
  } catch (err) { alert(err.message); }
});

// ───── Top Products ─────
async function loadTopProducts(range) {
  document.querySelectorAll('#page-top-products .filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.range === range);
  });
  const container = document.getElementById('top-products-list-page');
  container.innerHTML = '<p style="font-size:12px;color:var(--warm-gray)">Loading...</p>';
  try {
    const res = await fetch(API + '/top-products?range=' + range, {
      headers: getToken() ? { 'Authorization': 'Bearer ' + getToken() } : {}
    });
    if (res.status === 401) { logout(); return; }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = '<p style="font-size:12px;color:var(--warm-gray)">No products sold in this period.</p>';
      return;
    }
    const totalQty = data.reduce((s, p) => s + p.qty, 0);
    const maxQty = data[0].qty;
    container.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px">' + data.map((p, i) => {
      const barPct = Math.max(4, (p.qty / maxQty) * 100);
      return '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--ivory-deep);border:1px solid var(--border);border-radius:8px">' +
        '<span style="width:24px;height:24px;border-radius:50%;background:var(--gold);color:var(--charcoal);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;flex-shrink:0">' + (i + 1) + '</span>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:13px;font-weight:500;color:var(--charcoal);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(p.name) + '</div>' +
          '<div style="margin-top:4px;height:16px;background:var(--ivory);border-radius:4px;overflow:hidden">' +
            '<div style="height:100%;width:' + barPct + '%;background:var(--gold);border-radius:4px;transition:width 0.4s ease"></div>' +
          '</div>' +
        '</div>' +
        '<div style="text-align:right;flex-shrink:0">' +
          '<div style="font-size:15px;font-weight:600;color:var(--charcoal)">' + p.qty + '</div>' +
          '<div style="font-size:10px;color:var(--warm-gray)">' + (p.revenue || 0).toLocaleString('fr-DZ') + ' DZD</div>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  } catch (err) {
    container.innerHTML = '<p style="font-size:12px;color:var(--error)">Failed to load.</p>';
    console.error('loadTopProducts:', err);
  }
}

// ───── Contact ─────
async function loadContacts() {
  try {
    const data = await api('/contact');
    const tbody = document.getElementById('contact-tbody');
    tbody.innerHTML = data.map(c => `
      <tr>
        <td>${esc(c.name)}</td>
        <td>${esc(c.phone)}</td>
        <td>${esc(c.email || '—')}</td>
        <td style="max-width:260px;white-space:normal;word-break:break-word">${esc(c.message)}</td>
        <td>${fmtDate(c.created_at)}</td>
        <td><button class="btn-icon" onclick="deleteContact('${c.id}')" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></td>
      </tr>
    `).join('');
  } catch (err) { console.error('loadContacts:', err); }
}

async function deleteContact(id) {
  if (!await showConfirm('Delete this message?')) return;
  try {
    await api('/contact/' + id, { method: 'DELETE' });
    await loadContacts();
  } catch (err) { alert(err.message); }
}

// ───── Audit Log ─────
let _auditPage = 1;
let _auditTotalPages = 1;

async function clearAuditLog() {
  if (!await showConfirm('Delete all activity logs permanently?')) return;
  try {
    const res = await fetch(API + '/audit-logs', {
      method: 'DELETE',
      headers: getToken() ? { 'Authorization': 'Bearer ' + getToken() } : {}
    });
    if (res.status === 401) { logout(); return; }
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
    _auditPage = 1;
    loadAuditLogs();
  } catch (err) { alert(err.message); }
}

async function loadAuditLogs() {
  try {
    const action = document.getElementById('audit-action-filter').value;
    const params = new URLSearchParams({ page: _auditPage, limit: 30 });
    if (action) params.set('action', action);

    const res = await fetch(API + '/audit-logs?' + params, {
      headers: getToken() ? { 'Authorization': 'Bearer ' + getToken() } : {}
    });
    if (res.status === 401) { logout(); return; }
    const data = await res.json();

    _auditTotalPages = parseInt(res.headers.get('X-Pagination-Pages') || '1', 10);
    const total = parseInt(res.headers.get('X-Pagination-Total') || '0', 10);

    document.getElementById('audit-count').textContent = total + ' entries';

    document.getElementById('audit-prev').disabled = _auditPage <= 1;
    document.getElementById('audit-next').disabled = _auditPage >= _auditTotalPages;
    document.getElementById('audit-page-info').textContent = 'Page ' + _auditPage + ' of ' + _auditTotalPages;

    const tbody = document.getElementById('audit-tbody');
    tbody.innerHTML = (data.data || []).map(log => {
      const details = log.details ? JSON.stringify(log.details.body || log.details) : '—';
      return '<tr>' +
        '<td style="white-space:nowrap">' + fmtDate(log.created_at) + '</td>' +
        '<td>' + esc(log.admin_email) + '</td>' +
        '<td><span class="pill ' + actionPillClass(log.action) + '">' + esc(log.action) + '</span></td>' +
        '<td>' + esc(log.resource) + '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--warm-gray);padding:32px">No activity logged yet</td></tr>';

    // Populate filter dropdown
    if (data.actions && data.actions.length > 0) {
      const select = document.getElementById('audit-action-filter');
      const currentVal = select.value;
      const existing = new Set();
      select.querySelectorAll('option').forEach(o => existing.add(o.value));
      data.actions.forEach(a => {
        if (!existing.has(a)) {
          const opt = document.createElement('option');
          opt.value = a;
          opt.textContent = a;
          select.appendChild(opt);
          existing.add(a);
        }
      });
      select.value = currentVal;
    }
  } catch (err) { console.error('loadAuditLogs:', err); }
}

function auditPage(delta) {
  _auditPage = Math.max(1, Math.min(_auditTotalPages, _auditPage + delta));
  loadAuditLogs();
}

function actionPillClass(action) {
  const map = {
    create: 'pill-green',
    update: 'pill-gold',
    delete: 'pill-red'
  };
  return map[action] || 'pill-gray';
}

// ───── Profile ─────
async function loadProfile() {
  try {
    const res = await fetch(API + '/profile', {
      headers: getToken() ? { 'Authorization': 'Bearer ' + getToken() } : {}
    });
    if (res.status === 401) { logout(); return; }
    const data = await res.json();
    document.getElementById('profile-current-email').value = data.email || '';
  } catch (err) { console.error('loadProfile:', err); }
}

document.getElementById('profile-form').addEventListener('submit', async e => {
  e.preventDefault();
  const statusEl = document.getElementById('profile-status');
  statusEl.textContent = 'Saving...';
  statusEl.style.color = 'var(--warm-gray)';
  const body = {
    current_password: document.getElementById('profile-current-pwd').value,
    new_email: document.getElementById('profile-email').value.trim() || undefined,
    new_password: document.getElementById('profile-new-pwd').value || undefined
  };
  try {
    const res = await fetch(API + '/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(getToken() ? { 'Authorization': 'Bearer ' + getToken() } : {}) },
      body: JSON.stringify(body)
    });
    if (res.status === 401) { logout(); return; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');
    statusEl.textContent = data.message || 'Profile updated!';
    statusEl.style.color = '#2E7D32';
    document.getElementById('profile-current-email').value = data.email || document.getElementById('profile-email').value || '';
    document.getElementById('profile-current-pwd').value = '';
    document.getElementById('profile-new-pwd').value = '';
    document.getElementById('profile-email').value = '';
    if (data.token) { setToken(data.token); }
  } catch (err) { statusEl.textContent = err.message; statusEl.style.color = 'var(--error)'; }
});

// ───── Dashboard init ─────
function initDashboard() {
  _auditPage = 1;
  loadStats();
  loadProducts();
  loadOrders();
  loadContacts();
  startPolling();
}

// ───── Confirm Modal ─────
function showConfirm(message) {
  return new Promise(resolve => {
    const overlay = document.getElementById('confirm-overlay');
    const modal = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('confirm-message');
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');
    const titleEl = document.getElementById('confirm-title');

    msgEl.textContent = message;
    titleEl.textContent = message.length > 40 ? message.slice(0, 40) + '…' : message;
    okBtn.textContent = 'Delete';
    okBtn.className = 'btn btn-danger';

    overlay.classList.add('open');
    modal.classList.add('open');

    function cleanup(result) {
      overlay.classList.remove('open');
      modal.classList.remove('open');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlay);
      resolve(result);
    }

    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onOverlay() { cleanup(false); }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlay);
  });
}

// ───── Utilities ─────
function esc(s) {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

function attrEsc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ───── Polling & Notifications ─────
let _pollTimer = null;
let _latestOrderAt = null;
let _pendingCount = 0;
let _newOrders = [];

function saveNotificationState() {
  try {
    localStorage.setItem('nt_latestOrderAt', _latestOrderAt || '');
    localStorage.setItem('nt_pendingCount', String(_pendingCount));
  } catch {}
}

function loadNotificationState() {
  try {
    const count = parseInt(localStorage.getItem('nt_pendingCount'), 10);
    const time = localStorage.getItem('nt_latestOrderAt');
    if (count > 0 && time) {
      _pendingCount = count;
      _latestOrderAt = time;
    }
  } catch {}
}

async function startPolling() {
  if (_pollTimer) clearInterval(_pollTimer);
  loadNotificationState();
  if (_pendingCount > 0 && _latestOrderAt) {
    const badge = document.getElementById('bell-badge');
    badge.textContent = _pendingCount;
    badge.style.display = '';
    try {
      const res = await api('/orders/new?since=' + encodeURIComponent(_latestOrderAt));
      if (res && res.length > 0) {
        _newOrders = res;
        _pendingCount += res.length;
        _latestOrderAt = res[0].placed_at;
        saveNotificationState();
        badge.textContent = _pendingCount;
      }
      if (_newOrders.length === 0) {
        const recent = await api('/orders?limit=' + _pendingCount);
        if (recent && recent.length > 0) {
          _newOrders = recent;
        }
      }
    } catch {}
  } else {
    await refreshLatestTime();
  }
  _pollTimer = setInterval(pollForNewOrders, 12000);
}

async function refreshLatestTime() {
  try {
    const data = await api('/orders?limit=1');
    _latestOrderAt = (data && data[0] && data[0].placed_at) ? data[0].placed_at : new Date(0).toISOString();
  } catch (err) { console.error('refreshLatestTime:', err); }
}

async function pollForNewOrders() {
  try {
    const data = await api('/orders/new?since=' + encodeURIComponent(_latestOrderAt));
    if (data && data.length > 0) {
      _newOrders = data;
      _pendingCount += data.length;
      _latestOrderAt = data[0].placed_at;
      saveNotificationState();
      const badge = document.getElementById('bell-badge');
      badge.textContent = _pendingCount;
      badge.style.display = '';
      showNewOrderToast(data.length);
      const active = document.querySelector('.page.active');
      if (active) {
        if (active.id === 'page-orders') {
          clearOrderNotification();
          const q = document.getElementById('orders-search').value.trim();
          if (q) searchOrders(); else loadOrders();
        } else if (active.id === 'page-overview') {
          loadStats();
        }
      }
    }
  } catch (err) { console.error('pollForNewOrders:', err); }
}

function clearOrderNotification() {
  _pendingCount = 0;
  _newOrders = [];
  try {
    localStorage.removeItem('nt_pendingCount');
    localStorage.removeItem('nt_latestOrderAt');
  } catch {}
  document.getElementById('bell-badge').style.display = 'none';
  hideNotificationDropdown();
}

function hideNotificationDropdown() {
  const dd = document.getElementById('notification-dropdown');
  dd.style.display = 'none';
  dd.innerHTML = '';
}

function buildNotificationDropdown() {
  const dd = document.getElementById('notification-dropdown');
  if (_newOrders.length === 0 && _pendingCount > 0) {
    dd.innerHTML = '<div class="notification-dropdown-header">Nouvelles commandes<span class="bell-badge" style="position:static;display:inline-flex;margin-left:8px;font-size:9px">' + _pendingCount + '</span><button class="notification-reset" id="notification-reset-btn">Vider</button></div><div class="notification-dropdown-empty">Rafraîchissez la page pour voir les détails</div>';
    const resetBtn = dd.querySelector('#notification-reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      clearOrderNotification();
      hideNotificationDropdown();
    });
    return;
  }
  if (_newOrders.length === 0) {
    dd.innerHTML = '<div class="notification-dropdown-header">Notifications</div><div class="notification-dropdown-empty">Aucune nouvelle notification</div>';
    return;
  }
  const badges = _pendingCount > 0 ? '<span class="bell-badge" style="position:static;display:inline-flex;margin-left:8px;font-size:9px">' + _pendingCount + '</span>' : '';
  let html = '<div class="notification-dropdown-header">' +
    'Nouvelles commandes' + badges +
    '<button class="notification-reset" id="notification-reset-btn">Vider</button>' +
    '</div>';
  _newOrders.forEach(o => {
    const products = (o.items || []).map(it => esc(it.product_name || it.name || 'Article')).join(', ');
    const text = products ? esc(o.customers?.full_name || '—') + ' a commandé : ' + products : 'Commande #' + esc(o.order_number) + ' — ' + esc(o.customers?.full_name || '—');
    html += '<div class="notification-dropdown-item" data-order-id="' + o.id + '">' +
      '<div class="notification-item-title">#' + esc(o.order_number) + '</div>' +
      '<div class="notification-item-text">' + text + '</div>' +
      '<div class="notification-item-time">' + fmtDate(o.placed_at) + '</div>' +
      '</div>';
  });
  dd.innerHTML = html;
  dd.querySelectorAll('.notification-dropdown-item').forEach(el => {
    el.addEventListener('click', function () {
      const id = this.dataset.orderId;
      hideNotificationDropdown();
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelector('[data-page="orders"]').classList.add('active');
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-orders').classList.add('active');
      loadOrders();
      openDrawer(id);
    });
  });
  const resetBtn = document.getElementById('notification-reset-btn');
  if (resetBtn) resetBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    clearOrderNotification();
    hideNotificationDropdown();
  });
}

function showNotificationDropdown() {
  const dd = document.getElementById('notification-dropdown');
  if (dd.style.display === 'block') {
    hideNotificationDropdown();
    return;
  }
  buildNotificationDropdown();
  dd.style.display = 'block';
}

document.getElementById('floating-bell').addEventListener('click', showNotificationDropdown);

document.addEventListener('click', function (e) {
  const dd = document.getElementById('notification-dropdown');
  const wrapper = document.querySelector('.bell-wrapper');
  if (dd.style.display === 'block' && wrapper && !wrapper.contains(e.target)) {
    hideNotificationDropdown();
  }
});

function showNewOrderToast(count) {
  const old = document.querySelector('.order-toast');
  if (old) old.remove();
  const toast = document.createElement('div');
  toast.className = 'order-toast';
  toast.textContent = count + ' new order' + (count > 1 ? 's' : '') + ' received';
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// ───── Forgot/Reset links in login footer ═════
// Show 'Forgot password?' link on login screen
// The link shows in the login card HTML already.
// Also add "Reset password" link near the "Forgot password?" link

(function() {
  // Add a small "Forgot?" link that goes to forgot screen
  const loginCard = document.querySelector('#login-screen .login-card');
  if (loginCard) {
    const link = document.createElement('div');
    link.style.cssText = 'margin-top:20px;display:flex;justify-content:center;gap:16px;font-size:11px';
    link.innerHTML = '<a href="#" id="forgot-link-inline" style="color:#8A8478;text-decoration:none">Forgot password?</a>'
      + '<a href="#" id="reset-link-inline" style="color:#8A8478;text-decoration:none">Reset password</a>';
    loginCard.appendChild(link);

    document.getElementById('forgot-link-inline').addEventListener('click', e => {
      e.preventDefault();
      showScreen('forgot-screen');
      document.getElementById('forgot-error').textContent = '';
      document.getElementById('forgot-success').textContent = '';
      document.getElementById('forgot-token-box').classList.add('hidden');
    });

    document.getElementById('reset-link-inline').addEventListener('click', e => {
      e.preventDefault();
      showScreen('reset-screen');
      document.getElementById('reset-error').textContent = '';
      document.getElementById('reset-success').textContent = '';
    });
  }
})();