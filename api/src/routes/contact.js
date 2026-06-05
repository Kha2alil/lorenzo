const { Router } = require('express');
const supabase = require('../db');

const router = Router();

function stripHtml(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/<[^>]*>/g, '').trim();
}

router.post('/', async (req, res, next) => {
  try {
    const { name, phone, email, message } = req.body;

    if (!name || !phone || !message) {
      return res.status(400).json({ error: 'Name, phone, and message are required' });
    }

    const cleanName = stripHtml(name).slice(0, 100);
    const cleanPhone = stripHtml(phone).slice(0, 20);
    const cleanMessage = stripHtml(message).slice(0, 2000);
    const cleanEmail = email ? stripHtml(email).slice(0, 100) : null;

    if (!cleanName || !cleanPhone || !cleanMessage) {
      return res.status(400).json({ error: 'Invalid input after sanitization' });
    }

    const { error } = await supabase.from('contact_submissions').insert([
      { name: cleanName, phone: cleanPhone, email: cleanEmail, message: cleanMessage }
    ]);

    if (error) throw error;
    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
