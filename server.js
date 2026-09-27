'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL, URLSearchParams } = require('url');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const INVENTORY_FILE = path.join(DATA_DIR, 'inventory.json');

function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnv();

const config = {
  port: Number(process.env.PORT || 3000),
  baseUrl: (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  storeName: process.env.STORE_NAME || 'VELORA',
  storeEmail: process.env.STORE_EMAIL || 'ventas@tudominio.com',
  storeWhatsapp: process.env.STORE_WHATSAPP || '573001234567',
  storeCity: process.env.STORE_CITY || 'Medellín, Colombia',
  legalName: process.env.LEGAL_NAME || 'COMPLETAR RAZON SOCIAL',
  nit: process.env.NIT || 'COMPLETAR NIT',
  shippingFeeCop: Math.max(0, Number(process.env.SHIPPING_FEE_COP || 0)),
  wompiPublicKey: process.env.WOMPI_PUBLIC_KEY || '',
  wompiPrivateKey: process.env.WOMPI_PRIVATE_KEY || '',
  wompiIntegritySecret: process.env.WOMPI_INTEGRITY_SECRET || '',
  wompiEventsSecret: process.env.WOMPI_EVENTS_SECRET || '',
  adminToken: process.env.ADMIN_TOKEN || ''
};

const COLORS = [
  { id: 'negro', name: 'Negro', hex: '#111111', image: '/assets/puma-negra.png' },
  { id: 'blanco', name: 'Blanco', hex: '#f5f3ee', image: '/assets/puma-blanca.png' },
  { id: 'grafito', name: 'Grafito', hex: '#4a4a48', image: '/assets/puma-grafito.png' },
  { id: 'azul-marino', name: 'Azul marino', hex: '#172a45', image: '/assets/puma-azul-marino.png' },
  { id: 'oliva', name: 'Verde oliva', hex: '#5b6038', image: '/assets/puma-oliva.png' },
  { id: 'beige', name: 'Beige', hex: '#d3bea0', image: '/assets/puma-beige.png' },
  { id: 'mostaza', name: 'Mostaza', hex: '#d69b19', image: '/assets/puma-mostaza.png' },
  { id: 'vinotinto', name: 'Vinotinto', hex: '#6e1f2e', image: '/assets/puma-vinotinto.png' },
  { id: 'celeste', name: 'Celeste', hex: '#87bfe0', image: '/assets/puma-celeste.png' },
  { id: 'rosa', name: 'Rosa palo', hex: '#d8a7a9', image: '/assets/puma-rosa.png' }
];
const SIZES = ['S', 'M', 'L', 'XL'];
const PACK_PRICES = { 1: 65000, 2: 110000, 3: 160000 };

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJsonAtomic(file, value) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}
function money(n) { return `$${Number(n).toLocaleString('es-CO')}`; }
function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}
function text(res, status, body, type='text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function secureHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; form-action 'self' https://checkout.wompi.co; base-uri 'self'; frame-ancestors 'self'");
  if (config.baseUrl.startsWith('https://')) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
}

