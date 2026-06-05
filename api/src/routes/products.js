const { Router } = require('express');
const multer = require('multer');
const supabase = require('../db');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 }
});

const router = Router();

router.get('/image/*', async (req, res, next) => {
  try {
    const storagePath = req.params[0];
    if (!storagePath) {
      return res.status(400).json({ error: 'Image path is required' });
    }

    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*[a-zA-Z0-9]$/.test(storagePath)) {
      return res.status(400).json({ error: 'Invalid image path' });
    }

    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    const ext = storagePath.split('.').pop().toLowerCase();
    if (!allowedExts.includes(ext)) {
      return res.status(400).json({ error: 'Invalid image format' });
    }

    const { data, error } = await supabase.storage
      .from('product-images')
      .download(storagePath);

    if (error || !data) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeTypes = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
    res.set('Content-Type', mimeTypes[ext] || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const { data: products, error, count } = await supabase
      .from('products')
      .select('*', { count: 'exact' })
      .order('price_dzd', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    if (!products || products.length === 0) return res.json([]);

    const ids = products.map(p => p.id);
    const { data: images } = await supabase
      .from('product_images')
      .select('product_id, storage_path')
      .in('product_id', ids)
      .eq('is_primary', true);

    const imgMap = {};
    (images || []).forEach(img => { imgMap[img.product_id] = img.storage_path; });

    const { data: promotions } = await supabase
      .from('product_promotions')
      .select('*')
      .in('product_id', ids);

    const promoMap = {};
    (promotions || []).forEach(promo => {
      if (promo.is_active && (!promo.end_date || new Date(promo.end_date) >= new Date()) && (!promo.start_date || new Date(promo.start_date) <= new Date())) {
        promoMap[promo.product_id] = promo;
      }
    });

    const result = products.map(p => {
      const promo = promoMap[p.id];
      return {
        ...p,
        primary_image: imgMap[p.id] || null,
        promotion: promo || null
      };
    });

    res.set({
      'X-Pagination-Page': page,
      'X-Pagination-Limit': limit,
      'X-Pagination-Total': count || result.length,
      'X-Pagination-Pages': count ? Math.ceil(count / limit) : 1,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Top selling products (public)
router.get('/top', async (req, res, next) => {
  try {
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('product_name, quantity, orders!inner(placed_at, status)');

    const filtered = (orderItems || []).filter(i => {
      if (!i.orders) return false;
      if (['cancelled', 'returned'].includes(i.orders.status)) return false;
      return true;
    });

    const salesMap = {};
    filtered.forEach(item => {
      const name = item.product_name || 'Unknown';
      salesMap[name] = (salesMap[name] || 0) + (item.quantity || 0);
    });

    const sorted = Object.entries(salesMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name);

    const { data: products } = await supabase
      .from('products')
      .select('slug')
      .in('name', sorted);

    res.json((products || []).map(p => p.slug));
  } catch (err) {
    next(err);
  }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('slug', req.params.slug)
      .single();

    if (error || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const { data: images } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', product.id)
      .order('sort_order', { ascending: true });

    const { data: colors } = await supabase
      .from('product_colors')
      .select('*')
      .eq('product_id', product.id)
      .order('sort_order', { ascending: true });

    const { data: promo } = await supabase
      .from('product_promotions')
      .select('*')
      .eq('product_id', product.id)
      .single();

    let promotion = promo || null;
    if (promotion && (!promotion.is_active || (promotion.end_date && new Date(promotion.end_date) < new Date()) || (promotion.start_date && new Date(promotion.start_date) > new Date()))) {
      promotion = null;
    }

    product.images = images || [];
    product.colors = colors || [];
    product.promotion = promotion;
    res.json(product);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
