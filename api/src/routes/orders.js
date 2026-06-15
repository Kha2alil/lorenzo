const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const supabase = require('../db');
const { generateOrderNumber } = require('../utils/helpers');

const router = Router();

const ordersPostLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many orders. Try again in 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const orderTrackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many requests. Try again in 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function stripHtml(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/<[^>]*>/g, '').trim();
}

function validateEmail(e) {
  return !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function validatePhone(p) {
  return /^[0-9+\s\-()]{8,20}$/.test(p);
}

// Place order
router.post('/', ordersPostLimiter, async (req, res, next) => {
  try {
    const { customer, delivery, items } = req.body;

    if (!customer?.name || !customer?.phone) {
      return res.status(400).json({ error: 'Customer name and phone are required' });
    }
    const cleanName = stripHtml(customer.name).slice(0, 100);
    const cleanPhone = stripHtml(customer.phone).slice(0, 20);
    const cleanEmail = customer.email ? stripHtml(customer.email).slice(0, 100) : null;

    if (!validatePhone(cleanPhone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }
    if (cleanEmail && !validateEmail(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!delivery?.wilaya) {
      return res.status(400).json({ error: 'Delivery wilaya is required' });
    }
    const cleanWilaya = stripHtml(delivery.wilaya).slice(0, 100);
    const cleanCommune = delivery.commune ? stripHtml(delivery.commune).slice(0, 100) : null;
    const cleanAddress = delivery.address ? stripHtml(delivery.address).slice(0, 500) : null;
    const cleanNotes = delivery.notes ? stripHtml(delivery.notes).slice(0, 500) : null;

    if (delivery.type !== 'office' && !cleanAddress) {
      return res.status(400).json({ error: 'Delivery address is required for home delivery' });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    // 1. Insert or find customer
    let customerId;
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (existing) {
      customerId = existing.id;
    } else {
      const { data: newCustomer, error: custErr } = await supabase
        .from('customers')
        .insert({
          full_name: cleanName,
          phone: cleanPhone,
          email: cleanEmail || null,
          wilaya_code: delivery.wilaya_code || null,
          commune: cleanCommune,
          address: cleanAddress
        })
        .select('id')
        .single();

      if (custErr) throw custErr;
      customerId = newCustomer.id;
    }

    // 2. Server-side price validation — look up real prices from DB
    const productSlugs = items.map(i => i.slug).filter(Boolean);
    let productPrices = {};
    let activeSlugs = {};
    if (productSlugs.length > 0) {
      const { data: dbProducts } = await supabase
        .from('products')
        .select('slug, price_dzd, is_active')
        .in('slug', productSlugs);
      (dbProducts || []).forEach(p => {
        productPrices[p.slug] = p.price_dzd;
        activeSlugs[p.slug] = p.is_active;
      });
    }

    let subtotal = 0;
    for (const item of items) {
      const dbPrice = productPrices[item.slug];
      if (!dbPrice) {
        return res.status(400).json({ error: 'Unknown product: ' + item.slug });
      }
      if (activeSlugs[item.slug] === false) {
        return res.status(400).json({ error: item.slug + ' is not available for purchase' });
      }
      const qty = item.qty;
      if (typeof qty !== 'number' || qty < 1 || !Number.isInteger(qty)) {
        return res.status(400).json({ error: 'Invalid quantity for: ' + item.slug });
      }
      if (qty > 100) {
        return res.status(400).json({ error: 'Quantity exceeds maximum (100) for: ' + item.slug });
      }
      subtotal += dbPrice * qty;
    }

    // 3. Look up delivery fee from wilaya table
    let deliveryFee = 500;
    if (cleanWilaya) {
      const { data: wilaya } = await supabase
        .from('wilayas')
        .select('delivery_fee_dzd')
        .ilike('name_fr', cleanWilaya)
        .maybeSingle();
      if (wilaya) deliveryFee = wilaya.delivery_fee_dzd;
    }
    const total = subtotal + deliveryFee;

    // 4. Insert order
    const orderNumber = generateOrderNumber();
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: customerId,
        status: 'pending',
        subtotal_dzd: subtotal,
        delivery_fee_dzd: deliveryFee,
        total_dzd: total,
        payment_method: 'cash_on_delivery',
        delivery_type: delivery.type || 'office',
        delivery_wilaya: cleanWilaya,
        delivery_commune: cleanCommune,
        delivery_address: cleanAddress,
        notes: cleanNotes
      })
      .select('id, order_number')
      .single();

    if (orderErr) throw orderErr;

    // 4. Insert order items (use validated prices)
    const orderItems = items.map(item => {
      const dbPrice = productPrices[item.slug];
      const effectivePrice = item.promotion && item.promotion.discount_percent
        ? Math.round(dbPrice * (1 - item.promotion.discount_percent / 100))
        : dbPrice;
      return {
        order_id: order.id,
        product_id: item.product_id || null,
        product_name: String(item.name || '').slice(0, 200),
        size: item.size,
        color: item.color || null,
        color_hex: item.color_hex || null,
        quantity: item.qty,
        unit_price_dzd: effectivePrice,
        image_url: item.image_url || null
      };
    });

    const { error: itemsErr } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsErr) throw itemsErr;

    res.status(201).json({
      order_number: orderNumber,
      total_dzd: total
    });
  } catch (err) {
    next(err);
  }
});

// Recent orders for live ticker
const recentOrdersLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30,
  message: { error: 'Too many requests. Try again in 1 minute.' },
  standardHeaders: true, legacyHeaders: false,
});

