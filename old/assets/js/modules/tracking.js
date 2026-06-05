function normalizePhone(val) {
  const digits = val.replace(/\D/g, '');
  if (digits.startsWith('213')) return '+' + digits;
  if (digits.startsWith('0')) return '+213' + digits.slice(1);
  return '+213' + digits;
}

function renderOrderCard(order) {
  const statusMap = ['confirmed', 'shipped', 'delivered'];
  const statusLabels = [t('track.confirmed'), t('track.shipped'), t('track.delivered')];
  const currentIdx = statusMap.indexOf(order.status);
  const isDelivered = order.status === 'delivered';

  const itemsHtml = (order.items || []).map(item => {
    const p = Object.values(products).find(pr => pr.name === item.product_name);
    return '<div class="tracking-item">'
      + '<div class="tracking-item-thumb"><img src="' + (p ? p.img : 'assets/images/product-1-1.jpg') + '" alt="' + item.product_name + '" loading="lazy" onload="this.classList.add(\'loaded\')"></div>'
      + '<div class="tracking-item-info">'
      + '<div class="tracking-item-name">' + item.product_name + '</div>'
      + '<div class="tracking-item-detail">Size ' + item.size + (item.color ? '<span style="display:inline-flex;align-items:center;gap:3px;margin-left:4px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;border:1px solid var(--border);background:' + (item.color_hex || '#ccc') + '"></span>' + item.color + '</span>' : '') + ' &middot; Qty ' + item.quantity + '</div></div>'
      + '<div class="tracking-item-price">' + (item.unit_price_dzd * item.quantity).toLocaleString('fr-DZ') + ' <span>DZD</span></div>'
      + '</div>';
  }).join('');

  const timelineSteps = [
    { title: t('track.timeline1'), desc: t('track.timeline1d') },
    { title: t('track.timeline2'), desc: t('track.timeline2d') },
    { title: t('track.timeline3'), desc: t('track.timeline3d') }
  ];

  const timelineHtml = timelineSteps.map((step, i) => {
    const isDone = i < currentIdx || (i === currentIdx && isDelivered);
    const isCurrent = i === currentIdx && !isDelivered;
    var cls = isDone ? 'done' : isCurrent ? 'current' : 'pending';
    var icon = isDone
      ? '<polyline points="20 6 9 17 4 12"/>'
      : isCurrent
          ? '<path d="M5 12h14M12 5l7 7-7 7"/>'
          : '<circle cx="12" cy="12" r="10"/>';
    return '<div class="timeline-step ' + cls + '">'
      + '<div class="timeline-dot"><svg viewBox="0 0 24 24" fill="none" stroke-width="2">' + icon + '</svg></div>'
      + '<div><div class="timeline-step-title">' + step.title + '</div>'
      + '<div class="timeline-step-desc">' + (isDone || isCurrent ? step.desc : t('track.awaiting')) + '</div></div></div>';
  }).join('');

  return '<div class="tracking-order-card">'
    + '<div class="tracking-order-top">'
    + '<div class="tracking-order-num">' + order.order_number + '</div>'
    + '<div class="tracking-status-pill ' + order.status + '">' + (statusLabels[currentIdx] || order.status) + '</div></div>'
    + '<div class="tracking-items">' + itemsHtml + '</div>'
    + '<div class="tracking-total">' + t('track.total') + ' <strong>' + (order.total_dzd || 0).toLocaleString('fr-DZ') + ' DZD</strong></div>'
    + '<div class="tracking-delivery-to"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>'
    + (order.delivery_wilaya || '') + (order.delivery_commune ? ', ' + order.delivery_commune : '') + '</div>'
    + '<div class="tracking-timeline">' + timelineHtml + '</div></div>';
}

function showError(msg) {
  document.getElementById('trackingResult').innerHTML = '<div class="tracking-not-found"><div class="tracking-not-found-title">Error</div><div class="tracking-not-found-desc">' + msg + '</div></div>';
  document.getElementById('trackingResult').classList.add('show');
}

function showNotFound(title, msg) {
  document.getElementById('trackingResult').innerHTML = '<div class="tracking-not-found"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><line x1="8" y1="8" x2="14" y2="14"/><line x1="14" y1="8" x2="8" y2="14"/></svg><div class="tracking-not-found-title">' + title + '</div><div class="tracking-not-found-desc">' + msg + '</div></div>';
  document.getElementById('trackingResult').classList.add('show');
}

async function trackOrder() {
  var input = document.getElementById('trackingInput');
  var val = input.value.trim().toUpperCase();
  if (!val) { input.style.borderColor = 'var(--error)'; return; }
  input.style.borderColor = '';

  try {
    var res = await fetch(API_BASE + '/api/orders/' + encodeURIComponent(val));
    if (res.status === 404) { showNotFound(t('track.notfound'), t('track.notfound-d')); return; }
    if (!res.ok) throw new Error('Failed');
    var order = await res.json();
    document.getElementById('trackingResult').innerHTML = renderOrderCard(order);
    document.getElementById('trackingResult').classList.add('show');
  } catch (err) {
    showError(t('track.error-d'));
  }
}

async function trackByPhone() {
  var input = document.getElementById('trackingPhoneInput');
  var raw = input.value.trim();
  if (!raw || raw.replace(/\D/g,'').length < 9) { input.style.borderColor = 'var(--error)'; return; }
  input.style.borderColor = '';
  var phone = normalizePhone(raw);

  try {
    var res = await fetch(API_BASE + '/api/orders/by-phone?phone=' + encodeURIComponent(phone));
    if (res.status === 404) { showNotFound(t('track.nophones'), t('track.nophones-d')); return; }
    if (!res.ok) throw new Error('Failed');
    var orders = await res.json();
    if (!orders || orders.length === 0) { showNotFound(t('track.nophones'), t('track.nophones-d')); return; }
    document.getElementById('trackingResult').innerHTML = orders.map(function(o) { return renderOrderCard(o); }).join('');
    document.getElementById('trackingResult').classList.add('show');
  } catch (err) {
    showError(t('track.error-d'));
  }
}

document.addEventListener('DOMContentLoaded', function() {
  var tabs = document.querySelectorAll('.tracking-tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].addEventListener('click', function() {
      var mode = this.getAttribute('data-tab');
      var allTabs = document.querySelectorAll('.tracking-tab');
      for (var j = 0; j < allTabs.length; j++) allTabs[j].classList.remove('active');
      this.classList.add('active');
      document.getElementById('tracking-input-order').style.display = mode === 'order' ? 'flex' : 'none';
      document.getElementById('tracking-input-phone').style.display = mode === 'phone' ? 'flex' : 'none';
      document.getElementById('trackingResult').classList.remove('show');
    });
  }

  var orderInput = document.getElementById('trackingInput');
  if (orderInput) {
    orderInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') trackOrder(); });
  }
  var phoneInput = document.getElementById('trackingPhoneInput');
  if (phoneInput) {
    phoneInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') trackByPhone(); });
  }

  var orderBtn = document.getElementById('track-btn-order');
  if (orderBtn) orderBtn.addEventListener('click', trackOrder);
  var phoneBtn = document.getElementById('track-btn-phone');
  if (phoneBtn) phoneBtn.addEventListener('click', trackByPhone);
});
