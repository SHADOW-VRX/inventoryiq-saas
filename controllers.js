/**
 * controllers.js — All route handlers
 */

// FIX THE IMPORT PATH
const { Users, Sessions, Shops, Products, Subscriptions, Activity, Stats, PLANS, PLAN_LIMITS } = require('./models/db');

// ── JSON Helpers ───────────────────────────────────────

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c.toString(); if (body.length > 1e6) reject(new Error('Body too large')); });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

function json(res, status, data) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  };
  res.writeHead(status, headers);
  res.end(JSON.stringify(data));
}

function setCookie(res, name, value, options = {}) {
  const maxAge = options.maxAge || 604800; // 7 days
  const parts = [`${name}=${encodeURIComponent(value)}`, `Max-Age=${maxAge}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (options.secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Max-Age=0; Path=/; HttpOnly`);
}

// ── Sanitize user (no password) ───────────────────────
function safeUser(u) {
  const { password, ...rest } = u;
  return rest;
}

// ══════════════════════════════════════════════════════
//  AUTH CONTROLLERS
// ══════════════════════════════════════════════════════

async function register(req, res) {
  try {
    const body = await parseBody(req);
    const { email, password, name, shopName, phone, address, currency } = body;

    if (!email || !password || !name || !shopName)
      return json(res, 400, { success: false, error: 'email, password, name, shopName are required' });

    if (password.length < 6)
      return json(res, 400, { success: false, error: 'Password must be at least 6 characters' });

    // Create user first (no shop yet)
    const user = Users.create({ email, password, name, role: 'owner' });

    // Create their shop
    const shop = Shops.create({ name: shopName, ownerId: user.id, phone, address, currency: currency || 'USD' });

    // Link shop to user
    Users.update(user.id, { shopId: shop.id });

    // Create starter subscription
    Subscriptions.create(shop.id, 'starter');

    // Create session
    const token = Sessions.create(user.id, 'owner');

    // Log
    Activity.log(shop.id, user.id, 'account', `${name} registered and created shop "${shopName}"`);

    // Set cookie
    const updatedUser = Users.byId(user.id);
    setCookie(res, 'iq_token', token);
    json(res, 201, { success: true, token, user: safeUser(updatedUser), shop });

  } catch (err) {
    json(res, 400, { success: false, error: err.message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = await parseBody(req);
    if (!email || !password)
      return json(res, 400, { success: false, error: 'Email and password required' });

    const user = Users.byEmail(email);
    if (!user || !Users.checkPassword(user, password))
      return json(res, 401, { success: false, error: 'Invalid email or password' });

    const token = Sessions.create(user.id, user.role);
    const shop  = user.shopId ? Shops.byId(user.shopId) : null;
    const subscription = shop ? Subscriptions.byShop(shop.id) : null;

    if (shop) Activity.log(shop.id, user.id, 'account', `${user.name} logged in`);

    setCookie(res, 'iq_token', token);
    json(res, 200, { success: true, token, user: safeUser(user), shop, subscription });

  } catch (err) {
    json(res, 500, { success: false, error: err.message });
  }
}

async function logout(req, res) {
  const { extractToken } = require('./middleware/auth');
  const token = extractToken(req);
  if (token) Sessions.destroy(token);
  clearCookie(res, 'iq_token');
  json(res, 200, { success: true, message: 'Logged out' });
}

async function getMe(req, res) {
  const shop = req.shop;
  const sub  = shop ? Subscriptions.byShop(shop.id) : null;
  json(res, 200, { success: true, user: safeUser(req.user), shop, subscription: sub });
}

// ══════════════════════════════════════════════════════
//  ONBOARDING
// ══════════════════════════════════════════════════════

async function completeOnboarding(req, res) {
  try {
    const body = await parseBody(req);
    const shop = Shops.update(req.shop.id, {
      address:  body.address  || req.shop.address,
      phone:    body.phone    || req.shop.phone,
      currency: body.currency || req.shop.currency,
      logoUrl:  body.logoUrl  || req.shop.logoUrl,
      onboarded: true
    });
    json(res, 200, { success: true, shop });
  } catch (err) {
    json(res, 400, { success: false, error: err.message });
  }
}

// ══════════════════════════════════════════════════════
//  PRODUCTS
// ══════════════════════════════════════════════════════

async function getProducts(req, res) {
  try {
    const url = new URL(req.url, `http://localhost`);
    const search   = url.searchParams.get('search') || '';
    const category = url.searchParams.get('category') || '';
    const size     = url.searchParams.get('size') || '';

    let products = Products.all(req.shop.id);

    if (search) {
      const s = search.toLowerCase();
      products = products.filter(p =>
        p.name.toLowerCase().includes(s) ||
        p.barcode.includes(s) ||
        p.category.toLowerCase().includes(s)
      );
    }
    if (category) products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
    if (size)     products = products.filter(p => p.size.toLowerCase() === size.toLowerCase());

    json(res, 200, { success: true, data: products, total: products.length });
  } catch (err) {
    json(res, 500, { success: false, error: err.message });
  }
}

async function createProduct(req, res) {
  try {
    const body    = await parseBody(req);
    const product = Products.create(req.shop.id, body);
    Activity.log(req.shop.id, req.user.id, 'product_add', `Added product: ${product.name}`, { productId: product.id });
    json(res, 201, { success: true, data: product, message: 'Product created' });
  } catch (err) {
    json(res, 400, { success: false, error: err.message });
  }
}

async function updateProduct(req, res, id) {
  try {
    const body    = await parseBody(req);
    const product = Products.update(req.shop.id, id, body);
    if (!product) return json(res, 404, { success: false, error: 'Product not found' });
    Activity.log(req.shop.id, req.user.id, 'product_edit', `Updated product: ${product.name}`, { productId: id });
    json(res, 200, { success: true, data: product, message: 'Product updated' });
  } catch (err) {
    json(res, 400, { success: false, error: err.message });
  }
}

async function deleteProduct(req, res, id) {
  try {
    const product = Products.byId(req.shop.id, id);
    if (!product) return json(res, 404, { success: false, error: 'Product not found' });
    Products.delete(req.shop.id, id);
    Activity.log(req.shop.id, req.user.id, 'product_delete', `Deleted product: ${product.name}`, { productId: id });
    json(res, 200, { success: true, message: 'Product deleted' });
  } catch (err) {
    json(res, 500, { success: false, error: err.message });
  }
}

// ══════════════════════════════════════════════════════
//  SCAN & SELL
// ══════════════════════════════════════════════════════

async function scanBarcode(req, res) {
  try {
    const { barcode } = await parseBody(req);
    if (!barcode) return json(res, 400, { success: false, error: 'Barcode required' });
    const product = Products.byBarcode(req.shop.id, barcode);
    if (!product) return json(res, 404, { success: false, error: 'No product with this barcode' });
    json(res, 200, { success: true, data: product });
  } catch (err) {
    json(res, 500, { success: false, error: err.message });
  }
}

async function sellProduct(req, res) {
  try {
    const { id } = await parseBody(req);
    if (!id) return json(res, 400, { success: false, error: 'Product ID required' });
    const product = Products.sell(req.shop.id, id);
    if (!product) return json(res, 404, { success: false, error: 'Product not found' });
    Activity.log(req.shop.id, req.user.id, 'sale', `Sold 1x ${product.name}`, { productId: id, amount: product.price });
    json(res, 200, { success: true, data: product, message: `Sold 1x ${product.name}. Stock: ${product.stock}` });
  } catch (err) {
    const status = err.message === 'Out of stock' ? 400 : 500;
    json(res, status, { success: false, error: err.message });
  }
}

// ══════════════════════════════════════════════════════
//  STATS & ACTIVITY
// ══════════════════════════════════════════════════════

async function getStats(req, res) {
  try {
    const stats = Stats.forShop(req.shop.id);
    json(res, 200, { success: true, data: stats });
  } catch (err) {
    json(res, 500, { success: false, error: err.message });
  }
}

async function getActivity(req, res) {
  try {
    const url   = new URL(req.url, 'http://localhost');
    const limit = parseInt(url.searchParams.get('limit')) || 20;
    const logs  = Activity.byShop(req.shop.id, limit);
    json(res, 200, { success: true, data: logs });
  } catch (err) {
    json(res, 500, { success: false, error: err.message });
  }
}

// ══════════════════════════════════════════════════════
//  SHOP SETTINGS
// ══════════════════════════════════════════════════════

async function updateShop(req, res) {
  try {
    const body = await parseBody(req);
    const allowed = ['name','address','phone','currency','logoUrl'];
    const data = {};
    allowed.forEach(k => { if (body[k] !== undefined) data[k] = body[k]; });
    const shop = Shops.update(req.shop.id, data);
    Activity.log(req.shop.id, req.user.id, 'settings', 'Shop settings updated');
    json(res, 200, { success: true, shop, message: 'Settings saved' });
  } catch (err) {
    json(res, 400, { success: false, error: err.message });
  }
}

async function updateAccount(req, res) {
  try {
    const body = await parseBody(req);
    const data = {};
    if (body.name)     data.name = body.name.trim();
    if (body.password) {
      if (body.password.length < 6) return json(res, 400, { success: false, error: 'Password too short' });
      data.password = body.password;
    }
    const user = Users.update(req.user.id, data);
    json(res, 200, { success: true, user: safeUser(user), message: 'Account updated' });
  } catch (err) {
    json(res, 400, { success: false, error: err.message });
  }
}

// ══════════════════════════════════════════════════════
//  BILLING / PLANS
// ══════════════════════════════════════════════════════

async function getPlans(req, res) {
  json(res, 200, { success: true, data: PLANS, limits: PLAN_LIMITS });
}

async function upgradePlan(req, res) {
  try {
    const { plan } = await parseBody(req);
    if (!PLANS[plan]) return json(res, 400, { success: false, error: 'Invalid plan' });
    const sub = Subscriptions.upgrade(req.shop.id, plan);
    Activity.log(req.shop.id, req.user.id, 'billing', `Upgraded to ${plan} plan`);
    json(res, 200, { success: true, subscription: sub, message: `Upgraded to ${PLANS[plan].name} plan!` });
  } catch (err) {
    json(res, 400, { success: false, error: err.message });
  }
}

// ══════════════════════════════════════════════════════
//  SUPER ADMIN
// ══════════════════════════════════════════════════════

async function adminStats(req, res) {
  try {
    const stats = Stats.admin();
    json(res, 200, { success: true, data: stats });
  } catch (err) {
    json(res, 500, { success: false, error: err.message });
  }
}

async function adminShops(req, res) {
  try {
    const shops = Shops.all().map(shop => {
      const sub   = Subscriptions.byShop(shop.id);
      const owner = Users.byId(shop.ownerId);
      const prods = Products.all(shop.id).length;
      return { ...shop, subscription: sub, ownerEmail: owner?.email, productCount: prods };
    });
    json(res, 200, { success: true, data: shops });
  } catch (err) {
    json(res, 500, { success: false, error: err.message });
  }
}

async function adminUsers(req, res) {
  try {
    const users = Users.all()
      .filter(u => u.role !== 'superadmin')
      .map(u => safeUser(u));
    json(res, 200, { success: true, data: users });
  } catch (err) {
    json(res, 500, { success: false, error: err.message });
  }
}

async function adminDeleteShop(req, res, id) {
  try {
    const shop = Shops.byId(id);
    if (!shop) return json(res, 404, { success: false, error: 'Shop not found' });
    // Remove users of shop
    Users.all().filter(u => u.shopId === id).forEach(u => Users.delete(u.id));
    Shops.delete(id);
    json(res, 200, { success: true, message: 'Shop deleted' });
  } catch (err) {
    json(res, 500, { success: false, error: err.message });
  }
}

async function adminChangePlan(req, res, shopId) {
  try {
    const { plan } = await parseBody(req);
    if (!PLANS[plan]) return json(res, 400, { success: false, error: 'Invalid plan' });
    const sub = Subscriptions.upgrade(shopId, plan);
    json(res, 200, { success: true, subscription: sub });
  } catch (err) {
    json(res, 400, { success: false, error: err.message });
  }
}

module.exports = {
  register, login, logout, getMe, completeOnboarding,
  getProducts, createProduct, updateProduct, deleteProduct,
  scanBarcode, sellProduct,
  getStats, getActivity,
  updateShop, updateAccount,
  getPlans, upgradePlan,
  adminStats, adminShops, adminUsers, adminDeleteShop, adminChangePlan
};