function bodyJson(req, maxBytes=80_000) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (Buffer.byteLength(data) > maxBytes) {
        reject(new Error('Payload demasiado grande'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

function cleanString(value, max=120) {
  return String(value ?? '').trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
}
function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validPhone(phone) { return /^\+?[0-9\s()-]{7,20}$/.test(phone); }
function isConfigured(value) { return value && !/REEMPLAZAR|CAMBIAR|COMPLETAR/i.test(value); }
function wompiReady() {
  return isConfigured(config.wompiPublicKey) && isConfigured(config.wompiIntegritySecret);
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function getNested(obj, dotted) {
  return dotted.split('.').reduce((acc, key) => acc == null ? undefined : acc[key], obj);
}
function safeEqualHex(a, b) {
  const aa = Buffer.from(String(a || '').toLowerCase());
  const bb = Buffer.from(String(b || '').toLowerCase());
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function uniqueReference() {
  return `VEL-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}
function token() { return crypto.randomBytes(24).toString('hex'); }

function productSummary() {
  return {
    store: {
      name: config.storeName,
      email: config.storeEmail,
      whatsapp: config.storeWhatsapp,
      city: config.storeCity
    },
    product: {
      id: 'puma-logo-pecho',
      name: 'Camiseta Puma — Logo Pecho',
      description: 'Camiseta de reventa con selección de color y talla.',
      colors: COLORS,
      sizes: SIZES,
      packs: [
        { qty: 1, total: PACK_PRICES[1], label: '1 camiseta' },
        { qty: 2, total: PACK_PRICES[2], label: '2 camisetas' },
        { qty: 3, total: PACK_PRICES[3], label: '3 camisetas' }
      ]
    },
    shippingFee: config.shippingFeeCop,
    paymentConfigured: wompiReady()
  };
}

const RATE = new Map();
function rateLimit(req, res, bucket='api', limit=80, windowMs=60_000) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').toString().split(',')[0].trim();
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const item = RATE.get(key);
  if (!item || item.reset < now) {
    RATE.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  item.count += 1;
  if (item.count > limit) {
    json(res, 429, { error: 'Demasiadas solicitudes. Intenta nuevamente en un momento.' });
    return false;
  }
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of RATE) if (v.reset < now) RATE.delete(k);
}, 120_000).unref();

function validateItems(items) {
  if (!Array.isArray(items) || ![1,2,3].includes(items.length)) throw new Error('Elige un paquete de 1, 2 o 3 camisetas.');
  const inventory = readJson(INVENTORY_FILE, {});
  return items.map((raw, idx) => {
    const color = cleanString(raw.color, 32);
    const size = cleanString(raw.size, 4).toUpperCase();
    if (!COLORS.some(c => c.id === color)) throw new Error(`Color inválido en la camiseta ${idx + 1}.`);
    if (!SIZES.includes(size)) throw new Error(`Talla inválida en la camiseta ${idx + 1}.`);
    if ((inventory[color]?.[size] ?? 0) < 1) throw new Error(`No hay inventario disponible de ${color} talla ${size}.`);
    return { color, size };
  });
}

function reserveOnApproval(order) {
  if (order.inventoryApplied) return order;
  const inventory = readJson(INVENTORY_FILE, {});
  for (const item of order.items) {
    if (inventory[item.color] && typeof inventory[item.color][item.size] === 'number') {
      inventory[item.color][item.size] = Math.max(0, inventory[item.color][item.size] - 1);
    }
  }
  writeJsonAtomic(INVENTORY_FILE, inventory);
  order.inventoryApplied = true;
  return order;
}

function saveOrder(order) {
  const orders = readJson(ORDERS_FILE, []);
  const idx = orders.findIndex(o => o.reference === order.reference);
  if (idx >= 0) orders[idx] = order; else orders.push(order);
  writeJsonAtomic(ORDERS_FILE, orders);
}

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  try { rel = decodeURIComponent(rel); } catch { return text(res, 400, 'Ruta inválida'); }
  const full = path.resolve(PUBLIC_DIR, '.' + rel);
  if (!full.startsWith(PUBLIC_DIR + path.sep) && full !== path.join(PUBLIC_DIR, 'index.html')) return text(res, 403, 'Prohibido');
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return false;
  const ext = path.extname(full).toLowerCase();
  const mime = {
    '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8',
    '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon',
    '.webp':'image/webp', '.json':'application/json; charset=utf-8'
  }[ext] || 'application/octet-stream';
  const stat = fs.statSync(full);
  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': stat.size,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
  });
  fs.createReadStream(full).pipe(res);
  return true;
}

async function handleApi(req, res, url) {
  if (!rateLimit(req, res)) return;
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json(res, 200, { ok: true, store: config.storeName, time: new Date().toISOString() });
  }
  if (req.method === 'GET' && url.pathname === '/api/catalog') {
    return json(res, 200, productSummary());
  }
  if (req.method === 'POST' && url.pathname === '/api/checkout') {
    if (!rateLimit(req, res, 'checkout', 12, 60_000)) return;
    try {
      const body = await bodyJson(req);
      const items = validateItems(body.items);
      const customer = {
        fullName: cleanString(body.customer?.fullName, 90),
        email: cleanString(body.customer?.email, 120).toLowerCase(),
        phone: cleanString(body.customer?.phone, 24),
        document: cleanString(body.customer?.document, 24),
        address: cleanString(body.customer?.address, 150),
        city: cleanString(body.customer?.city, 80),
        department: cleanString(body.customer?.department, 80),
        notes: cleanString(body.customer?.notes, 250)
      };
      if (customer.fullName.length < 3) throw new Error('Escribe el nombre completo.');
      if (!validEmail(customer.email)) throw new Error('Escribe un correo válido.');
      if (!validPhone(customer.phone)) throw new Error('Escribe un teléfono válido.');
      if (customer.address.length < 5 || customer.city.length < 2) throw new Error('Completa la dirección y la ciudad.');
      if (!wompiReady()) {
        return json(res, 503, {
          error: 'La tienda ya está preparada, pero falta configurar las llaves de Wompi en el servidor.',
          code: 'PAYMENT_NOT_CONFIGURED'
        });
      }
      const reference = uniqueReference();
      const accessToken = token();
      const subtotal = PACK_PRICES[items.length];
      const shipping = config.shippingFeeCop;
      const total = subtotal + shipping;
      const amountInCents = total * 100;
      const currency = 'COP';
      const signature = sha256(`${reference}${amountInCents}${currency}${config.wompiIntegritySecret}`);
      const redirectUrl = `${config.baseUrl}/resultado.html?ref=${encodeURIComponent(reference)}&token=${encodeURIComponent(accessToken)}`;
      const params = new URLSearchParams({
        'public-key': config.wompiPublicKey,
        'currency': currency,
        'amount-in-cents': String(amountInCents),
        'reference': reference,
        'signature:integrity': signature,
        'redirect-url': redirectUrl,
        'customer-data:email': customer.email,
        'customer-data:full-name': customer.fullName,
        'customer-data:phone-number': customer.phone
      });
      const checkoutUrl = `https://checkout.wompi.co/p/?${params.toString()}`;
      const order = {
        reference,
        accessToken,
        items,
        customer,
        subtotal,
        shipping,
        total,
        currency,
        status: 'CREATED',
        paymentStatus: 'PENDING',
        wompiTransactionId: null,
        inventoryApplied: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ip: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim()
      };
      saveOrder(order);
      return json(res, 200, { checkoutUrl, reference, total, totalFormatted: money(total) });
    } catch (err) {
      return json(res, 400, { error: err.message || 'No fue posible preparar el pago.' });
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/order') {
    const reference = cleanString(url.searchParams.get('ref'), 80);
    const accessToken = cleanString(url.searchParams.get('token'), 80);
    const orders = readJson(ORDERS_FILE, []);
    const order = orders.find(o => o.reference === reference && o.accessToken === accessToken);
    if (!order) return json(res, 404, { error: 'Pedido no encontrado.' });
    return json(res, 200, {
      reference: order.reference,
      items: order.items,
      total: order.total,
      totalFormatted: money(order.total),
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt
    });
  }
  if (req.method === 'POST' && url.pathname === '/api/webhooks/wompi') {
    try {
      const body = await bodyJson(req, 300_000);
      if (!isConfigured(config.wompiEventsSecret)) return json(res, 503, { error: 'WOMPI_EVENTS_SECRET no configurado.' });
      const props = Array.isArray(body.signature?.properties) ? body.signature.properties : [];
      const values = props.map(p => getNested(body.data, p));
      if (values.some(v => v === undefined)) return json(res, 400, { error: 'Evento Wompi incompleto.' });
      const material = values.map(v => String(v)).join('') + String(body.timestamp) + config.wompiEventsSecret;
      const expected = sha256(material);
      const supplied = req.headers['x-event-checksum'] || body.signature?.checksum || '';
      if (!safeEqualHex(expected, supplied)) return json(res, 401, { error: 'Firma de evento inválida.' });
      if (body.event === 'transaction.updated') {
        const txn = body.data?.transaction || {};
        const reference = txn.reference;
        const orders = readJson(ORDERS_FILE, []);
        const idx = orders.findIndex(o => o.reference === reference);
        if (idx >= 0) {
          let order = orders[idx];
          order.paymentStatus = txn.status || order.paymentStatus;
          order.status = txn.status === 'APPROVED' ? 'PAID' : (txn.status || order.status);
          order.wompiTransactionId = txn.id || order.wompiTransactionId;
          order.paymentMethod = txn.payment_method_type || txn.paymentMethodType || order.paymentMethod || null;
          order.updatedAt = new Date().toISOString();
          if (txn.status === 'APPROVED') order = reserveOnApproval(order);
          orders[idx] = order;
          writeJsonAtomic(ORDERS_FILE, orders);
        }
      }
      return json(res, 200, { received: true });
    } catch (err) {
      return json(res, 400, { error: err.message || 'Evento inválido.' });
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/orders') {
    const auth = req.headers.authorization || '';
    if (!isConfigured(config.adminToken) || auth !== `Bearer ${config.adminToken}`) return json(res, 401, { error: 'No autorizado.' });
    const orders = readJson(ORDERS_FILE, []).map(({ accessToken, ip, ...o }) => ({ ...o, customer: { ...o.customer, document: o.customer?.document ? '***' + o.customer.document.slice(-4) : '' } })).reverse();
    return json(res, 200, { orders });
  }
  if (req.method === 'GET' && url.pathname === '/api/admin/inventory') {
    const auth = req.headers.authorization || '';
    if (!isConfigured(config.adminToken) || auth !== `Bearer ${config.adminToken}`) return json(res, 401, { error: 'No autorizado.' });
    return json(res, 200, { inventory: readJson(INVENTORY_FILE, {}) });
  }
  return json(res, 404, { error: 'Ruta API no encontrada.' });
}

const server = http.createServer(async (req, res) => {
  secureHeaders(res);
  const url = new URL(req.url, config.baseUrl);
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  if (url.pathname === '/robots.txt') {
    return text(res, 200, `User-agent: *\nAllow: /\nSitemap: ${config.baseUrl}/sitemap.xml\n`);
  }
  if (url.pathname === '/sitemap.xml') {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${config.baseUrl}/</loc></url><url><loc>${config.baseUrl}/politicas.html</loc></url></urlset>`;
    return text(res, 200, xml, 'application/xml; charset=utf-8');
  }
  if (serveStatic(req, res, url.pathname)) return;
  serveStatic(req, res, '/404.html') || text(res, 404, 'No encontrado');
});

server.listen(config.port, () => {
  console.log(`\n${config.storeName} disponible en http://localhost:${config.port}`);
  console.log(`BASE_URL: ${config.baseUrl}`);
  console.log(`Wompi: ${wompiReady() ? 'configurado' : 'pendiente de llaves'}`);
  console.log(`Webhook Wompi: ${config.baseUrl}/api/webhooks/wompi\n`);
});
