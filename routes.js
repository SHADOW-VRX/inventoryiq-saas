/**
 * routes.js — Full SaaS routing table
 */

// FIX THE IMPORT PATH - remove the extra '..'
const ctrl  = require('./controllers');
const { requireAuth, requireAdmin } = require('./middleware/auth');

function extractId(path, prefix) {
  return path.replace(prefix, '').split('?')[0].split('/')[0];
}

async function router(req, res, serveStatic) {
  const method = req.method.toUpperCase();
  const url    = req.url || '/';
  const path   = url.split('?')[0];

  // ── CORS preflight ──────────────────────────────────
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    });
    return res.end();
  }

  // ── Wrap handlers with auth ──────────────────────────
  function auth(handler, adminOnly = false) {
    return (id) => new Promise((resolve, reject) => {
      const mid = adminOnly ? requireAdmin : requireAuth;
      mid(req, res, async () => {
        try { await handler(req, res, id); resolve(); }
        catch (e) { reject(e); }
      });
    });
  }

  // ══════════════════════════════════════════════════
  //  PUBLIC ROUTES
  // ══════════════════════════════════════════════════

  if (method === 'POST' && path === '/api/auth/register')  return ctrl.register(req, res);
  if (method === 'POST' && path === '/api/auth/login')     return ctrl.login(req, res);
  if (method === 'POST' && path === '/api/auth/logout')    return ctrl.logout(req, res);
  if (method === 'GET'  && path === '/api/plans')          return ctrl.getPlans(req, res);

  // ══════════════════════════════════════════════════
  //  PROTECTED — OWNER
  // ══════════════════════════════════════════════════

  if (method === 'GET'  && path === '/api/me')             return auth(ctrl.getMe)();
  if (method === 'POST' && path === '/api/onboarding')     return auth(ctrl.completeOnboarding)();

  // Products
  if (method === 'GET'  && path === '/api/products')          return auth(ctrl.getProducts)();
  if (method === 'POST' && path === '/api/products')          return auth(ctrl.createProduct)();
  if (method === 'PUT'  && path.startsWith('/api/products/')) return auth(ctrl.updateProduct)(extractId(path, '/api/products/'));
  if (method === 'DELETE' && path.startsWith('/api/products/')) return auth(ctrl.deleteProduct)(extractId(path, '/api/products/'));

  // Scanner & Sell
  if (method === 'POST' && path === '/api/scan')  return auth(ctrl.scanBarcode)();
  if (method === 'POST' && path === '/api/sell')  return auth(ctrl.sellProduct)();

  // Stats & Activity
  if (method === 'GET' && path === '/api/stats')    return auth(ctrl.getStats)();
  if (method === 'GET' && path === '/api/activity') return auth(ctrl.getActivity)();

  // Settings
  if (method === 'PUT' && path === '/api/shop')    return auth(ctrl.updateShop)();
  if (method === 'PUT' && path === '/api/account') return auth(ctrl.updateAccount)();

  // Billing
  if (method === 'POST' && path === '/api/billing/upgrade') return auth(ctrl.upgradePlan)();

  // ══════════════════════════════════════════════════
  //  SUPER ADMIN
  // ══════════════════════════════════════════════════

  if (method === 'GET'    && path === '/api/admin/stats')                     return auth(ctrl.adminStats, true)();
  if (method === 'GET'    && path === '/api/admin/shops')                     return auth(ctrl.adminShops, true)();
  if (method === 'GET'    && path === '/api/admin/users')                     return auth(ctrl.adminUsers, true)();
  if (method === 'DELETE' && path.startsWith('/api/admin/shops/'))            return auth(ctrl.adminDeleteShop, true)(extractId(path, '/api/admin/shops/'));
  if (method === 'PUT'    && path.match(/^\/api\/admin\/shops\/[^/]+\/plan/)) {
    const shopId = path.replace('/api/admin/shops/', '').replace('/plan', '');
    return auth(ctrl.adminChangePlan, true)(shopId);
  }

  // ══════════════════════════════════════════════════
  //  STATIC FILES (SPA fallback)
  // ══════════════════════════════════════════════════

  return serveStatic(req, res, path);
}

module.exports = router;