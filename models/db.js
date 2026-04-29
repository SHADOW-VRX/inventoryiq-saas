/**
 * db.js — Core database layer
 * File-based JSON store with multi-tenant isolation.
 * Each shop gets its own products file.
 * Global: users.json, sessions.json, subscriptions.json, activity.json
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

// FIX THE DATA_DIR PATH — now at root/data
const DATA_DIR   = path.join(__dirname, '..', 'data');
const SHOPS_DIR  = path.join(DATA_DIR, 'shops');

// ── Helpers ────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(filePath, fallback = []) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function genId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'inventoryiq_salt_2024').digest('hex');
}

function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── File Paths ─────────────────────────────────────────

const FILES = {
  users:         path.join(DATA_DIR, 'users.json'),
  sessions:      path.join(DATA_DIR, 'sessions.json'),
  subscriptions: path.join(DATA_DIR, 'subscriptions.json'),
  activity:      path.join(DATA_DIR, 'activity.json'),
  shops:         path.join(DATA_DIR, 'shops.json'),
};

function shopFile(shopId) {
  return path.join(SHOPS_DIR, `${shopId}.json`);
}

// ── Seed Super Admin + Demo Data ───────────────────────

function seedIfEmpty() {
  ensureDir(DATA_DIR);
  ensureDir(SHOPS_DIR);

  // Users
  if (!fs.existsSync(FILES.users)) {
    const superAdmin = {
      id: 'user_superadmin',
      email: 'admin@inventoryiq.com',
      password: hashPassword('Admin@123'),
      name: 'Super Admin',
      role: 'superadmin',
      shopId: null,
      createdAt: new Date().toISOString(),
      verified: true
    };

    // Demo shop owner
    const demoShopId = 'shop_demo001';
    const demoUser = {
      id: 'user_demo001',
      email: 'owner@demo.com',
      password: hashPassword('Demo@123'),
      name: 'Alex Johnson',
      role: 'owner',
      shopId: demoShopId,
      createdAt: new Date().toISOString(),
      verified: true
    };

    writeJSON(FILES.users, [superAdmin, demoUser]);

    // Demo shop
    writeJSON(FILES.shops, [{
      id: demoShopId,
      name: "Alex's Clothing Store",
      slug: 'alexs-clothing',
      ownerId: 'user_demo001',
      address: '123 Fashion Ave, New York',
      phone: '+1 555-0100',
      currency: 'USD',
      plan: 'pro',
      createdAt: new Date().toISOString(),
      logoUrl: '',
      totalSales: 47
    }]);

    // Demo products
    writeJSON(shopFile(demoShopId), [
      { id:'p001', name:'Classic White Tee', price:29.99, size:'M', category:'T-Shirts', barcode:'1234567890123', stock:45, imageUrl:'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80', createdAt: new Date().toISOString() },
      { id:'p002', name:'Slim Fit Jeans',    price:79.99, size:'L', category:'Pants',   barcode:'9876543210987', stock:3,  imageUrl:'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&q=80', createdAt: new Date().toISOString() },
      { id:'p003', name:'Floral Summer Dress',price:54.99,size:'S', category:'Dresses', barcode:'1122334455667', stock:0,  imageUrl:'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400&q=80', createdAt: new Date().toISOString() },
      { id:'p004', name:'Hooded Sweatshirt', price:64.99, size:'XL',category:'Hoodies', barcode:'7766554433221', stock:12, imageUrl:'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=400&q=80', createdAt: new Date().toISOString() },
      { id:'p005', name:'Leather Jacket',    price:149.99,size:'M', category:'Jackets', barcode:'5544332211009', stock:2,  imageUrl:'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&q=80', createdAt: new Date().toISOString() },
      { id:'p006', name:'Striped Polo Shirt',price:44.99, size:'L', category:'T-Shirts',barcode:'3344556677889', stock:28, imageUrl:'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=400&q=80', createdAt: new Date().toISOString() },
      { id:'p007', name:'High-Waist Leggings',price:34.99,size:'S', category:'Pants',  barcode:'9988776655443', stock:7,  imageUrl:'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=400&q=80', createdAt: new Date().toISOString() },
      { id:'p008', name:'Bomber Jacket',     price:119.99,size:'M', category:'Jackets', barcode:'1122334455000', stock:5,  imageUrl:'https://images.unsplash.com/photo-1548126032-079a0fb0099d?w=400&q=80', createdAt: new Date().toISOString() }
    ]);

    // Demo subscriptions
    writeJSON(FILES.subscriptions, [{
      id: 'sub_demo001',
      shopId: demoShopId,
      plan: 'pro',
      status: 'active',
      startDate: new Date().toISOString(),
      renewalDate: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
      amount: 29
    }]);

    // Demo activity
    writeJSON(FILES.activity, [
      { id:'act001', shopId:demoShopId, userId:'user_demo001', type:'sale', message:'Sold 1x Classic White Tee', meta:{ productId:'p001', amount:29.99 }, createdAt: new Date(Date.now()-3600000).toISOString() },
      { id:'act002', shopId:demoShopId, userId:'user_demo001', type:'stock_add', message:'Added 10 units to Slim Fit Jeans', meta:{ productId:'p002', qty:10 }, createdAt: new Date(Date.now()-7200000).toISOString() },
      { id:'act003', shopId:demoShopId, userId:'user_demo001', type:'product_add', message:'Added new product: Bomber Jacket', meta:{ productId:'p008' }, createdAt: new Date(Date.now()-86400000).toISOString() },
    ]);

    writeJSON(FILES.sessions, []);
    console.log('[DB] Seed data created');
  }
}

// ═══════════════════════════════════════════════════════
//  USERS
// ═══════════════════════════════════════════════════════

const Users = {
  all: ()           => readJSON(FILES.users, []),
  byId: (id)        => Users.all().find(u => u.id === id) || null,
  byEmail: (email)  => Users.all().find(u => u.email.toLowerCase() === email.toLowerCase()) || null,

  create(data) {
    const users = Users.all();
    if (Users.byEmail(data.email)) throw new Error('Email already in use');

    const user = {
      id: genId('user'),
      email: data.email.trim().toLowerCase(),
      password: hashPassword(data.password),
      name: data.name.trim(),
      role: data.role || 'owner',
      shopId: data.shopId || null,
      createdAt: new Date().toISOString(),
      verified: true
    };
    users.push(user);
    writeJSON(FILES.users, users);
    return user;
  },

  update(id, data) {
    const users = Users.all();
    const i = users.findIndex(u => u.id === id);
    if (i === -1) return null;
    if (data.password) data.password = hashPassword(data.password);
    users[i] = { ...users[i], ...data };
    writeJSON(FILES.users, users);
    return users[i];
  },

  delete(id) {
    const users = Users.all().filter(u => u.id !== id);
    writeJSON(FILES.users, users);
  },

  checkPassword: (user, password) => user.password === hashPassword(password)
};

// ═══════════════════════════════════════════════════════
//  SESSIONS
// ═══════════════════════════════════════════════════════

const Sessions = {
  all: () => readJSON(FILES.sessions, []),

  create(userId, role) {
    const sessions = Sessions.all().filter(s => s.userId !== userId); // single session
    const token = genToken();
    const session = {
      token,
      userId,
      role,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
    sessions.push(session);
    writeJSON(FILES.sessions, sessions);
    return token;
  },

  find(token) {
    if (!token) return null;
    const session = Sessions.all().find(s => s.token === token);
    if (!session) return null;
    if (new Date(session.expiresAt) < new Date()) {
      Sessions.destroy(token);
      return null;
    }
    return session;
  },

  destroy(token) {
    const sessions = Sessions.all().filter(s => s.token !== token);
    writeJSON(FILES.sessions, sessions);
  }
};

// ═══════════════════════════════════════════════════════
//  SHOPS
// ═══════════════════════════════════════════════════════

const Shops = {
  all: ()      => readJSON(FILES.shops, []),
  byId: (id)   => Shops.all().find(s => s.id === id) || null,
  byOwner: (ownerId) => Shops.all().find(s => s.ownerId === ownerId) || null,

  create(data) {
    const shops = Shops.all();
    const shop = {
      id: genId('shop'),
      name: data.name.trim(),
      slug: data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      ownerId: data.ownerId,
      address: data.address || '',
      phone: data.phone || '',
      currency: data.currency || 'USD',
      plan: 'starter',
      createdAt: new Date().toISOString(),
      logoUrl: data.logoUrl || '',
      totalSales: 0
    };
    shops.push(shop);
    writeJSON(FILES.shops, shops);
    writeJSON(shopFile(shop.id), []);   // empty products file
    return shop;
  },

  update(id, data) {
    const shops = Shops.all();
    const i = shops.findIndex(s => s.id === id);
    if (i === -1) return null;
    shops[i] = { ...shops[i], ...data };
    writeJSON(FILES.shops, shops);
    return shops[i];
  },

  delete(id) {
    const shops = Shops.all().filter(s => s.id !== id);
    writeJSON(FILES.shops, shops);
    try { fs.unlinkSync(shopFile(id)); } catch {}
  },

  incrementSales(id) {
    const shops = Shops.all();
    const i = shops.findIndex(s => s.id === id);
    if (i === -1) return;
    shops[i].totalSales = (shops[i].totalSales || 0) + 1;
    writeJSON(FILES.shops, shops);
  }
};

// ═══════════════════════════════════════════════════════
//  PRODUCTS (per-shop)
// ═══════════════════════════════════════════════════════

const Products = {
  all: (shopId) => readJSON(shopFile(shopId), []),

  byId: (shopId, id) => Products.all(shopId).find(p => p.id === id) || null,

  byBarcode: (shopId, barcode) => Products.all(shopId).find(p => p.barcode === barcode) || null,

  create(shopId, data) {
    const products = Products.all(shopId);

    if (!data.name?.trim()) throw new Error('Product name is required');
    if (data.price === undefined || data.price === '') throw new Error('Price is required');
    if (isNaN(+data.price) || +data.price < 0) throw new Error('Invalid price');
    if (data.barcode && products.some(p => p.barcode === data.barcode))
      throw new Error('Barcode already exists');

    // Check plan limits
    const shop = Shops.byId(shopId);
    const limits = PLAN_LIMITS[shop?.plan || 'starter'];
    if (products.length >= limits.products)
      throw new Error(`Product limit reached for ${shop?.plan} plan (max ${limits.products}). Upgrade to add more.`);

    const product = {
      id: genId('prod'),
      name: data.name.trim(),
      price: parseFloat((+data.price).toFixed(2)),
      size: data.size || 'M',
      category: data.category || 'Uncategorized',
      barcode: data.barcode || '',
      stock: parseInt(data.stock) || 0,
      imageUrl: data.imageUrl || '',
      createdAt: new Date().toISOString()
    };
    products.push(product);
    writeJSON(shopFile(shopId), products);
    return product;
  },

  update(shopId, id, data) {
    const products = Products.all(shopId);
    const i = products.findIndex(p => p.id === id);
    if (i === -1) return null;

    if (data.price !== undefined && data.price !== '') {
      if (isNaN(+data.price) || +data.price < 0) throw new Error('Invalid price');
    }
    if (data.barcode && products.some(p => p.barcode === data.barcode && p.id !== id))
      throw new Error('Barcode already in use');

    products[i] = {
      ...products[i],
      ...(data.name      !== undefined && { name:     data.name.trim() }),
      ...(data.price     !== undefined && data.price !== '' && { price: parseFloat((+data.price).toFixed(2)) }),
      ...(data.size      !== undefined && { size:     data.size }),
      ...(data.category  !== undefined && { category: data.category }),
      ...(data.barcode   !== undefined && { barcode:  data.barcode }),
      ...(data.stock     !== undefined && { stock:    parseInt(data.stock) }),
      ...(data.imageUrl  !== undefined && { imageUrl: data.imageUrl }),
    };
    writeJSON(shopFile(shopId), products);
    return products[i];
  },

  delete(shopId, id) {
    const products = Products.all(shopId).filter(p => p.id !== id);
    writeJSON(shopFile(shopId), products);
    return true;
  },

  sell(shopId, id) {
    const products = Products.all(shopId);
    const i = products.findIndex(p => p.id === id);
    if (i === -1) return null;
    if (products[i].stock <= 0) throw new Error('Out of stock');
    products[i].stock -= 1;
    writeJSON(shopFile(shopId), products);
    Shops.incrementSales(shopId);
    return products[i];
  }
};

// ═══════════════════════════════════════════════════════
//  SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════

const PLANS = {
  starter: { name: 'Starter', price: 0,  interval: 'forever' },
  pro:     { name: 'Pro',     price: 29, interval: 'month' },
  business:{ name: 'Business',price: 79, interval: 'month' }
};

const PLAN_LIMITS = {
  starter:  { products: 50,   users: 1,  analytics: false, export: false },
  pro:      { products: 500,  users: 5,  analytics: true,  export: true  },
  business: { products: 9999, users: 20, analytics: true,  export: true  }
};

const Subscriptions = {
  all: ()           => readJSON(FILES.subscriptions, []),
  byShop: (shopId)  => Subscriptions.all().find(s => s.shopId === shopId) || null,

  create(shopId, plan) {
    const subs = Subscriptions.all().filter(s => s.shopId !== shopId);
    const sub = {
      id: genId('sub'),
      shopId,
      plan,
      status: 'active',
      startDate: new Date().toISOString(),
      renewalDate: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
      amount: PLANS[plan]?.price || 0
    };
    subs.push(sub);
    writeJSON(FILES.subscriptions, subs);
    Shops.update(shopId, { plan });
    return sub;
  },

  upgrade(shopId, newPlan) {
    return Subscriptions.create(shopId, newPlan);
  }
};

// ═══════════════════════════════════════════════════════
//  ACTIVITY LOG
// ═══════════════════════════════════════════════════════

const Activity = {
  all: ()                   => readJSON(FILES.activity, []),
  byShop: (shopId, limit=50)=> Activity.all().filter(a => a.shopId === shopId).slice(-limit).reverse(),

  log(shopId, userId, type, message, meta = {}) {
    const logs = Activity.all();
    logs.push({
      id: genId('act'),
      shopId,
      userId,
      type,
      message,
      meta,
      createdAt: new Date().toISOString()
    });
    // Keep last 500 globally
    if (logs.length > 500) logs.splice(0, logs.length - 500);
    writeJSON(FILES.activity, logs);
  }
};

// ═══════════════════════════════════════════════════════
//  STATS
// ═══════════════════════════════════════════════════════

const Stats = {
  forShop(shopId) {
    const products   = Products.all(shopId);
    const shop       = Shops.byId(shopId);
    const sub        = Subscriptions.byShop(shopId);
    const activity   = Activity.byShop(shopId, 100);
    const limits     = PLAN_LIMITS[shop?.plan || 'starter'];

    const totalProducts   = products.length;
    const totalStock      = products.reduce((s, p) => s + p.stock, 0);
    const lowStock        = products.filter(p => p.stock > 0 && p.stock <= 5);
    const outOfStock      = products.filter(p => p.stock === 0);
    const inventoryValue  = products.reduce((s, p) => s + p.price * p.stock, 0);

    // Category breakdown
    const categories = {};
    products.forEach(p => { categories[p.category] = (categories[p.category]||0)+1; });

    // Sales in last 30 days (from activity)
    const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000);
    const recentSales = activity.filter(a => a.type === 'sale' && new Date(a.createdAt) > thirtyDaysAgo);
    const salesRevenue = recentSales.reduce((s, a) => s + (a.meta?.amount || 0), 0);

    return {
      totalProducts, totalStock,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      inventoryValue: +inventoryValue.toFixed(2),
      totalSales: shop?.totalSales || 0,
      salesRevenue30d: +salesRevenue.toFixed(2),
      categories,
      lowStockItems: lowStock,
      outOfStockItems: outOfStock,
      plan: shop?.plan || 'starter',
      limits,
      subscription: sub,
      recentActivity: activity.slice(0, 10)
    };
  },

  admin() {
    const shops = Shops.all();
    const users = Users.all();
    const subs  = Subscriptions.all();
    const mrr   = subs.filter(s => s.status === 'active').reduce((s, sub) => s + (sub.amount||0), 0);

    return {
      totalShops:    shops.length,
      totalUsers:    users.filter(u => u.role !== 'superadmin').length,
      activeShops:   shops.length,
      mrr,
      planBreakdown: {
        starter:  shops.filter(s => s.plan === 'starter').length,
        pro:      shops.filter(s => s.plan === 'pro').length,
        business: shops.filter(s => s.plan === 'business').length
      },
      recentShops: shops.slice(-5).reverse()
    };
  }
};

// Init seed data
seedIfEmpty();

module.exports = { Users, Sessions, Shops, Products, Subscriptions, Activity, Stats, PLANS, PLAN_LIMITS, hashPassword, genId };