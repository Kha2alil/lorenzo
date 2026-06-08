function normalizePhone(val) {
  const digits = val.replace(/\D/g, '');
  if (digits.startsWith('213')) return '+' + digits;
  if (digits.startsWith('0')) return '+213' + digits.slice(1);
  return '+213' + digits;
}

let currentStep = 1;
const DELIVERY_HOME_FEE = 750;

function getDeliveryType() {
  return document.querySelector('input[name="deliveryType"]:checked')?.value || 'home';
}

function getDeliveryFee() {
  const type = getDeliveryType();
  if (type === 'home') return DELIVERY_HOME_FEE;
  const sel = document.getElementById('orderWilaya');
  const opt = sel.options[sel.selectedIndex];
  return opt?.dataset?.fee ? Number(opt.dataset.fee) : 0;
}

async function loadWilayas() {
  try {
    const res = await fetch(API_BASE + '/api/wilayas');
    if (!res.ok) return;
    const data = await res.json();
    const sel = document.getElementById('orderWilaya');
    sel.innerHTML = '<option value="">' + t('order.selectwilaya') + '</option>' +
      data.map(w => `<option value="${w.name_fr}" data-code="${w.code}" data-fee="${w.delivery_fee_dzd}" data-days-min="${w.estimated_days_min}" data-days-max="${w.estimated_days_max}">${w.code} - ${w.name_fr}</option>`).join('');
    document.getElementById('deliveryEstimate').style.display = 'none';
  } catch (err) { console.error('Failed to load wilayas:', err); }
}

function updateDeliveryEstimate() {
  const sel = document.getElementById('orderWilaya');
  const opt = sel.options[sel.selectedIndex];
  const estEl = document.getElementById('deliveryEstimate');
  const type = getDeliveryType();
  const feeEl = document.getElementById('dt-office-fee');

  if (opt?.value) {
    feeEl.textContent = Number(opt.dataset.fee).toLocaleString('fr-DZ') + ' DZD';
  } else {
    feeEl.textContent = '—';
  }

  if (type === 'home') {
    document.getElementById('estText').innerHTML = t('order.home') + ' · <strong id="estFee">' + DELIVERY_HOME_FEE.toLocaleString('fr-DZ') + '</strong> DZD. Pay on arrival.';
    estEl.style.display = 'flex';
    return;
  }

  if (!opt || !opt.value) {
    estEl.style.display = 'none';
    return;
  }
  const min = opt.dataset.daysMin;
  const max = opt.dataset.daysMax;
  const fee = Number(opt.dataset.fee);
  document.getElementById('estText').innerHTML = t('order.office') + ': <strong>' + min + '–' + max + ' business days</strong> · <strong>' + fee.toLocaleString('fr-DZ') + '</strong> DZD. Pay on arrival.';
  estEl.style.display = 'flex';
}

function openOrderDrawer() {
  loadWilayas();

  const itemsEl = document.getElementById('drawerOrderItems');
  if (itemsEl) {
    itemsEl.innerHTML = cart.map(item => {
      return `
        <div class="drawer-order-item">
          <div class="drawer-order-thumb"><img src="${item.img}" alt="${item.name}" loading="lazy" onload="this.classList.add('loaded')"></div>
          <div class="drawer-order-info">
            <div class="drawer-order-name">${item.name}</div>
            <div class="drawer-order-size">Size ${item.size}${item.color ? '<span style="display:inline-flex;align-items:center;gap:3px;margin-left:4px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;border:1px solid var(--border);background:' + (item.colorHex || '#ccc') + '"></span>' + item.color + '</span>' : ''} · Qty ${item.qty}</div>
          </div>
          <div class="drawer-order-price">${(item.price * item.qty).toLocaleString('fr-DZ')} <span>DZD</span></div>
        </div>
      `;
    }).join('');
  }
  el('drawerTotal').textContent = getCartTotal().toLocaleString('fr-DZ') + ' DZD';
  el('drawerOverlay').classList.add('open');
  el('orderDrawer').classList.add('open');
  document.body.style.overflow = 'hidden';
  goToStep(1);
}

function closeOrderDrawer() {
  el('drawerOverlay').classList.remove('open');
  el('orderDrawer').classList.remove('open');
  document.body.style.overflow = '';
}

function goToStep(n) {
  currentStep = n;
  ['formStep1','formStep2','formStep3'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.style.display = i+1===n ? 'block' : 'none';
  });
  ['step1','step2','step3'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('active','done');
    if (i+1 === n) el.classList.add('active');
    else if (i+1 < n) el.classList.add('done');
  });
  ['stepLine1','stepLine2'].forEach((id,i) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('done', n > i+1);
  });
}

