/**
 * InventoryIQ SaaS — Frontend v3
 * Pure Vanilla JS · No frameworks · Multi-tenant
 * Author: OM
 */

// ═══════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════
const S = {
  user: null, shop: null, subscription: null,
  products: [],
  allActivity: [],
  filteredActivity: [],
  scanHistory: [], scannedProduct: null,
  qrScanner: null, scannerActive: false,
  deleteTargetId: null,
  stockModalAction: null, stockModalId: null,
  upgradePlanTarget: null
};

// ═══════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════
const g       = id => document.getElementById(id);
const setText = (id, v) => { const el = g(id); if (el) el.textContent = v; };
const setVal  = (id, v) => { const el = g(id); if (el) el.value = v; };
const clearErr= ids => ids.forEach(id => setText(id, ''));

function setErr(errId, inputId, msg) {
  setText(errId, msg);
  g(inputId)?.classList.add('error');
}
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
function timeAgo(iso) {
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60)    return 'just now';
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 604800)return `${Math.floor(secs / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function imgOrIcon(url, cls, icon) {
  if (url) return `<img src="${esc(url)}" class="${cls}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" alt=""><div class="${cls}" style="display:none;align-items:center;justify-content:center;font-size:.9rem;color:var(--gray-400)"><i class="fas fa-${icon}"></i></div>`;
  return `<div class="${cls}" style="display:flex;align-items:center;justify-content:center;font-size:.9rem;color:var(--gray-400)"><i class="fas fa-${icon}"></i></div>`;
}

// ═══════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════
const TOAST_ICONS = {
  success: 'fa-check-circle', error: 'fa-times-circle',
  warning: 'fa-exclamation-triangle', info: 'fa-info-circle'
};
function toast(msg, type = 'info', duration = 3500) {
  const wrap = g('toast-wrap');
  const el   = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fas ${TOAST_ICONS[type]} toast-icon"></i><span class="toast-msg">${msg}</span><button class="toast-x" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
  wrap.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, duration);
}

// ═══════════════════════════════════════════
//  API
// ═══════════════════════════════════════════
async function api(url, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include' };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(url, opts);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Request failed');
  return data;
}

// ═══════════════════════════════════════════
//  PAGE SYSTEM
// ═══════════════════════════════════════════
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const p = g(`${name}-page`);
  if (p) p.classList.add('active');
  window.scrollTo(0, 0);
}

// ═══════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════
function setAuthMode(mode) {
  const isLogin = mode === 'login';
  g('login-form-wrap').style.display    = isLogin ? '' : 'none';
  g('register-form-wrap').style.display = isLogin ? 'none' : '';
  g('auth-left-title').textContent = isLogin ? 'Welcome back' : 'Start for free today';
  g('auth-left-sub').textContent   = isLogin
    ? 'Your shop dashboard is one click away. Manage inventory, track sales, and grow your business.'
    : 'Set up your shop in under 2 minutes and take full control of your inventory.';
  showPage('auth');
}

async function handleLogin(e) {
  e.preventDefault();
  const email    = g('l-email').value.trim();
  const password = g('l-password').value;
  clearErr(['l-email-err', 'l-pass-err']);

  if (!email)    { setErr('l-email-err', 'l-email', 'Email required'); return; }
  if (!password) { setErr('l-pass-err', 'l-password', 'Password required'); return; }

  const btn = g('login-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

  try {
    const res = await api('/api/auth/login', 'POST', { email, password });
    S.user = res.user; S.shop = res.shop; S.subscription = res.subscription;
    toast(`Welcome back, ${res.user.name}! 👋`, 'success');
    afterAuth();
  } catch (err) {
    setErr('l-pass-err', 'l-password', err.message);
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Sign In</span><i class="fas fa-arrow-right"></i>';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name     = g('r-name').value.trim();
  const shopName = g('r-shop').value.trim();
  const email    = g('r-email').value.trim();
  const password = g('r-password').value;
  clearErr(['r-name-err', 'r-shop-err', 'r-email-err', 'r-pass-err']);

  let ok = true;
  if (!name)                          { setErr('r-name-err', 'r-name', 'Name required'); ok = false; }
  if (!shopName)                      { setErr('r-shop-err', 'r-shop', 'Shop name required'); ok = false; }
  if (!email)                         { setErr('r-email-err', 'r-email', 'Email required'); ok = false; }
  if (!password || password.length<6) { setErr('r-pass-err', 'r-password', 'Min. 6 characters'); ok = false; }
  if (!ok) return;

  const btn = g('register-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

  try {
    const res = await api('/api/auth/register', 'POST', { name, shopName, email, password });
    S.user = res.user; S.shop = res.shop; S.subscription = res.subscription;
    toast(`Account created! Welcome, ${res.user.name}! 🎉`, 'success');
    showPage('onboarding');
  } catch (err) {
    setErr('r-email-err', 'r-email', err.message);
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-rocket"></i><span>Create Account — It\'s Free</span>';
  }
}

async function doLogout() {
  try { await api('/api/auth/logout', 'POST'); } catch {}
  S.user = null; S.shop = null; S.subscription = null;
  stopScanner();
  showPage('landing');
  toast('Signed out successfully', 'info', 2000);
}

async function checkAuth() {
  try {
    const res = await api('/api/me');
    S.user = res.user; S.shop = res.shop; S.subscription = res.subscription;
    afterAuth();
  } catch {
    showPage('landing');
  }
}

function afterAuth() {
  // Super admin has no shop — send them straight to the admin panel
  if (S.user?.role === 'superadmin') {
    setupAdminUI();
    showPage('app');
    navigateTab('admin');
    return;
  }
  if (!S.shop) { showPage('auth'); return; }
  setupAppUI();
  showPage('app');
  navigateTab('dashboard');
}

// ═══════════════════════════════════════════
//  ONBOARDING
// ═══════════════════════════════════════════
async function obStep1Submit() {
  const btn = g('ob-step1-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  try {
    await api('/api/onboarding', 'POST', {
      phone:    g('ob-phone').value,
      currency: g('ob-currency').value,
      address:  g('ob-address').value,
      logoUrl:  g('ob-logo').value
    });
    obGotoStep(2);
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Continue <i class="fas fa-arrow-right"></i>';
  }
}

async function obStep2Submit() {
  const name  = g('ob-prod-name').value.trim();
  const price = g('ob-prod-price').value;
  if (!name || !price) { toast('Name and price required', 'warning'); return; }
  try {
    await api('/api/products', 'POST', {
      name, price,
      category: g('ob-prod-cat').value || 'Uncategorized',
      stock:    g('ob-prod-stock').value || 0
    });
    obGotoStep(3);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function obGotoStep(step) {
  [1, 2, 3].forEach(i => {
    g(`ob-panel-${i}`).style.display = i === step ? '' : 'none';
    const dot = g(`ob-dot-${i}`);
    dot.className = i < step ? 'step-dot done' : i === step ? 'step-dot active' : 'step-dot';
    g(`ob-step-${i}`).className = i === step ? 'onboard-step active' : 'onboard-step';
  });
  for (let i = 1; i <= 2; i++) {
    const conn = g(`ob-conn-${i}`);
    if (conn) conn.className = i < step ? 'step-connector done' : 'step-connector';
  }
}

function skipOnboarding() { goToDashboard(); }
function goToDashboard()   { afterAuth(); }

// ═══════════════════════════════════════════
//  APP UI SETUP
// ═══════════════════════════════════════════
function setupAppUI() {
  const { user, shop } = S;
  if (!user || !shop) return;

  const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  setText('sb-user-name', user.name);
  setText('sb-user-role', user.role === 'superadmin' ? '⚡ Super Admin' : 'Shop Owner');
  setText('sb-plan-name', capitalize(shop.plan || 'starter'));
  setText('sidebar-brand', shop.name || 'InventoryIQ');
  setText('page-subtitle', shop.name);
  if (g('sb-avatar')) g('sb-avatar').textContent = initials;

  // Admin nav
  const adminNav = g('admin-nav-item');
  if (adminNav) adminNav.style.display = user.role === 'superadmin' ? 'flex' : 'none';

  // Settings prefill
  setVal('ss-name', shop.name || '');
  setVal('ss-address', shop.address || '');
  setVal('ss-phone', shop.phone || '');
  setVal('ss-currency', shop.currency || 'USD');
  setVal('ss-logo', shop.logoUrl || '');
  setVal('as-name', user.name);
  setVal('as-email', user.email);
  setText('acc-email-display', user.email);
  setText('acc-role-display', capitalize(user.role));
  setText('acc-shop-display', shop.name);
  setText('acc-plan-display', capitalize(shop.plan || 'starter'));
}

/**
 * setupAdminUI — configure sidebar for superadmin (who has no shop)
 */
function setupAdminUI() {
  const { user } = S;
  if (!user) return;

  const initials = (user.name || 'SA').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  setText('sb-user-name', user.name);
  setText('sb-user-role', '⚡ Super Admin');
  setText('sb-plan-name', 'Admin');
  setText('sidebar-brand', 'InventoryIQ');
  setText('page-subtitle', 'Super Admin Panel');
  if (g('sb-avatar')) g('sb-avatar').textContent = initials;

  // Show admin nav, hide shop-specific items
  const adminNav = g('admin-nav-item');
  if (adminNav) adminNav.style.display = 'flex';

  setVal('as-name', user.name);
  setVal('as-email', user.email);
  setText('acc-email-display', user.email);
  setText('acc-role-display', 'Super Admin');
  setText('acc-shop-display', '— (Global Admin)');
  setText('acc-plan-display', 'Unlimited');
}

// ═══════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════
function navigateTab(tab) {
  document.querySelectorAll('.nav-item[data-tab]').forEach(n =>
    n.classList.toggle('active', n.dataset.tab === tab)
  );
  document.querySelectorAll('.tab-content').forEach(t =>
    t.classList.toggle('active', t.id === `tab-${tab}`)
  );

  const titles = {
    dashboard: ['Dashboard',     'Your shop overview'],
    products:  ['Products',      'Manage your product catalog'],
    scanner:   ['Scanner',       'Scan barcodes in real-time'],
    stock:     ['Stock',         'Monitor and update inventory'],
    activity:  ['Activity Log',  'Full audit trail of all actions'],
    billing:   ['Billing',       'Manage your subscription'],
    settings:  ['Settings',      'Shop and account settings'],
    admin:     ['Admin Panel',   'Manage all shops and users']
  };
  const [title, sub] = titles[tab] || ['', ''];
  setText('page-title', title);
  setText('page-subtitle', sub);

  if (tab !== 'scanner') stopScanner();
  if (tab === 'dashboard') loadDashboard();
  if (tab === 'products')  loadProducts();
  if (tab === 'stock')     loadStockTable();
  if (tab === 'activity')  loadActivity();
  if (tab === 'billing')   loadBilling();
  if (tab === 'admin')     loadAdminPanel();
  closeSidebar();
}

// ═══════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════
async function loadDashboard() {
  try {
    const { data: st } = await api('/api/stats');

    setText('s-products', st.totalProducts);
    setText('s-stock',    st.totalStock.toLocaleString());
    setText('s-low',      st.lowStockCount);
    setText('s-out',      st.outOfStockCount);
    setText('s-value',    '$' + st.inventoryValue.toLocaleString('en-US', { minimumFractionDigits: 2 }));
    setText('s-sales',    st.totalSales);
    setText('d-low-badge', st.lowStockCount);
    setText('d-out-badge', st.outOfStockCount);

    // Sidebar alert badge
    const lsb = g('nb-lowstock');
    const alerts = st.lowStockCount + st.outOfStockCount;
    if (alerts > 0) {
      lsb.style.display = '';
      lsb.textContent = alerts;
    } else {
      lsb.style.display = 'none';
    }

    // Products badge in nav
    const nb = g('nb-products');
    if (nb) {
      nb.textContent = st.totalProducts;
      nb.style.display = st.totalProducts > 0 ? '' : 'none';
    }

    // Plan usage
    const used = st.totalProducts;
    const max  = st.limits?.products || 50;
    const pct  = Math.min(Math.round((used / max) * 100), 100);
    setText('plan-usage-text', `${used} / ${max} products`);
    const bar = g('plan-usage-bar');
    if (bar) {
      bar.style.width = pct + '%';
      bar.className = 'progress-bar' + (pct >= 90 ? ' danger' : pct >= 70 ? ' warn' : '');
    }
    const planHint = g('plan-usage-hint');
    if (planHint) planHint.innerHTML = `You're on the <strong>${capitalize(st.plan)}</strong> plan`;
    setText('sb-plan-name', capitalize(st.plan));

    // Sidebar plan widget
    const wb = g('plan-widget-bar');
    if (wb) {
      wb.style.width = pct + '%';
      wb.className = 'plan-progress-bar' + (pct >= 90 ? ' danger' : pct >= 70 ? ' warn' : '');
    }
    setText('plan-widget-hint', `${used} / ${max} products`);

    // Hide upgrade btn if business
    const planCard = g('plan-usage-card');
    if (planCard) {
      const upBtn = planCard.querySelector('.btn');
      if (upBtn) upBtn.style.display = st.plan === 'business' ? 'none' : '';
    }

    renderAlertList('d-low-list', st.lowStockItems, 'low');
    renderAlertList('d-out-list', st.outOfStockItems, 'out');
    renderCategories(st.categories, st.totalProducts);
    renderActivity(st.recentActivity, 'd-activity');
    renderDashProductTable(st);

  } catch (err) {
    toast('Failed to load dashboard: ' + err.message, 'error');
  }
}