router.get('/recent', recentOrdersLimiter, async (req, res, next) => {
  try {
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('id, customer_id, placed_at, delivery_wilaya')
      .order('placed_at', { ascending: false })
      .limit(10);
    if (ordersErr) throw ordersErr;

    const results = await Promise.all((orders || []).map(async (o) => {
      const { data: customer } = await supabase
        .from('customers')
        .select('full_name')
        .eq('id', o.customer_id)
        .maybeSingle();
      const { data: items } = await supabase
        .from('order_items')
        .select('product_name')
        .eq('order_id', o.id)
        .limit(1);
      const minsAgo = Math.floor((Date.now() - new Date(o.placed_at).getTime()) / 60000);
      return {
        name: customer ? customer.full_name.split(' ')[0] : 'Client',
        city: o.delivery_wilaya,
        product: items && items[0] ? items[0].product_name : 'item',
        mins: minsAgo
      };
    }));

    res.json(results);
  } catch (err) { next(err); }
});

// Track by phone
router.get('/by-phone', async (req, res, next) => {
  try {
    const phone = (req.query.phone || '').replace(/<[^>]*>/g, '').trim();
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    if (!/^[0-9+\s\-()]{8,20}$/.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('id, full_name, phone')
      .eq('phone', phone)
      .maybeSingle();

    if (!customer) {
      return res.status(404).json({ error: 'No customer found with this phone number' });
    }

    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number, status, total_dzd, placed_at, delivery_wilaya, delivery_commune, delivery_address')
      .eq('customer_id', customer.id)
      .order('placed_at', { ascending: false });

    const results = await Promise.all((orders || []).map(async (o) => {
      const { data: items } = await supabase
        .from('order_items')
        .select('product_name, size, quantity, unit_price_dzd')
        .eq('order_id', o.id);

      return {
        ...o,
        customer_name: customer.full_name,
        items: items || [],
        timeline: getTimeline(o.status)
      };
    }));

    res.json(results);
  } catch (err) {
    next(err);
  }
});

// Track order
router.get('/:orderNumber', orderTrackLimiter, async (req, res, next) => {
  try {
    const { data: order, error } = await supabase
      .from('v_orders_summary')
      .select('*')
      .eq('order_number', req.params.orderNumber)
      .single();

    if (error || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    const timeline = getTimeline(order.status);

    res.json({ ...order, items, timeline });
  } catch (err) {
    next(err);
  }
});

function getTimeline(status) {
  const steps = [
    { key: 'confirmed', title: 'Order Confirmed', desc: 'Your order was received.' },
    { key: 'shipped',   title: 'Shipped',        desc: 'Your order is on its way.' },
    { key: 'delivered', title: 'Delivered',      desc: 'Cash collected on delivery.' }
  ];
  const idx = steps.findIndex(s => s.key === status);
  return steps.map((s, i) => ({
    ...s,
    done: i <= idx,
    current: i === idx && status !== 'delivered'
  }));
}

module.exports = router;
