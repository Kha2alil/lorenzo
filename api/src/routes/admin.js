const { Router } = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const supabase = require('../db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { sendOTP } = require('../utils/email');

// In-memory store for email verification OTPs
const emailOtpStore = new Map();


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 }
});

function parseSizes(sizes) {
  if (!sizes) return [];
  if (Array.isArray(sizes)) return sizes;
  const trimmed = sizes.trim();
  if (trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed); } catch { return []; }
  }
  return trimmed.split(',').map(s => s.trim()).filter(Boolean);
}

function stripHtml(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/<[^>]*>/g, '').trim();
}

const router = Router();

// ───── Login (public) ─────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token });
  } catch (err) {
    next(err);
  }
});

// ───── Setup first admin (public, one-time) ─────
router.post('/setup', async (req, res, next) => {
  try {
    const { data: existing } = await supabase
      .from('admin_users')
      .select('id')
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Admin already exists' });
    }

    const email = 'admin@lorenzo.dz';
    const password = process.env.ADMIN_SETUP_PASSWORD;
    if (!password) {
      return res.status(500).json({ error: 'ADMIN_SETUP_PASSWORD not configured in .env' });
    }
    const hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from('admin_users')
      .insert({ email, password_hash: hash })
      .select('id, email')
      .single();

    if (error) throw error;
    res.status(201).json({ message: 'Admin created', admin: { email: data.email } });
  } catch (err) {
    next(err);
  }
});

// ───── Send OTP ─────
router.post('/send-otp', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const { data: admin } = await supabase
      .from('admin_users')
      .select('email')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (!admin) {
      return res.status(404).json({ error: 'No admin account found with this email.' });
    }

    const otp = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: insertErr } = await supabase
      .from('password_resets')
      .insert({ email: admin.email, token: otp, expires_at: expiresAt });

    if (insertErr) throw insertErr;

    const result = await sendOTP(admin.email, otp);
    if (!result.sent && !result.otp) {
      return res.status(500).json({ error: 'Failed to send OTP email. Check SMTP configuration.' });
    }

    res.json({ message: 'OTP sent to your email. Valid for 15 minutes.', expires_in: 900 });
  } catch (err) { next(err); }
});

// ───── Reset Password ─────
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, token, new_password } = req.body;
    if (!email || !token || !new_password) {
      return res.status(400).json({ error: 'Email, token, and new password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const { data: reset } = await supabase
      .from('password_resets')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('token', token)
      .eq('used', false)
      .maybeSingle();

    if (!reset) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    if (new Date(reset.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    const { error: updateErr } = await supabase
      .from('admin_users')
      .update({ password_hash: hash })
      .eq('email', email.toLowerCase().trim());

    if (updateErr) throw updateErr;

    await supabase
      .from('password_resets')
      .update({ used: true })
      .eq('id', reset.id);

    res.json({ message: 'Password has been reset successfully.' });
  } catch (err) { next(err); }
});

// ───── Protected routes ─────
router.use(requireAuth);

// Categories
router.get('/categories', async (req, res, next) => {
  try {
    const { data: cats } = await supabase.from('categories').select('*').order('name');
    const { data: products } = await supabase.from('products').select('category');
    const prodCounts = {};
    (products || []).forEach(p => { prodCounts[p.category] = (prodCounts[p.category] || 0) + 1; });
    const result = (cats || []).map(c => ({ ...c, product_count: prodCounts[c.slug] || 0 }));
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/categories', audit('create', 'category'), async (req, res, next) => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!cleanSlug) return res.status(400).json({ error: 'Invalid slug' });
    const { data, error } = await supabase
      .from('categories')
      .insert({ name: stripHtml(name).slice(0, 100), slug: cleanSlug })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') return res.status(400).json({ error: 'Category with this slug already exists' });
      throw error;
    }
    res.status(201).json(data);
  } catch (err) { next(err); }
});

router.delete('/categories/:slug', audit('delete', 'category', (req) => req.params.slug), async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('category', slug);
    if (count > 0) {
      return res.status(400).json({ error: `Cannot delete: ${count} product(s) use this category` });
    }
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('slug', slug);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ───── Badges ─────
router.get('/badges', async (req, res, next) => {
  try {
    const { data: badges, error } = await supabase
      .from('badges')
      .select('*')
      .order('id', { ascending: true });
    if (error) throw error;
    const result = await Promise.all((badges || []).map(async (b) => {
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('badge', b.name);
      return { ...b, product_count: count };
    }));
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/badges', audit('create', 'badge'), async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Badge name is required' });
    }
    const { data, error } = await supabase
      .from('badges')
      .insert({ name: name.trim() })
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Badge already exists' });
      }
      throw error;
    }
    res.status(201).json(data);
  } catch (err) { next(err); }
});