function renderAlertList(id, items, type) {
  const el = g(id);
  if (!items?.length) {
    el.innerHTML = `<div class="empty-state sm"><i class="fas fa-check-circle" style="color:var(--success)"></i><p>${type === 'low' ? 'All stocked up!' : 'Nothing out of stock!'}</p></div>`;
    return;
  }
  el.innerHTML = items.map(p => `
    <div class="alert-item">
      ${imgOrIcon(p.imageUrl, 'alert-thumb', 'tshirt')}
      <div class="alert-info">
        <div class="alert-name">${esc(p.name)}</div>
        <div class="alert-stock ${type}">${type === 'low' ? `⚠ ${p.stock} left` : '❌ Out of stock'}</div>
      </div>
      <span class="tag">${p.size}</span>
    </div>`).join('');
}

function renderCategories(cats, total) {
  const el = g('d-cats');
  if (!cats || !Object.keys(cats).length) {
    el.innerHTML = '<div class="empty-state sm"><i class="fas fa-folder"></i><p>No categories yet</p></div>';
    return;
  }
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  el.innerHTML = sorted.map(([name, count]) => `
    <div class="cat-item">
      <span class="cat-name">${esc(name)}</span>
      <div class="cat-bar-track">
        <div class="cat-bar-fill" style="width:${total > 0 ? Math.round(count / total * 100) : 0}%"></div>
      </div>
      <span class="cat-count">${count}</span>
    </div>`).join('');
}

const ACT_ICONS = {
  sale: 'fa-shopping-cart', product_add: 'fa-plus', product_edit: 'fa-edit',
  product_delete: 'fa-trash', stock_add: 'fa-layer-group', account: 'fa-user',
  billing: 'fa-credit-card', settings: 'fa-cog'
};
function renderActivity(logs, targetId = 'd-activity') {
  const el = g(targetId);
  if (!el) return;
  if (!logs?.length) {
    el.innerHTML = '<div class="empty-state sm"><i class="fas fa-history"></i><p>No activity yet</p></div>';
    return;
  }
  el.innerHTML = logs.map(a => `
    <div class="activity-item">
      <div class="activity-icon ${a.type}">
        <i class="fas ${ACT_ICONS[a.type] || 'fa-dot-circle'}"></i>
      </div>
      <div class="activity-body">
        <div class="activity-msg">${esc(a.message)}</div>
        <div class="activity-time">${timeAgo(a.createdAt)}</div>
      </div>
    </div>`).join('');
}

function renderDashProductTable(st) {
  const tbody = g('dash-products-tbody');
  if (!tbody) return;
  api('/api/products').then(({ data }) => {
    if (!data?.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="tbl-empty">No products yet. <a href="#" onclick="openAddProductModal()" style="color:var(--primary)">Add one!</a></td></tr>';
      return;
    }
    // Sort: out → low → in stock
    const sorted = [...data].sort((a, b) => {
      const rank = p => p.stock === 0 ? 0 : p.stock <= 5 ? 1 : 2;
      return rank(a) - rank(b);
    }).slice(0, 8);

    tbody.innerHTML = sorted.map(p => {
      const st   = p.stock === 0 ? 'out' : p.stock <= 5 ? 'low' : 'in';
      const stLabel = p.stock === 0 ? 'Out of Stock' : p.stock <= 5 ? 'Low Stock' : 'In Stock';
      return `<tr>
        <td><div class="tbl-product">${imgOrIcon(p.imageUrl, 'tbl-thumb', 'tshirt')}<span class="tbl-name">${esc(p.name)}</span></div></td>
        <td><span class="tag">${esc(p.category)}</span></td>
        <td><strong>$${p.price.toFixed(2)}</strong></td>
        <td><strong>${p.stock}</strong></td>
        <td><span class="status-pill ${st}">${stLabel}</span></td>
        <td><div class="tbl-actions">
          <button class="icon-btn" title="Edit" onclick="openEditModal('${p.id}')"><i class="fas fa-edit"></i></button>
          <button class="icon-btn success" title="Sell" onclick="quickSell('${p.id}')" ${p.stock === 0 ? 'disabled' : ''}><i class="fas fa-shopping-cart"></i></button>
        </div></td>
      </tr>`;
    }).join('');
  }).catch(() => {
    tbody.innerHTML = '<tr><td colspan="6" class="tbl-empty">—</td></tr>';
  });
}

