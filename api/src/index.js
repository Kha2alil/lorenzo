require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const wilayasRouter = require('./routes/wilayas');
const contactRouter = require('./routes/contact');
const adminRouter = require('./routes/admin');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Try again in 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const contactLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: 'Too many submissions. Try again in 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const setupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: 'Too many setup attempts. Try again in 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const ordersPostLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many orders. Try again in 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const byPhoneLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  message: { error: 'Too many lookups. Try again in 1 minute.' },
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

const productsGetLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many requests. Try again in 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many admin requests. Try again in 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use('/api/admin/login', loginLimiter);
app.use('/api/admin/setup', setupLimiter);
app.use('/api/contact', contactLimiter);
app.use('/api/orders/by-phone', byPhoneLimiter);
app.use('/api/products', productsGetLimiter);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "https:", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  }
}));
const extraOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean) : [];
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:5502', 'http://localhost:5500', 'http://127.0.0.1:3001', 'http://127.0.0.1:5500', 'http://127.0.0.1:5502', ...extraOrigins],
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/wilayas', wilayasRouter);
app.use('/api/contact', contactRouter);
app.use('/api/admin', adminLimiter, adminRouter);

app.use(express.static(path.join(__dirname, '..', '..', 'admin')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'admin', 'index.html'));
});
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'admin', 'index.html'));
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`LORENZO API running on http://localhost:${PORT}`);
});