router.delete('/badges/:id', audit('delete', 'badge', (req) => req.params.id), async (req, res, next) => {
  try {
    const { data: badge } = await supabase
      .from('badges')
      .select('name')
      .eq('id', req.params.id)
      .single();
    if (!badge) return res.status(404).json({ error: 'Badge not found' });
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('badge', badge.name);
    if (count > 0) {
      return res.status(400).json({ error: `Cannot delete: ${count} product(s) use this badge` });
    }
    const { error } = await supabase
      .from('badges')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/orders', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days, 10);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    let query = supabase
      .from('orders')
      .select('*, customers(full_name, phone)', { count: 'exact' });

    if (days > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      query = query.gte('placed_at', cutoff.toISOString());
    }

    const { data, error, count } = await query
      .order('placed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.set({
      'X-Pagination-Page': page,
      'X-Pagination-Limit': limit,
      'X-Pagination-Total': count || data.length,
      'X-Pagination-Pages': count ? Math.ceil(count / limit) : 1,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/orders/new', async (req, res, next) => {
  try {
    const since = req.query.since;
    if (!since) return res.json([]);
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*, customers(full_name, phone)')
      .gt('placed_at', since)
      .order('placed_at', { ascending: false });
    if (error) throw error;
    if (!orders || orders.length === 0) return res.json([]);
    const ids = orders.map(o => o.id);
    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', ids);
    const itemsByOrder = {};
    (items || []).forEach(it => {
      if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
      itemsByOrder[it.order_id].push(it);
    });
    const result = orders.map(o => ({ ...o, items: itemsByOrder[o.id] || [] }));
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/orders/search', async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const days = parseInt(req.query.days, 10);

    let query = supabase.from('orders').select('*, customers(full_name, phone)');

    if (days > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      query = query.gte('placed_at', cutoff.toISOString());
    }

    if (q) {
      const { data: matchingCustomers } = await supabase
        .from('customers')
        .select('id')
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`);

      const customerIds = (matchingCustomers || []).map(c => c.id);

      const orClause = `order_number.ilike.%${q}%${customerIds.length > 0 ? `,customer_id.in.(${customerIds.join(',')})` : ''}`;

      if (days > 0) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        query = supabase
          .from('orders')
          .select('*, customers(full_name, phone)')
          .or(orClause)
          .gte('placed_at', cutoff.toISOString());
      } else {
        query = supabase
          .from('orders')
          .select('*, customers(full_name, phone)')
          .or(orClause);
      }
    }

    const { data, error } = await query.order('placed_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.delete('/orders/:id', audit('delete', 'order', (req) => req.params.id), async (req, res, next) => {
  try {
    const { error: itemsErr } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', req.params.id);

    if (itemsErr) throw itemsErr;

    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/orders/:id', async (req, res, next) => {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, customers(*)')
      .eq('id', req.params.id)
      .single();

    if (error || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    res.json({ ...order, items: items || [] });
  } catch (err) {
    next(err);
  }
});

router.patch('/orders/:id/status', audit('update', 'order-status', (req) => req.params.id), async (req, res, next) => {
  try {
    const { status } = req.body;
    const valid = ['pending', 'confirmed', 'shipped', 'delivered', 'returned', 'cancelled'];

    if (!valid.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${valid.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', req.params.id)
      .select('id, order_number, status')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/products', upload.array('images', 5), audit('create', 'product', (req, res, body) => body?.id), async (req, res, next) => {
  try {
    const { name, slug, category, price_dzd, description, fabric, sizes, badge, unavailable_sizes } = req.body;
    const files = req.files || [];

    if (!name || !slug || !category || !price_dzd) {
      return res.status(400).json({ error: 'name, slug, category, and price_dzd are required' });
    }

    const { data: validCats } = await supabase.from('categories').select('slug');
    const validCategories = (validCats || []).map(c => c.slug);
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${validCategories.join(', ')}` });
    }

    if (isNaN(price_dzd) || Number(price_dzd) <= 0) {
      return res.status(400).json({ error: 'price_dzd must be a positive number' });
    }

    if (badge) {
      const { data: validBadges } = await supabase.from('badges').select('name');
      const validNames = (validBadges || []).map(b => b.name);
      if (!validNames.includes(badge)) {
        return res.status(400).json({ error: `Invalid badge. Valid: ${validNames.join(', ') || 'none'}` });
      }
    }

    const cleanName = stripHtml(name).slice(0, 200);
    const cleanDescription = description ? stripHtml(description).slice(0, 2000) : null;
    const cleanFabric = fabric ? stripHtml(fabric).slice(0, 200) : null;
    if (!cleanName) return res.status(400).json({ error: 'Name is required' });

    const sizesArr = parseSizes(sizes);
    let unavailArr = [];
    if (unavailable_sizes) {
      try { unavailArr = typeof unavailable_sizes === 'string' ? JSON.parse(unavailable_sizes) : unavailable_sizes; } catch { unavailArr = []; }
    }

    const uploadedPaths = [];
    try {
      for (const file of files) {
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${slug}-${Date.now()}-${Math.random().toString(36).slice(2,6)}.${fileExt}`;

        const { error: uploadErr } = await supabase.storage
          .from('product-images')
          .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });

        if (uploadErr) throw uploadErr;
        uploadedPaths.push(fileName);
      }
    } catch (uploadErr) {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from('product-images').remove(uploadedPaths);
      }
      throw uploadErr;
    }

    const { data: product, error: insertErr } = await supabase
      .from('products')
      .insert({
        name: cleanName, slug, category,
        price_dzd: Number(price_dzd),
        description: cleanDescription,
        fabric: cleanFabric,
        sizes: sizesArr,
        badge: badge || null,
        unavailable_sizes: unavailArr
      })
      .select('id, slug')
      .single();

    if (insertErr) {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from('product-images').remove(uploadedPaths);
      }
      throw insertErr;
    }

    if (uploadedPaths.length > 0) {
      let imageColors = [];
      try { imageColors = req.body.image_colors ? JSON.parse(req.body.image_colors) : []; } catch {}

      const imageRows = uploadedPaths.map((path, i) => ({
        product_id: product.id,
        storage_path: path,
        alt_text: name,
        sort_order: i,
        is_primary: i === 0,
        color_id: imageColors[i] ? Number(imageColors[i]) : null
      }));

      const { error: imgErr } = await supabase
        .from('product_images')
        .insert(imageRows);

      if (imgErr) {
        await supabase.storage.from('product-images').remove(uploadedPaths);
        throw imgErr;
      }
    }

    res.status(201).json({ id: product.id, slug: product.slug });
  } catch (err) {
    next(err);
  }
});

router.put('/products/:id', upload.array('images', 5), audit('update', 'product', (req) => req.params.id), async (req, res, next) => {
  try {
    const { name, slug, category, price_dzd, description, fabric, sizes, badge, is_active, unavailable_sizes } = req.body;
    const files = req.files || [];
    const productId = req.params.id;

    const updates = {};
    if (name !== undefined) updates.name = stripHtml(name).slice(0, 200);
    if (slug !== undefined) updates.slug = slug;
    if (category !== undefined) {
      const { data: validCats } = await supabase.from('categories').select('slug');
      const valid = (validCats || []).map(c => c.slug);
      if (!valid.includes(category)) {
        return res.status(400).json({ error: `category must be one of: ${valid.join(', ')}` });
      }
      updates.category = category;
    }
    if (price_dzd !== undefined) {
      if (isNaN(price_dzd) || Number(price_dzd) <= 0) {
        return res.status(400).json({ error: 'price_dzd must be a positive number' });
      }
      updates.price_dzd = Number(price_dzd);
    }
    if (description !== undefined) updates.description = stripHtml(description).slice(0, 2000) || null;
    if (fabric !== undefined) updates.fabric = stripHtml(fabric).slice(0, 200) || null;
    if (sizes !== undefined) updates.sizes = parseSizes(sizes);
    if (badge !== undefined) {
      if (badge) {
        const { data: validBadges } = await supabase.from('badges').select('name');
        const validNames = (validBadges || []).map(b => b.name);
        if (!validNames.includes(badge)) {
          return res.status(400).json({ error: `Invalid badge. Valid: ${validNames.join(', ') || 'none'}` });
        }
      }
      updates.badge = badge || null;
    }
    if (is_active !== undefined) updates.is_active = is_active;
    if (unavailable_sizes !== undefined) {
      try { updates.unavailable_sizes = typeof unavailable_sizes === 'string' ? JSON.parse(unavailable_sizes) : unavailable_sizes; } catch { updates.unavailable_sizes = []; }
    }

    if (Object.keys(updates).length === 0 && files.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', productId)
        .select('id, slug')
        .single();

      if (error) throw error;
    }

    if (files.length > 0) {
      const { data: oldImages } = await supabase
        .from('product_images')
        .select('storage_path')
        .eq('product_id', productId);

      const uploadedPaths = [];
      try {
        for (const file of files) {
          const fileExt = file.originalname.split('.').pop();
          const fileName = `${slug || 'product'}-${Date.now()}-${Math.random().toString(36).slice(2,6)}.${fileExt}`;

          const { error: uploadErr } = await supabase.storage
            .from('product-images')
            .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });

          if (uploadErr) throw uploadErr;
          uploadedPaths.push(fileName);
        }
      } catch (uploadErr) {
        if (uploadedPaths.length > 0) {
          await supabase.storage.from('product-images').remove(uploadedPaths);
        }
        throw uploadErr;
      }

      await supabase
        .from('product_images')
        .delete()
        .eq('product_id', productId);

      if (oldImages && oldImages.length > 0) {
        await supabase.storage
          .from('product-images')
          .remove(oldImages.map(i => i.storage_path));
      }

      let imageColors = [];
      try { imageColors = req.body.image_colors ? JSON.parse(req.body.image_colors) : []; } catch {}

      const imageRows = uploadedPaths.map((path, i) => ({
        product_id: productId,
        storage_path: path,
        alt_text: name || 'Product',
        sort_order: i,
        is_primary: i === 0,
        color_id: imageColors[i] ? Number(imageColors[i]) : null
      }));

      const { error: imgErr } = await supabase
        .from('product_images')
        .insert(imageRows);

      if (imgErr) {
        await supabase.storage.from('product-images').remove(uploadedPaths);
        throw imgErr;
      }
    }

    res.json({ id: productId, success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/products/:id', audit('delete', 'product', (req) => req.params.id), async (req, res, next) => {
  try {
    const { data: images } = await supabase
      .from('product_images')
      .select('storage_path')
      .eq('product_id', req.params.id);

    if (images && images.length > 0) {
      const paths = images.map(i => i.storage_path);
      await supabase.storage.from('product-images').remove(paths);
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ───── Product Colors ─────
router.get('/products/:id/colors', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('product_colors')
      .select('*')
      .eq('product_id', req.params.id)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (err) { next(err); }
});

router.post('/products/:id/colors', audit('create', 'product-color', (req, res, body) => body?.id), async (req, res, next) => {
  try {
    const { color_name, color_hex } = req.body;
    if (!color_name || !color_name.trim()) {
      return res.status(400).json({ error: 'color_name is required' });
    }
    const { data: existing } = await supabase
      .from('product_colors')
      .select('sort_order')
      .eq('product_id', req.params.id)
      .order('sort_order', { ascending: false })
      .limit(1);
    const nextOrder = (existing && existing[0]) ? existing[0].sort_order + 1 : 0;
    const { data, error } = await supabase
      .from('product_colors')
      .insert({ product_id: req.params.id, color_name: color_name.trim(), color_hex: color_hex || '#1A1A18', sort_order: nextOrder })
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

router.delete('/products/:id/colors/:colorId', audit('delete', 'product-color', (req) => req.params.colorId), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('product_colors')
      .delete()
      .eq('id', req.params.colorId)
      .eq('product_id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.put('/products/:id/colors/:colorId', audit('update', 'product-color', (req) => req.params.colorId), async (req, res, next) => {
  try {
    const { color_name, color_hex } = req.body;
    const updates = {};
    if (color_name !== undefined) updates.color_name = color_name.trim();
    if (color_hex !== undefined) updates.color_hex = color_hex;
    const { data, error } = await supabase
      .from('product_colors')
      .update(updates)
      .eq('id', req.params.colorId)
      .eq('product_id', req.params.id)
      .select('*')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/contact', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('contact_submissions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.set({
      'X-Pagination-Page': page,
      'X-Pagination-Limit': limit,
      'X-Pagination-Total': count || data.length,
      'X-Pagination-Pages': count ? Math.ceil(count / limit) : 1,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.delete('/contact/:id', audit('delete', 'contact', (req) => req.params.id), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('contact_submissions')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/audit-logs', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const offset = (page - 1) * limit;
    const action = req.query.action ? req.query.action.trim() : null;

    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' });

    if (action) {
      query = query.eq('action', action);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const actions = [];
    const { data: distinctActions } = await supabase
      .from('audit_logs')
      .select('action');
    if (distinctActions) {
      const seen = new Set();
      distinctActions.forEach(a => { if (!seen.has(a.action)) { seen.add(a.action); actions.push(a.action); } });
    }

    res.set({
      'X-Pagination-Page': page,
      'X-Pagination-Limit': limit,
      'X-Pagination-Total': count || data.length,
      'X-Pagination-Pages': count ? Math.ceil(count / limit) : 1,
    });
    res.json({ data: data || [], actions });
  } catch (err) {
    next(err);
  }
});

router.delete('/audit-logs', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('audit_logs')
      .delete()
      .neq('id', 0);
    if (error) throw error;
    res.json({ success: true, message: 'Activity log cleared' });
  } catch (err) {
    next(err);
  }
});

router.get('/top-products', async (req, res, next) => {
  try {
    const range = req.query.range || 'all';
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    let cutoff;
    if (range === 'day') { cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 1); }
    else if (range === 'week') { cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 7); }
    else if (range === 'month') { cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 1); }
    else { cutoff = new Date(0); }

    const { data: orderItems, error } = await supabase
      .from('order_items')
      .select('product_name, quantity, unit_price_dzd, product_id, orders!inner(placed_at, status)');
    if (error) throw error;

    const filtered = (orderItems || []).filter(i => {
      if (!i.orders) return false;
      if (['cancelled', 'returned'].includes(i.orders.status)) return false;
      const placed = new Date(i.orders.placed_at);
      return placed >= cutoff && placed <= now;
    });

    const sales = {};
    filtered.forEach(i => {
      const name = i.product_name || 'Unknown';
      if (!sales[name]) sales[name] = { qty: 0, revenue: 0, product_id: i.product_id };
      sales[name].qty += i.quantity || 0;
      sales[name].revenue += (i.quantity || 0) * (i.unit_price_dzd || 0);
    });

    const top = Object.entries(sales)
      .map(([name, s]) => ({ name, product_id: s.product_id, qty: s.qty, revenue: s.revenue }))
      .sort((a, b) => b.qty - a.qty);

    res.json(top);
  } catch (err) { next(err); }
});

// ───── Send email verification OTP ─────
router.post('/send-email-otp', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const trimmed = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const otp = String(crypto.randomInt(100000, 999999));
    emailOtpStore.set(trimmed, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

    const result = await sendOTP(trimmed, otp);
    if (!result.sent && !result.otp) {
      return res.status(500).json({ error: 'Failed to send verification email. Check SMTP configuration.' });
    }

    res.json({ message: 'Verification code sent. Valid for 10 minutes.' });
  } catch (err) { next(err); }
});

router.get('/profile', async (req, res, next) => {
  try {
    const email = req.admin.email;
    res.json({ email });
  } catch (err) { next(err); }
});

router.put('/profile', async (req, res, next) => {
  try {
    const { current_password, new_email, new_password, email_otp } = req.body;
    if (!current_password) return res.status(400).json({ error: 'Current password is required' });

    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', req.admin.email)
      .single();
    if (error || !admin) return res.status(401).json({ error: 'Admin not found' });

    const valid = await bcrypt.compare(current_password, admin.password_hash);
    if (!valid) return res.status(403).json({ error: 'Current password is incorrect' });

    const updates = {};
    if (new_email) {
      const trimmed = new_email.toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      // Verify OTP
      const stored = emailOtpStore.get(trimmed);
      if (!stored || stored.otp !== email_otp || Date.now() > stored.expiresAt) {
        return res.status(400).json({ error: 'Invalid or expired verification code. Request a new one.' });
      }
      emailOtpStore.delete(trimmed);
      const { data: existing } = await supabase.from('admin_users').select('id').eq('email', trimmed).maybeSingle();
      if (existing) return res.status(409).json({ error: 'Email already in use' });
      updates.email = trimmed;
    }
    if (new_password) {
      updates.password_hash = await bcrypt.hash(new_password, 10);
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' });

    const { error: updateErr } = await supabase
      .from('admin_users')
      .update(updates)
      .eq('id', admin.id);
    if (updateErr) throw updateErr;

    const finalEmail = updates.email || admin.email;
    let token = null;
    if (new_email) {
      token = jwt.sign({ id: admin.id, email: finalEmail }, JWT_SECRET, { expiresIn: '7d' });
    }
    res.json({ message: 'Profile updated', email: finalEmail, token });
  } catch (err) { next(err); }
});

router.get('/stats', async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);
    const isoToday = today.toISOString();
    const isoWeek = weekAgo.toISOString();
    const isoMonth = monthAgo.toISOString();

    // Count queries
    const { count: totalProducts } = await supabase
      .from('products').select('*', { count: 'exact', head: true });

    const { count: activeProducts } = await supabase
      .from('products').select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const { count: totalOrders } = await supabase
      .from('orders').select('*', { count: 'exact', head: true });

    const { count: pendingOrders } = await supabase
      .from('orders').select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'confirmed']);

    const { count: totalContacts } = await supabase
      .from('contact_submissions').select('*', { count: 'exact', head: true });

    // Orders by status
    const { data: statusCounts } = await supabase
      .from('orders').select('status');
    const ordersByStatus = { pending: 0, confirmed: 0, shipped: 0, delivered: 0, returned: 0, cancelled: 0 };
    (statusCounts || []).forEach(o => { if (ordersByStatus[o.status] !== undefined) ordersByStatus[o.status]++; });

    // Products by category
    const { data: catData } = await supabase
      .from('products').select('category');
    const productsByCategory = {};
    (catData || []).forEach(p => { productsByCategory[p.category] = (productsByCategory[p.category] || 0) + 1; });

    // Time-series helper
    async function timeSeries(baseQuery, dateCol, startIso) {
      const q = baseQuery.gte(dateCol, startIso);
      const { data } = await q;
      return data || [];
    }

    // ---- Products sold (quantity from order_items, excluding cancelled/returned) ----
    async function soldItemsSince(startIso) {
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .gte('placed_at', startIso)
        .not('status', 'in', '("cancelled","returned")');
      if (!orders || orders.length === 0) return 0;
      const ids = orders.map(o => o.id);
      const { data: items } = await supabase
        .from('order_items')
        .select('quantity')
        .in('order_id', ids);
      return (items || []).reduce((sum, i) => sum + (i.quantity || 0), 0);
    }

    const productsSoldToday = await soldItemsSince(isoToday);
    const productsSoldWeek = await soldItemsSince(isoWeek);
    const productsSoldMonth = await soldItemsSince(isoMonth);
    const { data: allSoldItems } = await supabase
      .from('order_items')
      .select('quantity, order_id');
    const { data: allValidOrders } = await supabase
      .from('orders')
      .select('id')
      .not('status', 'in', '("cancelled","returned")');
    const validOrderSet = new Set((allValidOrders || []).map(o => o.id));
    const productsSoldAll = (allSoldItems || [])
      .filter(i => validOrderSet.has(i.order_id))
      .reduce((sum, i) => sum + (i.quantity || 0), 0);

    // ---- Revenue ----
    async function revenueSince(startIso) {
      const { data } = await supabase
        .from('orders')
        .select('total_dzd')
        .gte('placed_at', startIso)
        .not('status', 'in', '("cancelled","returned")');
      return (data || []).reduce((sum, o) => sum + (o.total_dzd || 0), 0);
    }

    const revenueToday = await revenueSince(isoToday);
    const revenueWeek = await revenueSince(isoWeek);
    const revenueMonth = await revenueSince(isoMonth);
    const { data: allRevenue } = await supabase
      .from('orders')
      .select('total_dzd')
      .not('status', 'in', '("cancelled","returned")');
    const revenueAll = (allRevenue || []).reduce((sum, o) => sum + (o.total_dzd || 0), 0);

    // ---- Orders count time series ----
    async function orderCountSince(startIso) {
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('placed_at', startIso)
        .not('status', 'in', '("cancelled","returned")');
      return count || 0;
    }

    const ordersToday = await orderCountSince(isoToday);
    const ordersWeek = await orderCountSince(isoWeek);
    const ordersMonth = await orderCountSince(isoMonth);

    // ---- Average order value ----
    const avgOrderValue = ordersMonth > 0 ? Math.round(revenueMonth / ordersMonth) : 0;

    // ---- Suits stats ----
    const { count: suitsProductCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'suits');

    const { count: suitsBadgeCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('badge', 'Suits');

    let suitsSold = 0;
    const { data: suitsProducts } = await supabase
      .from('products')
      .select('id')
      .eq('category', 'suits');
    const suitsProductIds = (suitsProducts || []).map(p => p.id);
    if (suitsProductIds.length > 0) {
      const { data: suitsValidOrderIds } = await supabase
        .from('orders')
        .select('id')
        .not('status', 'in', '("cancelled","returned")');
      const validOrderSet = new Set((suitsValidOrderIds || []).map(o => o.id));

      const { data: suitsItems } = await supabase
        .from('order_items')
        .select('quantity, product_id, order_id')
        .in('product_id', suitsProductIds);

      (suitsItems || []).forEach(i => {
        if (validOrderSet.has(i.order_id)) {
          suitsSold += (i.quantity || 0);
        }
      });
    }

    // ---- Top 5 products ----
    const { data: topItems } = await supabase
      .from('order_items')
      .select('product_name, quantity, unit_price_dzd');
    const productSales = {};
    (topItems || []).forEach(i => {
      const name = i.product_name || 'Unknown';
      if (!productSales[name]) productSales[name] = { qty: 0, revenue: 0 };
      productSales[name].qty += (i.quantity || 0);
      productSales[name].revenue += (i.quantity || 0) * (i.unit_price_dzd || 0);
    });
    const topProducts = Object.entries(productSales)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    res.json({
      totalProducts,
      activeProducts,
      totalOrders,
      pendingOrders,
      totalContacts,
      productsSoldToday,
      productsSoldWeek,
      productsSoldMonth,
      productsSoldAll,
      ordersToday,
      ordersWeek,
      ordersMonth,
      revenueToday,
      revenueWeek,
      revenueMonth,
      revenueAll,
      avgOrderValue,
      ordersByStatus,
      productsByCategory,
      topProducts,
      suitsProductCount,
      suitsBadgeCount,
      suitsSold
    });
  } catch (err) {
    next(err);
  }
});

// ───── Product Promotions ─────
router.get('/products/:id/promotion', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('product_promotions')
      .select('*')
      .eq('product_id', req.params.id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data || null);
  } catch (err) { next(err); }
});

router.put('/products/:id/promotion', audit('update', 'promotion', (req) => req.params.id), async (req, res, next) => {
  try {
    const { discount_percent, start_date, end_date, is_active } = req.body;
    if (discount_percent === undefined || discount_percent < 1 || discount_percent > 100) {
      return res.status(400).json({ error: 'discount_percent must be between 1 and 100' });
    }
    const existing = await supabase
      .from('product_promotions')
      .select('id')
      .eq('product_id', req.params.id)
      .maybeSingle();
    const payload = {
      product_id: req.params.id,
      discount_percent,
      start_date: start_date || null,
      end_date: end_date || null,
      is_active: is_active !== undefined ? is_active : true
    };
    let result;
    if (existing.data) {
      const { data, error } = await supabase
        .from('product_promotions')
        .update(payload)
        .eq('id', existing.data.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('product_promotions')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      result = data;
    }
    res.json(result);
  } catch (err) { next(err); }
});

router.delete('/products/:id/promotion', audit('delete', 'promotion', (req) => req.params.id), async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('product_promotions')
      .delete()
      .eq('product_id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;