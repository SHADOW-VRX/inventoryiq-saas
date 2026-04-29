/**
 * auth.js — Authentication middleware
 * Validates session tokens from cookies or Authorization header.
 */

const { Sessions, Users, Shops } = require('../models/db');

/**
 * Parse cookies from request header
 */
function parseCookies(req) {
  const cookies = {};
  const header = req.headers.cookie || '';
  header.split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=');
    if (k) cookies[k.trim()] = decodeURIComponent(v.join('='));
  });
  return cookies;
}

/**
 * Extract token from request (cookie or header)
 */
function extractToken(req) {
  const cookies = parseCookies(req);
  if (cookies.iq_token) return cookies.iq_token;

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);

  return null;
}

/**
 * requireAuth middleware
 * Attaches req.user, req.session, req.shop
 */
function requireAuth(req, res, next) {
  const token = extractToken(req);
  const session = Sessions.find(token);

  if (!session) {
    return sendUnauth(res);
  }

  const user = Users.byId(session.userId);
  if (!user) {
    Sessions.destroy(token);
    return sendUnauth(res);
  }

  req.user    = user;
  req.session = session;
  req.shop    = user.shopId ? Shops.byId(user.shopId) : null;
  next();
}

/**
 * requireAdmin middleware — superadmin only
 */
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'superadmin') {
      return sendForbidden(res);
    }
    next();
  });
}

/**
 * optionalAuth — attaches user if token present, doesn't block
 */
function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (token) {
    const session = Sessions.find(token);
    if (session) {
      const user = Users.byId(session.userId);
      if (user) {
        req.user    = user;
        req.session = session;
        req.shop    = user.shopId ? Shops.byId(user.shopId) : null;
      }
    }
  }
  next();
}

function sendUnauth(res) {
  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Unauthorized', code: 'UNAUTH' }));
}

function sendForbidden(res) {
  res.writeHead(403, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Forbidden', code: 'FORBIDDEN' }));
}

module.exports = { requireAuth, requireAdmin, optionalAuth, parseCookies, extractToken };