// ═══════════════════════════════════════════
//  PRODUCTS
// ═══════════════════════════════════════════
async function loadProducts() {
  const grid = g('product-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-grid"><i class="fas fa-spinner fa-spin"></i><p>Loading products...</p></div>';
  try {
    const params = new URLSearchParams();
    const search = g('p-search')?.value; if (search) params.set('search', search);
    const cat    = g('p-cat')?.value;    if (cat)    params.set('category', cat);
    const size   = g('p-size')?.value;   if (size)   params.set('size', size);

    let { data: products } = await api('/api/products?' + params.toString());

    const sf = g('p-stock-filter')?.value;
    if (sf === 'in')  products = products.filter(p => p.stock > 5);
    if (sf === 'low') products = products.filter(p => p.stock > 0 && p.stock <= 5);
    if (sf === 'out') products = products.filter(p => p.stock === 0);

    S.products = products;
    updateCatDropdown(products);

    // Update products badge
    const nb = g('nb-products');
    if (nb) { nb.textContent = products.length; nb.style.display = products.length > 0 ? '' : 'none'; }

    if (!products.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <i class="fas fa-box-open"></i>
        <p>No products found</p>
        <button class="btn btn-primary btn-sm" onclick="openAddProductModal()"><i class="fas fa-plus"></i> Add First Product</button>
      </div>`;
      return;
    }
    grid.innerHTML = products.map(renderProductCard).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-exclamation-circle"></i><p>${err.message}</p></div>`;
  }
}

function renderProductCard(p) {
  const st = p.stock === 0 ? 'out' : p.stock <= 5 ? 'low' : 'in';
  const stLabel = p.stock === 0 ? 'Out' : p.stock <= 5 ? `Low: ${p.stock}` : 'In Stock';
  const stTxtCls = p.stock === 0 ? 'out' : p.stock <= 5 ? 'low' : 'ok';
  return `
  <div class="product-card">
    <div class="pc-img-wrap">
      ${p.imageUrl
        ? `<img src="${esc(p.imageUrl)}" class="pc-img" loading="lazy" alt="${esc(p.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : ''}
      <div class="pc-img-placeholder" style="${p.imageUrl ? 'display:none' : ''}"><i class="fas fa-tshirt"></i></div>
      <span class="pc-stock-badge ${st}">${stLabel}</span>
    </div>
    <div class="pc-body">
      <div class="pc-name" title="${esc(p.name)}">${esc(p.name)}</div>
      <div class="pc-tags">
        <span class="tag primary">${esc(p.category)}</span>
        <span class="tag">${p.size}</span>
      </div>
      <div class="pc-price-row">
        <span class="pc-price">$${p.price.toFixed(2)}</span>
        <span class="pc-stock-txt ${stTxtCls}">${p.stock} units</span>
      </div>
      ${p.barcode ? `<div class="pc-barcode"><i class="fas fa-barcode"></i> ${esc(p.barcode)}</div>` : ''}
    </div>
    <div class="pc-actions">
      <button class="btn btn-secondary" onclick="openEditModal('${p.id}')"><i class="fas fa-edit"></i> Edit</button>
      <button class="btn btn-sell" onclick="quickSell('${p.id}')" ${p.stock === 0 ? 'disabled' : ''}><i class="fas fa-shopping-cart"></i> Sell</button>
      <button class="btn btn-danger" onclick="openDeleteModal('${p.id}','${esc(p.name)}')"><i class="fas fa-trash"></i></button>
    </div>
  </div>`;
}

function updateCatDropdown(products) {
  const sel = g('p-cat');
  if (!sel) return;
  const cur  = sel.value;
  const cats = [...new Set(products.map(p => p.category))].sort();
  sel.innerHTML = '<option value="">All Categories</option>' +
    cats.map(c => `<option ${c === cur ? 'selected' : ''}>${esc(c)}</option>`).join('');
}

async function quickSell(id) {
  try {
    const r = await api('/api/sell', 'POST', { id });
    toast(r.message, 'success');
    loadProducts();
    loadDashboard();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Product Modal ──────────────────────────
function openAddProductModal() {
  setText('pm-title', 'Add New Product');
  setVal('pm-id', '');
  ['pm-name', 'pm-price', 'pm-category', 'pm-barcode'].forEach(id => setVal(id, ''));
  setVal('pm-size', 'M');
  setVal('pm-stock', '0');
  setVal('pm-image', '');
  clearModalErrs();
  if (g('pm-img-preview-wrap')) g('pm-img-preview-wrap').style.display = 'none';
  openModal('product-modal');
}

async function openEditModal(id) {
  try {
    const { data: products } = await api('/api/products');
    const p = products.find(x => x.id === id);
    if (!p) return toast('Product not found', 'error');
    setText('pm-title', 'Edit Product');
    setVal('pm-id',       p.id);
    setVal('pm-name',     p.name);
    setVal('pm-price',    p.price);
    setVal('pm-category', p.category);
    setVal('pm-size',     p.size);
    setVal('pm-barcode',  p.barcode || '');
    setVal('pm-stock',    p.stock);
    setVal('pm-image',    p.imageUrl || '');
    clearModalErrs();
    const prevWrap = g('pm-img-preview-wrap');
    if (p.imageUrl) {
      g('pm-img-preview').src = p.imageUrl;
      prevWrap.style.display = '';
    } else {
      prevWrap.style.display = 'none';
    }
    openModal('product-modal');
  } catch (err) {
    toast(err.message, 'error');
  }
}

function clearModalErrs() {
  ['pm-name-err', 'pm-price-err'].forEach(id => setText(id, ''));
  ['pm-name', 'pm-price'].forEach(id => g(id)?.classList.remove('error'));
}

async function saveProduct() {
  clearModalErrs();
  const name  = g('pm-name').value.trim();
  const price = g('pm-price').value;
  let ok = true;
  if (!name) {
    g('pm-name').classList.add('error');
    setText('pm-name-err', 'Name required');
    ok = false;
  }
  if (price === '' || price === null || price === undefined) {
    g('pm-price').classList.add('error');
    setText('pm-price-err', 'Price required');
    ok = false;
  }
  if (!ok) return;

  const id   = g('pm-id').value;
  const body = {
    name, price,
    category: g('pm-category').value || 'Uncategorized',
    size:     g('pm-size').value,
    barcode:  g('pm-barcode').value,
    stock:    g('pm-stock').value,
    imageUrl: g('pm-image').value
  };

  const btn = g('pm-save-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  try {
    if (id) {
      await api(`/api/products/${id}`, 'PUT', body);
      toast('Product updated!', 'success');
    } else {
      await api('/api/products', 'POST', body);
      toast('Product added!', 'success');
    }
    closeModal('product-modal');
    loadProducts();
    loadDashboard();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Save';
  }
}

// ── Delete ─────────────────────────────────
function openDeleteModal(id, name) {
  S.deleteTargetId = id;
  setText('del-prod-name', name);
  openModal('delete-modal');
}

async function confirmDelete() {
  const btn = g('del-confirm-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  try {
    await api(`/api/products/${S.deleteTargetId}`, 'DELETE');
    toast('Product deleted', 'success');
    closeModal('delete-modal');
    loadProducts();
    loadDashboard();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-trash"></i> Delete';
    S.deleteTargetId = null;
  }
}

// ═══════════════════════════════════════════
//  SCANNER
// ═══════════════════════════════════════════
function initScanner() {
  if (typeof Html5Qrcode !== 'undefined') {
    try { S.qrScanner = new Html5Qrcode('qr-reader'); } catch {}
  }
}

async function startScanner() {
  if (S.scannerActive || !S.qrScanner) return;
  const placeholder = g('scanner-placeholder');
  if (placeholder) placeholder.style.display = 'none';
  setScannerStatus('active', 'Scanning...');
  const startBtn = g('start-scanner-btn');
  const stopBtn = g('stop-scanner-btn');
  if (startBtn) startBtn.style.display = 'none';
  if (stopBtn) stopBtn.style.display = '';
  try {
    await S.qrScanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 260, height: 100 } },
      onScanSuccess, () => {}
    );
    S.scannerActive = true;
  } catch (err) {
    if (placeholder) placeholder.style.display = '';
    setScannerStatus('', 'Idle');
    if (startBtn) startBtn.style.display = '';
    if (stopBtn) stopBtn.style.display = 'none';
    toast('Camera error: ' + err, 'error');
  }
}

async function stopScanner() {
  if (!S.scannerActive || !S.qrScanner) return;
  try { await S.qrScanner.stop(); } catch {}
  S.scannerActive = false;
  const placeholder = g('scanner-placeholder');
  if (placeholder) placeholder.style.display = '';
  const startBtn = g('start-scanner-btn');
  const stopBtn = g('stop-scanner-btn');
  if (startBtn) startBtn.style.display = '';
  if (stopBtn) stopBtn.style.display = 'none';
  setScannerStatus('', 'Idle');
}

function setScannerStatus(cls, text) {
  const el = g('scanner-status');
  if (!el) return;
  el.className = 'scanner-status' + (cls ? ` ${cls}` : '');
  el.textContent = text;
}

async function onScanSuccess(text) {
  await stopScanner();
  toast(`Barcode: ${text}`, 'info', 2000);
  await lookupBarcode(text);
}

async function lookupBarcode(barcode) {
  try {
    const { data: p } = await api('/api/scan', 'POST', { barcode });
    showScanResult(p);
    addScanHistory(p);
    setScannerStatus('found', 'Found');
  } catch (err) {
    toast(err.message, 'warning');
    const resultCard = g('scan-result-card');
    if (resultCard) resultCard.style.display = 'none';
    setScannerStatus('', 'Not Found');
  }
}

function showScanResult(p) {
  S.scannedProduct = p;
  const card = g('scan-result-card');
  if (!card) return;
  card.style.display = '';
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const img = g('sr-img');
  if (img) {
    img.src = p.imageUrl || '';
    img.style.display = p.imageUrl ? '' : 'none';
  }
  setText('sr-name',  p.name);
  setText('sr-cat',   p.category);
  setText('sr-size',  p.size);
  setText('sr-price', '$' + p.price.toFixed(2));
  setText('sr-stock', p.stock);
  const sellBtn = g('sr-sell-btn');
  if (sellBtn) sellBtn.disabled = p.stock === 0;
}

function addScanHistory(p) {
  S.scanHistory.unshift({ p, time: new Date() });
  if (S.scanHistory.length > 10) S.scanHistory.pop();
  renderScanHistory();
}

function renderScanHistory() {
  const el = g('scan-hist-list');
  if (!el) return;
  if (!S.scanHistory.length) {
    el.innerHTML = '<div class="empty-state sm"><i class="fas fa-history"></i><p>No scans yet</p></div>';
    return;
  }
  el.innerHTML = S.scanHistory.map(({ p, time }) => `
    <div class="scan-hist-item" onclick='showScanResult(${JSON.stringify(p)})'>
      ${imgOrIcon(p.imageUrl, 'scan-hist-img', 'tshirt')}
      <div class="scan-hist-info">
        <div class="scan-hist-name">${esc(p.name)}</div>
        <div class="scan-hist-time">${time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
      <div class="scan-hist-price">$${p.price.toFixed(2)}</div>
    </div>`).join('');
}

async function sellScanned() {
  if (!S.scannedProduct) return;
  try {
    const r = await api('/api/sell', 'POST', { id: S.scannedProduct.id });
    toast(r.message, 'success');
    S.scannedProduct = r.data;
    showScanResult(r.data);
    if (S.scanHistory.length && S.scanHistory[0].p.id === r.data.id) S.scanHistory[0].p = r.data;
    renderScanHistory();
    loadDashboard();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ═══════════════════════════════════════════
//  STOCK TABLE
// ═══════════════════════════════════════════
async function loadStockTable() {
  const tbody = g('stock-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="tbl-empty"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';
  try {
    const { data: products } = await api('/api/products');
    if (!products.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="tbl-empty">No products yet. <a href="#" onclick="openAddProductModal()" style="color:var(--primary)">Add one!</a></td></tr>';
      return;
    }
    tbody.innerHTML = products.map(p => {
      const st      = p.stock === 0 ? 'out' : p.stock <= 5 ? 'low' : 'in';
      const stLabel = p.stock === 0 ? 'Out of Stock' : p.stock <= 5 ? 'Low Stock' : 'In Stock';
      return `<tr>
        <td><div class="tbl-product">${imgOrIcon(p.imageUrl, 'tbl-thumb', 'tshirt')}<span class="tbl-name">${esc(p.name)}</span></div></td>
        <td>${esc(p.category)}</td>
        <td><span class="tag">${p.size}</span></td>
        <td><strong>$${p.price.toFixed(2)}</strong></td>
        <td><strong>${p.stock}</strong></td>
        <td><span class="status-pill ${st}">${stLabel}</span></td>
        <td><div class="tbl-actions">
          <button class="icon-btn success" title="Add stock"   onclick="openStockModal('${p.id}','${esc(p.name)}','add')"><i class="fas fa-plus"></i></button>
          <button class="icon-btn danger"  title="Reduce"      onclick="openStockModal('${p.id}','${esc(p.name)}','reduce')" ${p.stock === 0 ? 'disabled' : ''}><i class="fas fa-minus"></i></button>
          <button class="icon-btn"         title="Sell"        onclick="sellFromTable('${p.id}')" ${p.stock === 0 ? 'disabled' : ''}><i class="fas fa-shopping-cart"></i></button>
          <button class="icon-btn"         title="Edit"        onclick="openEditModal('${p.id}')"><i class="fas fa-edit"></i></button>
        </div></td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="tbl-empty">${err.message}</td></tr>`;
  }
}

async function sellFromTable(id) {
  try {
    const r = await api('/api/sell', 'POST', { id });
    toast(r.message, 'success');
    loadStockTable();
    loadDashboard();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function openStockModal(id, name, action) {
  S.stockModalAction = action;
  S.stockModalId = id;
  setText('stk-modal-title', action === 'add' ? 'Add Stock' : 'Reduce Stock');
  setText('stk-modal-name', name);
  setVal('stk-modal-id', id);
  setVal('stk-modal-qty', 1);
  const btn = g('stk-modal-confirm');
  if (btn) {
    btn.className = `btn ${action === 'add' ? 'btn-success' : 'btn-danger'}`;
    btn.innerHTML = `<i class="fas fa-check"></i> ${action === 'add' ? 'Add' : 'Reduce'}`;
  }
  openModal('stock-modal');
}

async function confirmStockModal() {
  const qty    = parseInt(g('stk-modal-qty').value);
  const id     = g('stk-modal-id').value;
  const action = S.stockModalAction;
  if (!qty || qty < 1) { toast('Enter a valid quantity', 'warning'); return; }
  try {
    const { data: products } = await api('/api/products');
    const p = products.find(x => x.id === id);
    if (!p) return;
    const newStock = action === 'add' ? p.stock + qty : p.stock - qty;
    if (newStock < 0) { toast(`Can't reduce below 0 (current: ${p.stock})`, 'error'); return; }
    await api(`/api/products/${id}`, 'PUT', { stock: newStock });
    toast(`Stock ${action === 'add' ? 'increased' : 'reduced'} by ${qty}`, 'success');
    closeModal('stock-modal');
    loadStockTable();
    loadDashboard();
    if (S.scannedProduct?.id === id) {
      S.scannedProduct.stock = newStock;
      showScanResult(S.scannedProduct);
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

// Quick Sell
let qsTimer;
function setupQuickSell() {
  const input = g('qs-input');
  if (!input) return;
  input.addEventListener('input', () => {
    clearTimeout(qsTimer);
    qsTimer = setTimeout(() => renderQsDropdown(input.value), 220);
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#qs-input') && !e.target.closest('#qs-dropdown')) {
      const dd = g('qs-dropdown');
      if (dd) dd.style.display = 'none';
    }
  });
}

async function renderQsDropdown(q) {
  const dd = g('qs-dropdown');
  if (!dd) return;
  if (!q.trim()) { dd.style.display = 'none'; return; }
  try {
    const { data: products } = await api('/api/products?search=' + encodeURIComponent(q));
    if (!products.length) {
      dd.innerHTML = '<div class="qs-item" style="justify-content:center;color:var(--gray-400)">No products found</div>';
      dd.style.display = '';
      return;
    }
    dd.innerHTML = products.slice(0, 8).map(p => `
      <div class="qs-item">
        ${imgOrIcon(p.imageUrl, 'qs-item-img', 'tshirt')}
        <div class="qs-item-info">
          <div class="qs-item-name">${esc(p.name)}</div>
          <div class="qs-item-stock">${p.stock} in stock · ${p.size} · ${esc(p.category)}</div>
        </div>
        <div style="font-weight:700;color:var(--gray-900);margin-right:8px">$${p.price.toFixed(2)}</div>
        <button class="qs-sell-btn" onclick="qsSell('${p.id}')" ${p.stock === 0 ? 'disabled' : ''}>
          ${p.stock === 0 ? 'Out' : 'Sell'}
        </button>
      </div>`).join('');
    dd.style.display = '';
  } catch {
    dd.style.display = 'none';
  }
}

async function qsSell(id) {
  try {
    const r = await api('/api/sell', 'POST', { id });
    toast(r.message, 'success');
    setVal('qs-input', '');
    const dd = g('qs-dropdown');
    if (dd) dd.style.display = 'none';
    loadStockTable();
    loadDashboard();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ═══════════════════════════════════════════
//  ACTIVITY LOG (full page)
// ═══════════════════════════════════════════
async function loadActivity() {
  const el = g('activity-full-list');
  if (!el) return;
  el.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
  try {
    const { data: logs } = await api('/api/activity?limit=100');
    S.allActivity = logs || [];
    filterAndRenderActivity();
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${err.message}</p></div>`;
  }
}

function filterAndRenderActivity() {
  const search = g('act-search')?.value.toLowerCase() || '';
  const type   = g('act-type-filter')?.value || '';
  let logs = S.allActivity;
  if (search) logs = logs.filter(a => a.message.toLowerCase().includes(search));
  if (type)   logs = logs.filter(a => a.type === type);
  S.filteredActivity = logs;
  const badge = g('act-count-badge');
  if (badge) badge.textContent = logs.length;
  renderActivity(logs, 'activity-full-list');
}

// ═══════════════════════════════════════════
//  BILLING
// ═══════════════════════════════════════════
async function loadBilling() {
  try {
    const [{ data: stats }] = await Promise.all([api('/api/stats')]);
    const currentPlan = S.shop?.plan || 'starter';

    const planDefs = [
      { key: 'starter',  name: 'Starter',  price: 0,  desc: 'Perfect for getting started',    features: ['50 products', 'Barcode scanner', 'Basic dashboard', '1 user', 'Sales tracking'] },
      { key: 'pro',      name: 'Pro',      price: 29, desc: 'For growing shops',              features: ['500 products', 'Advanced analytics', 'Activity log & exports', '5 users', 'Priority support', 'Revenue reports'], popular: true },
      { key: 'business', name: 'Business', price: 79, desc: 'For established businesses',     features: ['Unlimited products', 'Everything in Pro', '20 users', 'Custom integrations', 'Dedicated support', 'SLA guarantee'] },
    ];

    const plansGrid = g('billing-plans-grid');
    if (plansGrid) {
      plansGrid.innerHTML = planDefs.map(plan => {
        const isCurrent = plan.key === currentPlan;
        return `
        <div class="billing-plan-card ${isCurrent ? 'current' : ''} ${plan.popular && !isCurrent ? 'popular' : ''}">
          ${plan.popular && !isCurrent ? '<div class="bp-popular-tag">⚡ Most Popular</div>' : ''}
          <div class="bp-name">${plan.name}</div>
          <div class="bp-price">$${plan.price}<span>/month</span></div>
          <div class="bp-desc">${plan.desc}</div>
          <ul class="bp-features">
            ${plan.features.map(f => `<li><i class="fas fa-check"></i> ${f}</li>`).join('')}
          </ul>
          ${isCurrent
            ? '<div class="current-badge"><i class="fas fa-check-circle"></i> Current Plan</div>'
            : `<button class="btn btn-primary btn-full" onclick="openUpgradeModal('${plan.key}','${plan.name}',${plan.price})"><i class="fas fa-arrow-up"></i> ${plan.price === 0 ? 'Downgrade' : 'Upgrade'} to ${plan.name}</button>`
          }
        </div>`;
      }).join('');
    }

    const sub = stats.subscription;
    const subInfo = g('billing-sub-info');
    if (subInfo) {
      subInfo.innerHTML = `
        <div class="account-info-grid">
          <div class="ai-item"><div class="ai-label">Plan</div><div class="ai-value">${capitalize(sub?.plan || 'starter')}</div></div>
          <div class="ai-item"><div class="ai-label">Status</div><div class="ai-value"><span class="badge badge-green">${sub?.status || 'active'}</span></div></div>
          <div class="ai-item"><div class="ai-label">Amount</div><div class="ai-value">$${sub?.amount || 0}/month</div></div>
          <div class="ai-item"><div class="ai-label">Renewal Date</div><div class="ai-value">${sub ? fmtDate(sub.renewalDate) : '—'}</div></div>
          <div class="ai-item"><div class="ai-label">Products Used</div><div class="ai-value">${stats.totalProducts} / ${stats.limits?.products || 50}</div></div>
          <div class="ai-item"><div class="ai-label">Inventory Value</div><div class="ai-value">$${stats.inventoryValue?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div></div>
        </div>`;
    }
  } catch (err) {
    toast('Failed to load billing: ' + err.message, 'error');
  }
}

function openUpgradeModal(plan, name, price) {
  S.upgradePlanTarget = plan;
  setText('upgrade-plan-name', name);
  setText('upgrade-plan-price', price === 0 ? 'Free forever' : `$${price}/month · Billed monthly`);
  openModal('upgrade-modal');
}

async function confirmUpgrade() {
  if (!S.upgradePlanTarget) return;
  const btn = g('upgrade-confirm-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  }
  try {
    const { subscription, message } = await api('/api/billing/upgrade', 'POST', { plan: S.upgradePlanTarget });
    S.subscription = subscription;
    if (S.shop) S.shop.plan = S.upgradePlanTarget;
    setText('sb-plan-name', capitalize(S.upgradePlanTarget));
    toast(message, 'success');
    closeModal('upgrade-modal');
    loadBilling();
    loadDashboard();
    setupAppUI();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-arrow-up"></i> Upgrade Now';
    }
    S.upgradePlanTarget = null;
  }
}

// ═══════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════
async function saveShopSettings(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  }
  try {
    const { shop } = await api('/api/shop', 'PUT', {
      name:     g('ss-name').value.trim(),
      address:  g('ss-address').value.trim(),
      phone:    g('ss-phone').value.trim(),
      currency: g('ss-currency').value,
      logoUrl:  g('ss-logo').value.trim()
    });
    S.shop = shop;
    setText('sidebar-brand', shop.name);
    setText('page-subtitle', shop.name);
    setText('acc-shop-display', shop.name);
    toast('Shop settings saved!', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Save Shop Settings';
    }
  }
}

async function saveAccountSettings(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  }
  try {
    const body = { name: g('as-name').value.trim() };
    const pass = g('as-password').value;
    if (pass) {
      if (pass.length < 6) { toast('Password too short (min 6 chars)', 'error'); return; }
      body.password = pass;
    }
    const { user } = await api('/api/account', 'PUT', body);
    S.user = user;
    setText('sb-user-name', user.name);
    const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    setText('sb-avatar', initials);
    toast('Account updated!', 'success');
    const passField = g('as-password');
    if (passField) passField.value = '';
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Save Account';
    }
  }
}

// ═══════════════════════════════════════════
//  ADMIN PANEL
// ═══════════════════════════════════════════
async function loadAdminPanel() {
  if (S.user?.role !== 'superadmin') return;
  try {
    const [{ data: stats }, { data: shops }] = await Promise.all([
      api('/api/admin/stats'), api('/api/admin/shops')
    ]);

    const statsGrid = g('admin-stats-grid');
    if (statsGrid) {
      statsGrid.innerHTML = [
        { label: 'Total Shops',  value: stats.totalShops,         icon: 'fa-store',       color: 'var(--primary)' },
        { label: 'Total Users',  value: stats.totalUsers,         icon: 'fa-users',       color: 'var(--success)' },
        { label: 'MRR',          value: `$${stats.mrr}`,          icon: 'fa-dollar-sign', color: 'var(--warning)' },
        { label: 'Starter',      value: stats.planBreakdown.starter,  icon: 'fa-box',    color: 'var(--gray-400)' },
        { label: 'Pro',          value: stats.planBreakdown.pro,      icon: 'fa-star',   color: 'var(--info)' },
        { label: 'Business',     value: stats.planBreakdown.business, icon: 'fa-building',color: 'var(--purple)' },
      ].map(s => `
        <div class="admin-stat-card">
          <div class="asn">${s.value}</div>
          <div class="asl"><i class="fas ${s.icon}" style="color:${s.color}"></i> ${s.label}</div>
        </div>`).join('');
    }

    const shopsCount = g('admin-shops-count');
    if (shopsCount) shopsCount.textContent = shops.length;
    
    const shopsTbody = g('admin-shops-tbody');
    if (shopsTbody) {
      shopsTbody.innerHTML = shops.map(sh => `
        <tr>
          <td><strong>${esc(sh.name)}</strong><br><span style="font-size:.75rem;color:var(--gray-400)">${sh.id}</span></td>
          <td>${esc(sh.ownerEmail || '—')}</td>
          <td><select class="fsel" style="padding:5px 24px 5px 8px;font-size:.8rem" onchange="adminChangePlan('${sh.id}',this.value)">
            ${['starter', 'pro', 'business'].map(p => `<option value="${p}" ${sh.plan === p ? 'selected' : ''}>${capitalize(p)}</option>`).join('')}
          </select></td>
          <td><strong>${sh.productCount}</strong></td>
          <td><strong>${sh.totalSales || 0}</strong></td>
          <td>${fmtDate(sh.createdAt)}</td>
          <td><button class="btn btn-danger btn-sm" onclick="adminDeleteShop('${sh.id}','${esc(sh.name)}')"><i class="fas fa-trash"></i></button></td>
        </tr>`).join('');
    }
  } catch (err) {
    toast('Failed to load admin panel: ' + err.message, 'error');
  }
}

async function adminChangePlan(shopId, plan) {
  try {
    await api(`/api/admin/shops/${shopId}/plan`, 'PUT', { plan });
    toast(`Plan changed to ${capitalize(plan)}`, 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function adminDeleteShop(id, name) {
  if (!confirm(`Delete shop "${name}"? This cannot be undone.`)) return;
  try {
    await api(`/api/admin/shops/${id}`, 'DELETE');
    toast('Shop deleted', 'success');
    loadAdminPanel();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ═══════════════════════════════════════════
//  MODAL HELPERS
// ═══════════════════════════════════════════
function openModal(id)  { 
  const modal = g(id);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}
function closeModal(id) { 
  const modal = g(id);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// ═══════════════════════════════════════════
//  DEMO LOGIN
// ═══════════════════════════════════════════
async function demoLogin() {
  const btn = document.querySelector('[onclick="demoLogin()"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading Demo...'; }
  try {
    const res = await api('/api/auth/login', 'POST', { email: 'owner@demo.com', password: 'Demo@123' });
    S.user = res.user; S.shop = res.shop; S.subscription = res.subscription;
    toast(`Welcome to the demo, ${res.user.name}! 🎉`, 'success');
    afterAuth();
  } catch (err) {
    showPage('auth');
    setAuthMode('login');
    setVal('l-email', 'owner@demo.com');
    setVal('l-password', 'Demo@123');
    toast('Click Sign In to try the demo', 'info');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-play"></i> Live Demo'; }
  }
}

// ═══════════════════════════════════════════
//  SIDEBAR
// ═══════════════════════════════════════════
function openSidebar()  {
  const sidebar = g('sidebar');
  const overlay = g('sidebar-overlay');
  if (sidebar) sidebar.classList.add('open');
  if (overlay) overlay.classList.add('show');
}
function closeSidebar() {
  const sidebar = g('sidebar');
  const overlay = g('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
}

// ═══════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {

  // Nav links
  document.querySelectorAll('.nav-item[data-tab]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); navigateTab(el.dataset.tab); });
  });

  // Sidebar
  const menuToggle = g('menu-toggle');
  const sidebarClose = g('sidebar-close');
  const sidebarOverlay = g('sidebar-overlay');
  if (menuToggle) menuToggle.addEventListener('click', openSidebar);
  if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

  // Logout
  const logoutBtn = g('logout-btn');
  const settingsLogoutBtn = g('settings-logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
  if (settingsLogoutBtn) settingsLogoutBtn.addEventListener('click', doLogout);

  // Add product
  const addProductBtn = g('add-product-btn');
  if (addProductBtn) addProductBtn.addEventListener('click', openAddProductModal);

  // Refresh
  const refreshBtn = g('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      const tab = document.querySelector('.nav-item.active')?.dataset.tab;
      if (tab === 'dashboard') loadDashboard();
      else if (tab === 'products')  loadProducts();
      else if (tab === 'stock')     loadStockTable();
      else if (tab === 'activity')  loadActivity();
      toast('Refreshed', 'info', 1200);
    });
  }

  // Modal overlay click to close
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) closeModal(o.id); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(o => closeModal(o.id));
    }
  });

  // Auth forms
  const loginForm = g('login-form');
  const registerForm = g('register-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (registerForm) registerForm.addEventListener('submit', handleRegister);
  ['l-email', 'l-password', 'r-name', 'r-shop', 'r-email', 'r-password'].forEach(id => {
    const el = g(id);
    if (el) el.addEventListener('input', () => el.classList.remove('error'));
  });

  // Password toggles
  const lToggle = g('l-toggle-pass');
  const rToggle = g('r-toggle-pass');
  if (lToggle) lToggle.addEventListener('click', () => togglePass('l-password', 'l-eye-icon'));
  if (rToggle) rToggle.addEventListener('click', () => togglePass('r-password', 'r-eye-icon'));

  function togglePass(inputId, iconId) {
    const inp = g(inputId), icon = g(iconId);
    if (inp && icon) {
      if (inp.type === 'password') { inp.type = 'text'; icon.className = 'fas fa-eye-slash'; }
      else { inp.type = 'password'; icon.className = 'fas fa-eye'; }
    }
  }

  // Product modal save
  const pmSaveBtn = g('pm-save-btn');
  if (pmSaveBtn) pmSaveBtn.addEventListener('click', saveProduct);
  const pmImage = g('pm-image');
  if (pmImage) {
    pmImage.addEventListener('input', debounce(e => {
      const url  = e.target.value.trim();
      const wrap = g('pm-img-preview-wrap');
      const img  = g('pm-img-preview');
      if (wrap && img) {
        if (url) {
          img.src = url;
          img.onload  = () => wrap.style.display = '';
          img.onerror = () => wrap.style.display = 'none';
        } else {
          wrap.style.display = 'none';
        }
      }
    }, 400));
  }

  // Delete confirm
  const delConfirmBtn = g('del-confirm-btn');
  if (delConfirmBtn) delConfirmBtn.addEventListener('click', confirmDelete);

  // Stock confirm
  const stkModalConfirm = g('stk-modal-confirm');
  if (stkModalConfirm) stkModalConfirm.addEventListener('click', confirmStockModal);

  // Upgrade confirm
  const upgradeConfirmBtn = g('upgrade-confirm-btn');
  if (upgradeConfirmBtn) upgradeConfirmBtn.addEventListener('click', confirmUpgrade);

  // Product search/filter
  const debouncedLoad = debounce(loadProducts, 280);
  const pSearch = g('p-search');
  const pClear = g('p-clear');
  if (pSearch) {
    pSearch.addEventListener('input', e => {
      if (pClear) pClear.style.display = e.target.value ? '' : 'none';
      debouncedLoad();
    });
  }
  if (pClear) {
    pClear.addEventListener('click', () => {
      setVal('p-search', '');
      if (pClear) pClear.style.display = 'none';
      loadProducts();
    });
  }
  ['p-cat', 'p-size', 'p-stock-filter'].forEach(id => {
    const el = g(id);
    if (el) el.addEventListener('change', loadProducts);
  });

  // Activity filters
  const actSearch = g('act-search');
  const actTypeFilter = g('act-type-filter');
  if (actSearch) actSearch.addEventListener('input', debounce(filterAndRenderActivity, 250));
  if (actTypeFilter) actTypeFilter.addEventListener('change', filterAndRenderActivity);

  // Scanner
  initScanner();
  const startScannerBtn = g('start-scanner-btn');
  const stopScannerBtn = g('stop-scanner-btn');
  const manualSearchBtn = g('manual-search-btn');
  const manualBarcode = g('manual-barcode');
  const closeScanResult = g('close-scan-result');
  const clearScanHist = g('clear-scan-hist');
  const srSellBtn = g('sr-sell-btn');
  const srAddStockBtn = g('sr-add-stock-btn');
  const srEditBtn = g('sr-edit-btn');
  
  if (startScannerBtn) startScannerBtn.addEventListener('click', startScanner);
  if (stopScannerBtn) stopScannerBtn.addEventListener('click', stopScanner);
  if (manualSearchBtn) {
    manualSearchBtn.addEventListener('click', () => {
      const bc = g('manual-barcode')?.value.trim();
      if (!bc) { toast('Enter a barcode', 'warning'); return; }
      lookupBarcode(bc);
      if (manualBarcode) setVal('manual-barcode', '');
    });
  }
  if (manualBarcode) {
    manualBarcode.addEventListener('keypress', e => {
      if (e.key === 'Enter' && manualSearchBtn) manualSearchBtn.click();
    });
  }
  if (closeScanResult) {
    closeScanResult.addEventListener('click', () => {
      const resultCard = g('scan-result-card');
      if (resultCard) resultCard.style.display = 'none';
      S.scannedProduct = null;
      setScannerStatus('', 'Idle');
    });
  }
  if (clearScanHist) {
    clearScanHist.addEventListener('click', () => {
      S.scanHistory = [];
      renderScanHistory();
      toast('History cleared', 'info', 1200);
    });
  }
  if (srSellBtn) srSellBtn.addEventListener('click', sellScanned);
  if (srAddStockBtn) {
    srAddStockBtn.addEventListener('click', () => {
      if (S.scannedProduct) openStockModal(S.scannedProduct.id, S.scannedProduct.name, 'add');
    });
  }
  if (srEditBtn) {
    srEditBtn.addEventListener('click', () => {
      if (S.scannedProduct) openEditModal(S.scannedProduct.id);
    });
  }

  // Settings forms
  const shopSettingsForm = g('shop-settings-form');
  const accountSettingsForm = g('account-settings-form');
  if (shopSettingsForm) shopSettingsForm.addEventListener('submit', saveShopSettings);
  if (accountSettingsForm) accountSettingsForm.addEventListener('submit', saveAccountSettings);

  // Quick sell
  setupQuickSell();

  // Build missing tab content
  const productTab = g('tab-products');
  if (productTab && productTab.innerHTML.includes('Loading products...')) {
    productTab.innerHTML = `
      <div class="filter-bar">
        <div class="search-wrap"><i class="fas fa-search search-icon"></i><input type="text" id="p-search" class="search-input" placeholder="Search products, barcodes..."/><button class="clear-btn" id="p-clear" style="display:none"><i class="fas fa-times"></i></button></div>
        <div class="filter-selects"><select class="fsel" id="p-cat"><option value="">All Categories</option></select><select class="fsel" id="p-size"><option value="">All Sizes</option><option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option></select><select class="fsel" id="p-stock-filter"><option value="">All Stock</option><option value="in">In Stock</option><option value="low">Low (≤5)</option><option value="out">Out of Stock</option></select></div>
      </div>
      <div id="product-grid" class="product-grid"><div class="loading-grid"><i class="fas fa-spinner fa-spin"></i><p>Loading products...</p></div></div>
    `;
    // Re-attach listeners
    const newPSearch = g('p-search');
    const newPClear = g('p-clear');
    if (newPSearch) {
      newPSearch.addEventListener('input', e => {
        if (newPClear) newPClear.style.display = e.target.value ? '' : 'none';
        debounce(() => loadProducts(), 280)();
      });
    }
    if (newPClear) {
      newPClear.addEventListener('click', () => {
        setVal('p-search', '');
        if (newPClear) newPClear.style.display = 'none';
        loadProducts();
      });
    }
    ['p-cat', 'p-size', 'p-stock-filter'].forEach(id => {
      const el = g(id);
      if (el) el.addEventListener('change', loadProducts);
    });
  }

  const scannerTab = g('tab-scanner');
  if (scannerTab && scannerTab.innerHTML.includes('Loading scanner...')) {
    scannerTab.innerHTML = `
      <div class="scanner-grid">
        <div class="card"><div class="card-header"><div class="card-title"><i class="fas fa-camera" style="color:var(--info)"></i> Barcode Scanner</div><span class="scanner-status" id="scanner-status">Idle</span></div><div class="card-body"><div class="scanner-viewport" id="scanner-viewport"><div class="scanner-placeholder" id="scanner-placeholder"><div class="scanner-icon-wrap"><i class="fas fa-barcode"></i></div><p>Click <strong>Start Scanner</strong> to activate your camera</p><p class="scanner-hint">Works with any standard barcode</p></div><div id="qr-reader"></div></div><div class="divider" style="margin:14px 0"><span>or enter manually</span></div><div class="manual-row"><input type="text" id="manual-barcode" class="form-input" placeholder="Enter barcode number..."/><button class="btn btn-secondary" id="manual-search-btn"><i class="fas fa-search"></i></button></div><div class="scanner-btns"><button class="btn btn-primary" id="start-scanner-btn"><i class="fas fa-play"></i> Start Scanner</button><button class="btn btn-danger" id="stop-scanner-btn" style="display:none"><i class="fas fa-stop"></i> Stop</button></div></div></div>
        <div id="scan-result-card" class="card" style="display:none"><div class="card-header"><div class="card-title"><i class="fas fa-check-circle" style="color:var(--success)"></i> Product Found</div><button class="card-close" id="close-scan-result"><i class="fas fa-times"></i></button></div><div class="card-body"><div class="scan-result-inner"><img id="sr-img" class="scan-result-img" src=""/><div class="scan-result-info"><div class="scan-result-name" id="sr-name">—</div><div class="scan-result-tags"><span class="tag primary" id="sr-cat">—</span><span class="tag" id="sr-size">—</span></div><div class="scan-result-price" id="sr-price">$0.00</div><div class="scan-result-stock">Stock: <strong id="sr-stock">0</strong> units</div></div></div><div class="scan-actions"><button class="btn btn-sell" id="sr-sell-btn"><i class="fas fa-shopping-cart"></i> Sell 1</button><button class="btn btn-secondary" id="sr-add-stock-btn"><i class="fas fa-plus"></i> Add Stock</button><button class="btn btn-ghost" id="sr-edit-btn"><i class="fas fa-edit"></i> Edit</button></div></div></div>
        <div class="card"><div class="card-header"><div class="card-title"><i class="fas fa-history" style="color:var(--purple)"></i> Scan History</div><button class="card-action" id="clear-scan-hist">Clear</button></div><div class="card-body" style="padding:8px 16px"><div id="scan-hist-list"><div class="empty-state sm"><i class="fas fa-history"></i><p>No scans yet</p></div></div></div></div>
      </div>
    `;
    initScanner();
    const newStartBtn = g('start-scanner-btn');
    const newStopBtn = g('stop-scanner-btn');
    const newManualSearch = g('manual-search-btn');
    const newManualBarcode = g('manual-barcode');
    const newCloseResult = g('close-scan-result');
    const newClearHist = g('clear-scan-hist');
    const newSrSell = g('sr-sell-btn');
    const newSrAddStock = g('sr-add-stock-btn');
    const newSrEdit = g('sr-edit-btn');
    if (newStartBtn) newStartBtn.addEventListener('click', startScanner);
    if (newStopBtn) newStopBtn.addEventListener('click', stopScanner);
    if (newManualSearch) newManualSearch.addEventListener('click', () => {
      const bc = g('manual-barcode')?.value.trim();
      if (!bc) { toast('Enter a barcode', 'warning'); return; }
      lookupBarcode(bc);
      if (newManualBarcode) setVal('manual-barcode', '');
    });
    if (newManualBarcode) newManualBarcode.addEventListener('keypress', e => { if (e.key === 'Enter' && newManualSearch) newManualSearch.click(); });
    if (newCloseResult) newCloseResult.addEventListener('click', () => { if (g('scan-result-card')) g('scan-result-card').style.display = 'none'; S.scannedProduct = null; setScannerStatus('', 'Idle'); });
    if (newClearHist) newClearHist.addEventListener('click', () => { S.scanHistory = []; renderScanHistory(); toast('History cleared', 'info', 1200); });
    if (newSrSell) newSrSell.addEventListener('click', sellScanned);
    if (newSrAddStock) newSrAddStock.addEventListener('click', () => { if (S.scannedProduct) openStockModal(S.scannedProduct.id, S.scannedProduct.name, 'add'); });
    if (newSrEdit) newSrEdit.addEventListener('click', () => { if (S.scannedProduct) openEditModal(S.scannedProduct.id); });
  }

  const stockTab = g('tab-stock');
  if (stockTab && stockTab.innerHTML.includes('Loading stock...')) {
    stockTab.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:20px">
        <div class="card"><div class="card-header"><div class="card-title"><i class="fas fa-shopping-cart" style="color:var(--success)"></i> Quick Sell</div><span style="font-size:.75rem;color:var(--gray-400)">Type to search and sell instantly</span></div><div class="card-body"><div style="position:relative"><input type="text" id="qs-input" class="form-input" placeholder="Search product by name or barcode..."/><div id="qs-dropdown" class="qs-dropdown" style="display:none"></div></div></div></div>
        <div class="card"><div class="card-header"><div class="card-title"><i class="fas fa-list" style="color:var(--warning)"></i> Inventory Table</div><button class="topbar-btn" onclick="loadStockTable()" title="Refresh"><i class="fas fa-sync-alt"></i></button></div><div class="card-body no-pad"><div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Category</th><th>Size</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody id="stock-tbody"><tr><td colspan="7" class="tbl-empty"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr></tbody></table></div></div></div>
      </div>
    `;
    setupQuickSell();
  }

  const activityTab = g('tab-activity');
  if (activityTab && activityTab.innerHTML.includes('Loading activity...')) {
    activityTab.innerHTML = `
      <div class="activity-page-header"><div class="filter-bar" style="margin-bottom:0"><div class="search-wrap"><i class="fas fa-search search-icon"></i><input type="text" id="act-search" class="search-input" placeholder="Search activity..."/></div><div class="filter-selects"><select class="fsel" id="act-type-filter"><option value="">All Types</option><option value="sale">Sales</option><option value="product_add">Products Added</option><option value="product_edit">Products Edited</option><option value="product_delete">Products Deleted</option><option value="stock_add">Stock Added</option><option value="account">Account</option><option value="billing">Billing</option><option value="settings">Settings</option></select></div></div><button class="btn btn-secondary btn-sm" onclick="loadActivity()"><i class="fas fa-sync-alt"></i> Refresh</button></div>
      <div class="card" style="margin-top:16px"><div class="card-header"><div class="card-title"><i class="fas fa-history" style="color:var(--purple)"></i> Activity Log</div><span class="badge badge-purple" id="act-count-badge">—</span></div><div class="card-body" id="activity-list-wrap" style="padding:0 20px"><div id="activity-full-list" class="activity-feed"><div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Loading...</div></div></div></div>
    `;
    const newActSearch = g('act-search');
    const newActType = g('act-type-filter');
    if (newActSearch) newActSearch.addEventListener('input', debounce(filterAndRenderActivity, 250));
    if (newActType) newActType.addEventListener('change', filterAndRenderActivity);
  }

  const billingTab = g('tab-billing');
  if (billingTab && billingTab.innerHTML.includes('Loading billing...')) {
    billingTab.innerHTML = `
      <div style="margin-bottom:24px"><div class="billing-grid" id="billing-plans-grid"><div class="loading-grid"><i class="fas fa-spinner fa-spin"></i></div></div></div>
      <div class="card"><div class="card-header"><div class="card-title"><i class="fas fa-receipt" style="color:var(--info)"></i> Current Subscription</div></div><div class="card-body"><div id="billing-sub-info"><div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Loading...</div></div></div></div>
      <div class="card" style="margin-top:20px"><div class="card-header"><div class="card-title"><i class="fas fa-list-alt" style="color:var(--purple)"></i> Plan Comparison</div></div><div class="card-body no-pad"><div class="table-wrap"><table class="data-table comparison-table"><thead><tr><th>Feature</th><th class="text-center">Starter</th><th class="text-center">Pro</th><th class="text-center">Business</th></tr></thead><tbody><tr><td>Products</td><td class="text-center">50</td><td class="text-center">500</td><td class="text-center">Unlimited</td></tr><tr><td>Users</td><td class="text-center">1</td><td class="text-center">5</td><td class="text-center">20</td></tr><tr><td>Barcode Scanner</td><td class="text-center"><i class="fas fa-check text-success"></i></td><td class="text-center"><i class="fas fa-check text-success"></i></td><td class="text-center"><i class="fas fa-check text-success"></i></td></tr><tr><td>Analytics</td><td class="text-center"><i class="fas fa-times text-muted"></i></td><td class="text-center"><i class="fas fa-check text-success"></i></td><td class="text-center"><i class="fas fa-check text-success"></i></td></tr><tr><td>Activity Log</td><td class="text-center"><i class="fas fa-times text-muted"></i></td><td class="text-center"><i class="fas fa-check text-success"></i></td><td class="text-center"><i class="fas fa-check text-success"></i></td></tr><tr><td>Data Export</td><td class="text-center"><i class="fas fa-times text-muted"></i></td><td class="text-center"><i class="fas fa-check text-success"></i></td><td class="text-center"><i class="fas fa-check text-success"></i></td></tr><tr><td>Priority Support</td><td class="text-center"><i class="fas fa-times text-muted"></i></td><td class="text-center"><i class="fas fa-check text-success"></i></td><td class="text-center"><i class="fas fa-check text-success"></i></td></tr></tbody></table></div></div></div>
    `;
  }

  const settingsTab = g('tab-settings');
  if (settingsTab && settingsTab.innerHTML.includes('Loading settings...')) {
    settingsTab.innerHTML = `
      <div class="settings-grid">
        <div class="card"><div class="card-header"><div class="card-title"><i class="fas fa-store" style="color:var(--primary)"></i> Shop Profile</div></div><div class="card-body"><form id="shop-settings-form" style="display:flex;flex-direction:column;gap:14px"><div class="form-group"><label class="form-label">Shop Name</label><input type="text" id="ss-name" class="form-input"/></div><div class="form-group"><label class="form-label">Address</label><input type="text" id="ss-address" class="form-input"/></div><div class="form-group"><label class="form-label">Phone</label><input type="tel" id="ss-phone" class="form-input"/></div><div class="form-group"><label class="form-label">Currency</label><select id="ss-currency" class="form-input"><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="INR">INR</option></select></div><div class="form-group"><label class="form-label">Logo URL</label><input type="url" id="ss-logo" class="form-input"/></div><button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Save Shop Settings</button></form></div></div>
        <div class="card"><div class="card-header"><div class="card-title"><i class="fas fa-user-circle" style="color:var(--purple)"></i> Account</div></div><div class="card-body"><form id="account-settings-form" style="display:flex;flex-direction:column;gap:14px"><div class="form-group"><label class="form-label">Full Name</label><input type="text" id="as-name" class="form-input"/></div><div class="form-group"><label class="form-label">Email</label><input type="email" id="as-email" class="form-input" disabled style="background:var(--gray-50)"/></div><div class="divider"><span>Change Password</span></div><div class="form-group"><label class="form-label">New Password</label><input type="password" id="as-password" class="form-input" placeholder="Leave blank to keep current"/></div><button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Save Account</button></form></div></div>
        <div class="card span-2"><div class="card-header"><div class="card-title"><i class="fas fa-info-circle" style="color:var(--info)"></i> Account Info</div></div><div class="card-body"><div class="account-info-grid"><div class="ai-item"><div class="ai-label">Email</div><div class="ai-value" id="acc-email-display">—</div></div><div class="ai-item"><div class="ai-label">Role</div><div class="ai-value" id="acc-role-display">—</div></div><div class="ai-item"><div class="ai-label">Shop</div><div class="ai-value" id="acc-shop-display">—</div></div><div class="ai-item"><div class="ai-label">Plan</div><div class="ai-value" id="acc-plan-display">—</div></div></div><div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--gray-100)"><button class="btn btn-danger btn-sm" id="settings-logout-btn"><i class="fas fa-sign-out-alt"></i> Sign Out</button></div></div></div>
      </div>
    `;
    const newShopForm = g('shop-settings-form');
    const newAccountForm = g('account-settings-form');
    const newSettingsLogout = g('settings-logout-btn');
    if (newShopForm) newShopForm.addEventListener('submit', saveShopSettings);
    if (newAccountForm) newAccountForm.addEventListener('submit', saveAccountSettings);
    if (newSettingsLogout) newSettingsLogout.addEventListener('click', doLogout);
    // Re-attach logout from sidebar if needed
    const newLogoutBtn = g('logout-btn');
    if (newLogoutBtn) newLogoutBtn.addEventListener('click', doLogout);
  }

  const adminTab = g('tab-admin');
  if (adminTab && adminTab.innerHTML.includes('Loading admin panel...')) {
    adminTab.innerHTML = `
      <div class="admin-stats-grid" id="admin-stats-grid"><div class="loading-grid"><i class="fas fa-spinner fa-spin"></i></div></div>
      <div class="card" style="margin-bottom:20px"><div class="card-header"><div class="card-title"><i class="fas fa-store" style="color:var(--primary)"></i> All Shops</div><span class="badge badge-blue" id="admin-shops-count">—</span></div><div class="card-body no-pad"><div class="table-wrap"><table class="data-table"><thead><tr><th>Shop</th><th>Owner</th><th>Plan</th><th>Products</th><th>Sales</th><th>Created</th><th>Actions</th></tr></thead><tbody id="admin-shops-tbody"><tr><td colspan="7" class="tbl-empty"><i class="fas fa-spinner fa-spin"></i></td></tr></tbody></table></div></div></div>
    `;
  }

  // Check auth on load
  checkAuth();
});