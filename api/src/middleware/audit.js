const supabase = require('../db');

function audit(action, resource, getResourceId) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      const resourceId = typeof getResourceId === 'function' ? getResourceId(req, res, body) : (getResourceId || null);
      const admin = req.admin || { id: null, email: 'api-key' };
      supabase.from('audit_logs').insert({
        admin_id: admin.id,
        admin_email: admin.email,
        action,
        resource,
        resource_id: resourceId,
        details: { method: req.method, path: req.originalUrl, body: sanitizeBody(req.body) },
        ip: req.ip
      }).then().catch(err => console.error('Audit log error:', err));
      return originalJson(body);
    };
    next();
  };
}

function sanitizeBody(body) {
  if (!body) return {};
  const safe = { ...body };
  const redact = ['password', 'token', 'password_hash', 'current_password', 'new_password', 'smtp_pass', 'secret', 'api_key'];
  redact.forEach(k => { if (k in safe) safe[k] = '***'; });
  return safe;
}

module.exports = { audit };
