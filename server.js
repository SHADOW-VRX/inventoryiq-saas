/**
 * server.js — InventoryIQ SaaS Entry Point
 * Pure Node.js http module. No frameworks.
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const router = require('./routes');

const PORT       = process.env.PORT || 3000;
const CLIENT_DIR = path.join(__dirname, 'client');  // Change from '..' to ''

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
};

function serveStatic(req, res, urlPath) {
  let filePath = (urlPath === '/' || urlPath === '')
    ? path.join(CLIENT_DIR, 'index.html')
    : path.join(CLIENT_DIR, urlPath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(CLIENT_DIR)) {
    res.writeHead(403); return res.end('Forbidden');
  }

  const ext      = path.extname(filePath).toLowerCase();
  const mimeType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback: serve index.html for client-side routes
      const idx = path.join(CLIENT_DIR, 'index.html');
      fs.readFile(idx, (e2, d2) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(d2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.url}`);

  router(req, res, serveStatic).catch(err => {
    console.error('Unhandled error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Internal Server Error' }));
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n┌─────────────────────────────────────────┐');
  console.log('│   🚀  InventoryIQ SaaS v2.0             │');
  console.log(`│   Server → http://localhost:${PORT}          │`);
  console.log('│   Super Admin: admin@inventoryiq.com    │');
  console.log('│   Demo Owner:  owner@demo.com           │');
  console.log('└─────────────────────────────────────────┘\n');
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT',  () => server.close(() => process.exit(0)));