function nextStep() {
  if (currentStep === 1) {
    const name = el('orderName');
    const phone = el('orderPhone');
    let valid = true;
    if (!name.value.trim()) { name.style.borderColor = 'var(--error)'; valid = false; } else name.style.borderColor = '';
    if (!phone.value.trim() || phone.value.replace(/\D/g,'').length < 9) { phone.style.borderColor = 'var(--error)'; valid = false; } else phone.style.borderColor = '';
    if (!valid) return;
  }
  if (currentStep === 2) {
    const wilaya = el('orderWilaya');
    const commune = el('orderCommune');
    const address = el('orderAddress');
    const isHome = getDeliveryType() === 'home';
    let valid = true;
    if (!wilaya.value) { wilaya.style.borderColor = 'var(--error)'; valid = false; } else wilaya.style.borderColor = '';
    if (isHome && !commune.value.trim()) { commune.style.borderColor = 'var(--error)'; valid = false; } else commune.style.borderColor = '';
    if (isHome && !address.value.trim()) { address.style.borderColor = 'var(--error)'; valid = false; } else address.style.borderColor = '';
    if (!valid) return;
  }
  if (currentStep === 2) {
    const itemsEl = document.getElementById('orderSummaryItems');
    if (itemsEl) {
      itemsEl.innerHTML = cart.map(item => `
        <div class="order-summary-item">
          <span class="order-summary-item-name">${item.name}</span>
          <span class="order-summary-item-size">${item.size}${item.color ? '<span style="display:inline-flex;align-items:center;gap:3px;margin-left:4px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;border:1px solid var(--border);background:' + (item.colorHex || '#ccc') + '"></span>' + item.color + '</span>' : ''}</span>
          <span class="order-summary-item-qty">×${item.qty}</span>
          <span class="order-summary-item-price">${(item.price * item.qty).toLocaleString('fr-DZ')} <span>DZD</span></span>
        </div>
      `).join('');
    }
    const addrEl = document.getElementById('orderSummaryAddress');
    const communeVal = el('orderCommune').value.trim();
    if (addrEl) addrEl.textContent = communeVal ? `${communeVal}, ${el('orderWilaya').value}` : el('orderWilaya').value;
    const deliveryFee = getDeliveryFee();
    const feeEl = document.getElementById('orderSummaryFee');
    if (feeEl) feeEl.textContent = deliveryFee.toLocaleString('fr-DZ') + ' DZD';
    const subtotal = getCartTotal();
    const total = subtotal + deliveryFee;
    el('drawerTotal').textContent = total.toLocaleString('fr-DZ') + ' DZD';
  }
  if (currentStep < 3) goToStep(currentStep + 1);
}

let lastOrderData = null;

function renderReceipt(orderData) {
  const itemsEl = document.getElementById('receiptItems');
  itemsEl.innerHTML = orderData.items.map(item => `
    <div class="receipt-item">
      <span class="receipt-item-name">${item.name}</span>
      <span class="receipt-item-meta">${item.size}${item.color ? ' · ' + item.color : ''} ×${item.qty}</span>
      <span class="receipt-item-price">${(item.price * item.qty).toLocaleString('fr-DZ')} DZD</span>
    </div>
  `).join('');

  const delivery = orderData.delivery;
  const addrParts = [delivery.address, delivery.commune, delivery.wilaya].filter(Boolean);
  document.getElementById('receiptDelivery').innerHTML = `
    <div class="receipt-section-label">Delivering to</div>
    <div class="receipt-address">${addrParts.join(', ')}</div>
    <div class="receipt-phone">${orderData.customer.phone}</div>
  `;

  const subtotal = orderData.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  document.getElementById('receiptTotal').innerHTML = `
    <div class="receipt-total-row">
      <span>Subtotal</span>
      <span>${subtotal.toLocaleString('fr-DZ')} DZD</span>
    </div>
    <div class="receipt-total-row">
      <span>Delivery fee</span>
      <span>${delivery.fee.toLocaleString('fr-DZ')} DZD</span>
    </div>
    <div class="receipt-total-row receipt-grand">
      <span>Total to pay</span>
      <span>${(subtotal + delivery.fee).toLocaleString('fr-DZ')} DZD</span>
    </div>
  `;
}

async function submitOrder() {
  const name = el('orderName').value.trim();
  const phone = normalizePhone(el('orderPhone').value);
  const wilaya = el('orderWilaya').value;
  const commune = el('orderCommune').value.trim() || null;
  const address = el('orderAddress').value.trim() || null;
  const notes = el('orderNotes').value.trim();
  const wilayaSel = el('orderWilaya');
  const wilayaOpt = wilayaSel.options[wilayaSel.selectedIndex];
  const wilayaCode = wilayaOpt?.dataset?.code || null;
  const deliveryFee = getDeliveryFee();
  const deliveryType = getDeliveryType();

  const payload = {
    customer: { name, phone },
    delivery: { wilaya, wilaya_code: wilayaCode ? Number(wilayaCode) : null, commune, address, notes: notes || null, type: deliveryType, fee: deliveryFee },
    items: cart.map(item => ({
      slug: item.slug,
      product_id: item.id,
      name: item.name,
      size: item.size,
      color: item.color || null,
      color_hex: item.colorHex || null,
      qty: item.qty,
      price: item.price,
      image_url: item.img || null
    }))
  };

  let orderNumber;

  try {
    const res = await fetch(API_BASE + '/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Order submission failed');
    }

    const result = await res.json();
    orderNumber = result.order_number;

    lastOrderData = { ...payload, order_number: orderNumber };
    renderReceipt(lastOrderData);

    closeOrderDrawer();
    document.body.style.overflow = '';
    el('confirmOrderNum').textContent = orderNumber;
    el('confirmationOverlay').classList.add('show');

    cart = [];
    updateCartBadges();
    renderCartItems();
  } catch (err) {
    alert(err.message);
  }
}

function printReceipt() {
  window.print();
}

function closeConfirmation() {
  el('confirmationOverlay').classList.remove('show');
  navigate('home');
}

function openWhatsApp() {
  window.open('https://wa.me/213XXXXXXXXX?text=' + encodeURIComponent(t('order.wa')), '_blank');
}

function el(id) { return document.getElementById(id); }
