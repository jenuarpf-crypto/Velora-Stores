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
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
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
  storeCity: process.env.STORE_CITY || 'Colombia',
  legalName: process.env.LEGAL_NAME || 'COMPLETAR NOMBRE O RAZÓN SOCIAL',
  nit: process.env.NIT || 'COMPLETAR NIT / CC',
  address: process.env.STORE_ADDRESS || 'COMPLETAR DIRECCIÓN COMERCIAL',
  shippingFeeCop: Math.max(0, Number(process.env.SHIPPING_FEE_COP || 0)),
  wompiPublicKey: process.env.WOMPI_PUBLIC_KEY || '',
  wompiPrivateKey: process.env.WOMPI_PRIVATE_KEY || '',
  wompiIntegritySecret: process.env.WOMPI_INTEGRITY_SECRET || '',
  wompiEventsSecret: process.env.WOMPI_EVENTS_SECRET || '',
  adminToken: process.env.ADMIN_TOKEN || ''
};

const SIZES = ['S', 'M', 'L', 'XL'];
const PACK_PRICES = { 1: 65000, 2: 110000, 3: 160000 };
const PRODUCTS = [
  {
    id: 'puma-essential', brand: 'Puma', name: 'Camiseta Puma Essential', badge: 'Más vendida',
    description: 'Logo pequeño, silueta limpia y estilo urbano para combinar todos los días.',
    fit: 'Regular / relaxed', material: 'Ver etiqueta de la referencia original',
    modelImage:'/assets/modelo-negro.png',
    colors: [
      { id:'negro', name:'Negro', hex:'#111111', image:'/assets/puma-negro.png' },
      { id:'blanco', name:'Blanco', hex:'#f2f2ef', image:'/assets/puma-blanco.png' },
      { id:'gris', name:'Gris', hex:'#a6a6a6', image:'/assets/modelo-gris.png' },
      { id:'azul-marino', name:'Azul marino', hex:'#172a45', image:'/assets/puma-azul-marino-2.png' },
      { id:'verde-oliva', name:'Verde oliva', hex:'#677052', image:'/assets/modelo-verde-oliva.png' },
      { id:'beige', name:'Beige', hex:'#d2bea3', image:'/assets/puma-beige-2.png' },
      { id:'vinotinto', name:'Vinotinto', hex:'#6d2130', image:'/assets/modelo-vinotinto.png' },
      { id:'azul-rey', name:'Azul rey', hex:'#2d5ea8', image:'/assets/modelo-azul-rey.png' },
      { id:'cafe', name:'Café', hex:'#5b4637', image:'/assets/modelo-cafe.png' },
      { id:'gris-oscuro', name:'Gris oscuro', hex:'#505050', image:'/assets/modelo-gris-oscuro.png' }
    ]
  },
  {
    id: 'nike-minimal', brand: 'Nike', name: 'Camiseta Nike Minimal', badge: 'Nuevo',
    description: 'Diseño minimalista con logo discreto y estética deportiva contemporánea.',
    fit: 'Regular / relaxed', material: 'Ver etiqueta de la referencia original',
    modelImage:'/assets/modelo-blanco.png',
    colors: [
      { id:'blanco', name:'Blanco', hex:'#f4f4f2', image:'/assets/nike-blanco.png' },
      { id:'negro', name:'Negro', hex:'#111111', image:'/assets/nike-negro.png' },
      { id:'gris', name:'Gris', hex:'#b7b7b7', image:'/assets/nike-gris.png' },
      { id:'azul-marino', name:'Azul marino', hex:'#172843', image:'/assets/nike-azul-marino.png' },
      { id:'rojo', name:'Rojo', hex:'#d51f2b', image:'/assets/nike-rojo.png' },
      { id:'verde-oliva', name:'Verde oliva', hex:'#677052', image:'/assets/modelo-verde-oliva.png' },
      { id:'beige', name:'Beige', hex:'#d2bea3', image:'/assets/modelo-beige.png' },
      { id:'vinotinto', name:'Vinotinto', hex:'#6d2130', image:'/assets/modelo-vinotinto.png' },
      { id:'azul-rey', name:'Azul rey', hex:'#2d5ea8', image:'/assets/modelo-azul-rey.png' },
      { id:'gris-oscuro', name:'Gris oscuro', hex:'#505050', image:'/assets/modelo-gris-oscuro.png' }
    ]
  },
  {
    id: 'adidas-logo', brand: 'Adidas', name: 'Camiseta Adidas Logo', badge: 'Selección',
    description: 'Una referencia deportiva de presencia limpia para looks casuales.',
    fit: 'Regular', material: 'Ver etiqueta de la referencia original',
    modelImage:'/assets/modelo-azul-marino.png',
    colors: [
      { id:'azul-marino', name:'Azul marino', hex:'#172843', image:'/assets/modelo-azul-marino.png' },
      { id:'negro', name:'Negro', hex:'#111111', image:'/assets/modelo-negro.png' },
      { id:'blanco', name:'Blanco', hex:'#f4f4f2', image:'/assets/modelo-blanco.png' },
      { id:'gris', name:'Gris', hex:'#a8a8a8', image:'/assets/modelo-gris.png' },
      { id:'rojo', name:'Rojo', hex:'#d61f2b', image:'/assets/adidas-rojo.png' },
      { id:'verde-oliva', name:'Verde oliva', hex:'#677052', image:'/assets/modelo-verde-oliva.png' },
      { id:'beige', name:'Beige', hex:'#d2bea3', image:'/assets/modelo-beige.png' },
      { id:'vinotinto', name:'Vinotinto', hex:'#6d2130', image:'/assets/modelo-vinotinto.png' },
      { id:'azul-rey', name:'Azul rey', hex:'#2d5ea8', image:'/assets/modelo-azul-rey.png' },
      { id:'cafe', name:'Café', hex:'#5b4637', image:'/assets/modelo-cafe.png' }
    ]
  },
  {
    id: 'reebok-classic', brand: 'Reebok', name: 'Camiseta Reebok Classic', badge: 'Selección',
    description: 'Estilo clásico deportivo con una composición sencilla y fácil de combinar.',
    fit: 'Regular', material: 'Ver etiqueta de la referencia original',
    modelImage:'/assets/modelo-vinotinto.png',
    colors: [
      { id:'vinotinto', name:'Vinotinto', hex:'#6d2130', image:'/assets/modelo-vinotinto.png' },
      { id:'negro', name:'Negro', hex:'#111111', image:'/assets/modelo-negro.png' },
      { id:'blanco', name:'Blanco', hex:'#f4f4f2', image:'/assets/modelo-blanco.png' },
      { id:'gris', name:'Gris', hex:'#a8a8a8', image:'/assets/modelo-gris.png' },
      { id:'rojo', name:'Rojo', hex:'#c5232e', image:'/assets/reebok-rojo.png' },
      { id:'azul-marino', name:'Azul marino', hex:'#172843', image:'/assets/modelo-azul-marino.png' },
      { id:'verde-oliva', name:'Verde oliva', hex:'#677052', image:'/assets/modelo-verde-oliva.png' },
      { id:'beige', name:'Beige', hex:'#d2bea3', image:'/assets/modelo-beige.png' },
      { id:'azul-rey', name:'Azul rey', hex:'#2d5ea8', image:'/assets/modelo-azul-rey.png' },
      { id:'gris-oscuro', name:'Gris oscuro', hex:'#505050', image:'/assets/modelo-gris-oscuro.png' }
    ]
  },
  {
    id: 'ua-sportstyle', brand: 'Under Armour', name: 'Camiseta Under Armour Sportstyle', badge: 'Sport',
    description: 'Estética deportiva, logo discreto y presencia limpia para uso diario.',
    fit: 'Regular', material: 'Ver etiqueta de la referencia original',
    modelImage:'/assets/modelo-verde-oliva.png',
    colors: [
      { id:'verde-oliva', name:'Verde oliva', hex:'#677052', image:'/assets/modelo-verde-oliva.png' },
      { id:'negro', name:'Negro', hex:'#111111', image:'/assets/modelo-negro.png' },
      { id:'blanco', name:'Blanco', hex:'#f4f4f2', image:'/assets/modelo-blanco.png' },
      { id:'gris', name:'Gris', hex:'#a8a8a8', image:'/assets/modelo-gris.png' },
      { id:'rojo', name:'Rojo', hex:'#d11d2a', image:'/assets/under-armour-rojo.png' },
      { id:'azul-marino', name:'Azul marino', hex:'#172843', image:'/assets/modelo-azul-marino.png' },
      { id:'beige', name:'Beige', hex:'#d2bea3', image:'/assets/modelo-beige.png' },
      { id:'vinotinto', name:'Vinotinto', hex:'#6d2130', image:'/assets/modelo-vinotinto.png' },
      { id:'azul-rey', name:'Azul rey', hex:'#2d5ea8', image:'/assets/modelo-azul-rey.png' },
      { id:'cafe', name:'Café', hex:'#5b4637', image:'/assets/modelo-cafe.png' }
    ]
  }
]

function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function writeJsonAtomic(file, value) { const tmp = `${file}.tmp`; fs.writeFileSync(tmp, JSON.stringify(value, null, 2)); fs.renameSync(tmp, file); }
function money(n) { return `$${Number(n).toLocaleString('es-CO')}`; }
function json(res, status, payload) { const body = JSON.stringify(payload); res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),'Cache-Control':'no-store'}); res.end(body); }
function text(res, status, body, type='text/plain; charset=utf-8') { res.writeHead(status, {'Content-Type':type,'Content-Length':Buffer.byteLength(body)}); res.end(body); }

function secureHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https://images.unsplash.com https://unsplash.com; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; form-action 'self' https://checkout.wompi.co; base-uri 'self'; frame-ancestors 'self'");
  if (config.baseUrl.startsWith('https://')) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
}

function bodyJson(req, maxBytes=100_000) {
  return new Promise((resolve, reject) => {
    let data='';
    req.on('data', chunk => { data += chunk; if (Buffer.byteLength(data) > maxBytes) { reject(new Error('Payload demasiado grande')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('JSON inválido')); } });
    req.on('error', reject);
  });
}
function cleanString(value,max=120){ return String(value??'').trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max); }
function validEmail(email){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validPhone(phone){ return /^\+?[0-9\s()-]{7,20}$/.test(phone); }
function isConfigured(value){ return value && !/REEMPLAZAR|CAMBIAR|COMPLETAR/i.test(value); }
function wompiReady(){ return isConfigured(config.wompiPublicKey) && isConfigured(config.wompiIntegritySecret); }
function sha256(value){ return crypto.createHash('sha256').update(value).digest('hex'); }
function getNested(obj,dotted){ return dotted.split('.').reduce((acc,key)=>acc==null?undefined:acc[key],obj); }
function safeEqualHex(a,b){ const aa=Buffer.from(String(a||'').toLowerCase()); const bb=Buffer.from(String(b||'').toLowerCase()); return aa.length===bb.length && crypto.timingSafeEqual(aa,bb); }
function uniqueReference(){ return `VEL-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`; }
function token(){ return crypto.randomBytes(24).toString('hex'); }
function productById(id){ return PRODUCTS.find(p=>p.id===id); }

function ensureInventory() {
  const existing = readJson(INVENTORY_FILE, {});
  let changed = false;
  for (const product of PRODUCTS) {
    if (!existing[product.id]) { existing[product.id] = {}; changed = true; }
    for (const color of product.colors) {
      if (!existing[product.id][color.id]) { existing[product.id][color.id] = {}; changed = true; }
      for (const size of SIZES) {
        if (typeof existing[product.id][color.id][size] !== 'number') { existing[product.id][color.id][size] = 10; changed = true; }
      }
    }
  }
  if (changed) writeJsonAtomic(INVENTORY_FILE, existing);
}
ensureInventory();

function approvedReviews(){ return readJson(REVIEWS_FILE,[]).filter(r=>r.status==='approved'); }
function reviewSummary(productId){
  const list=approvedReviews().filter(r=>!productId||r.productId===productId);
  const count=list.length;
  const average=count?Math.round((list.reduce((a,r)=>a+Number(r.rating||0),0)/count)*10)/10:0;
  return {count,average};
}
function productSummary(){
  const reviews=approvedReviews();
  return {
    store:{ name:config.storeName,email:config.storeEmail,whatsapp:config.storeWhatsapp,city:config.storeCity,legalName:config.legalName,nit:config.nit,address:config.address },
    products:PRODUCTS.map(p=>({...p,sizes:SIZES,price:PACK_PRICES[1],reviews:(()=>{const list=reviews.filter(r=>r.productId===p.id);const count=list.length;const average=count?Math.round((list.reduce((a,r)=>a+Number(r.rating||0),0)/count)*10)/10:0;return {count,average};})()})),
    packs:[
      {qty:1,total:PACK_PRICES[1],label:'1 camiseta',unit:PACK_PRICES[1]},
      {qty:2,total:PACK_PRICES[2],label:'2 camisetas',unit:Math.round(PACK_PRICES[2]/2)},
      {qty:3,total:PACK_PRICES[3],label:'3 camisetas',unit:Math.round(PACK_PRICES[3]/3)}
    ],
    shippingFee:0,
    freeShipping:true,
    cashOnDelivery:true,
    paymentConfigured:wompiReady()
  };
}

const RATE = new Map();
function rateLimit(req,res,bucket='api',limit=80,windowMs=60_000){
  const ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').toString().split(',')[0].trim();
  const key=`${bucket}:${ip}`, now=Date.now(), item=RATE.get(key);
  if(!item||item.reset<now){ RATE.set(key,{count:1,reset:now+windowMs}); return true; }
  item.count+=1;
  if(item.count>limit){ json(res,429,{error:'Demasiadas solicitudes. Intenta nuevamente en un momento.'}); return false; }
  return true;
}
setInterval(()=>{ const now=Date.now(); for(const [k,v] of RATE) if(v.reset<now) RATE.delete(k); },120_000).unref();

function validateItems(items){
  if(!Array.isArray(items)||![1,2,3].includes(items.length)) throw new Error('El pedido debe contener 1, 2 o 3 camisetas.');
  const inventory=readJson(INVENTORY_FILE,{});
  return items.map((raw,idx)=>{
    const productId=cleanString(raw.productId,48);
    const product=productById(productId);
    if(!product) throw new Error(`Producto inválido en la camiseta ${idx+1}.`);
    const color=cleanString(raw.color,32);
    const size=cleanString(raw.size,4).toUpperCase();
    const colorObj=product.colors.find(c=>c.id===color);
    if(!colorObj) throw new Error(`Color inválido en la camiseta ${idx+1}.`);
    if(!SIZES.includes(size)) throw new Error(`Talla inválida en la camiseta ${idx+1}.`);
    if((inventory[productId]?.[color]?.[size]??0)<1) throw new Error(`Sin inventario: ${product.brand} ${colorObj.name}, talla ${size}.`);
    return { productId, productName:product.name, brand:product.brand, color, colorName:colorObj.name, size, image:colorObj.image };
  });
}

function reserveOnApproval(order){
  if(order.inventoryApplied) return order;
  const inventory=readJson(INVENTORY_FILE,{});
  for(const item of order.items){
    if(inventory[item.productId]?.[item.color] && typeof inventory[item.productId][item.color][item.size]==='number') {
      inventory[item.productId][item.color][item.size]=Math.max(0,inventory[item.productId][item.color][item.size]-1);
    }
  }
  writeJsonAtomic(INVENTORY_FILE,inventory); order.inventoryApplied=true; return order;
}
function saveOrder(order){ const orders=readJson(ORDERS_FILE,[]); const idx=orders.findIndex(o=>o.reference===order.reference); if(idx>=0) orders[idx]=order; else orders.push(order); writeJsonAtomic(ORDERS_FILE,orders); }

function serveStatic(req,res,pathname){
  let rel=pathname==='/'?'/index.html':pathname;
  try{ rel=decodeURIComponent(rel); }catch{ return text(res,400,'Ruta inválida'); }
  const full=path.resolve(PUBLIC_DIR,'.'+rel);
  if(!full.startsWith(PUBLIC_DIR+path.sep)&&full!==path.join(PUBLIC_DIR,'index.html')) return text(res,403,'Prohibido');
  if(!fs.existsSync(full)||!fs.statSync(full).isFile()) return false;
  const ext=path.extname(full).toLowerCase();
  const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp','.json':'application/json; charset=utf-8'}[ext]||'application/octet-stream';
  const stat=fs.statSync(full);
  res.writeHead(200,{'Content-Type':mime,'Content-Length':stat.size,'Cache-Control':ext==='.html'?'no-cache':'public, max-age=86400'});
  fs.createReadStream(full).pipe(res); return true;
}

async function handleApi(req,res,url){
  if(!rateLimit(req,res)) return;
  if(req.method==='GET'&&url.pathname==='/api/health') return json(res,200,{ok:true,store:config.storeName,time:new Date().toISOString()});
  if(req.method==='GET'&&url.pathname==='/api/catalog') return json(res,200,productSummary());
  if(req.method==='GET'&&url.pathname==='/api/reviews'){
    const productId=cleanString(url.searchParams.get('productId'),48);
    let list=approvedReviews();
    if(productId) list=list.filter(r=>r.productId===productId);
    list=list.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,60);
    const publicList=list.map(({email,orderRef,status,ip,...r})=>r);
    return json(res,200,{reviews:publicList,summary:reviewSummary(productId||null)});
  }
  if(req.method==='POST'&&url.pathname==='/api/reviews'){
    if(!rateLimit(req,res,'reviews',5,60*60_000)) return;
    try{
      const body=await bodyJson(req,40_000);
      const name=cleanString(body.name,60), email=cleanString(body.email,120).toLowerCase(), orderRef=cleanString(body.orderRef,90);
      const productId=cleanString(body.productId,48), comment=cleanString(body.comment,700);
      const rating=Number(body.rating);
      const product=productById(productId);
      if(name.length<2) throw new Error('Escribe tu nombre.');
      if(!product) throw new Error('Selecciona un producto válido.');
      if(!Number.isInteger(rating)||rating<1||rating>5) throw new Error('Selecciona una calificación de 1 a 5 estrellas.');
      if(comment.length<12) throw new Error('Cuéntanos un poco más sobre tu experiencia.');
      if(email && !validEmail(email)) throw new Error('El correo no es válido.');
      let verified=false;
      if(orderRef && email){
        const order=readJson(ORDERS_FILE,[]).find(o=>o.reference===orderRef && String(o.customer?.email||'').toLowerCase()===email && o.paymentStatus==='APPROVED' && o.items?.some(i=>i.productId===productId));
        verified=Boolean(order);
      }
      const reviews=readJson(REVIEWS_FILE,[]);
      const review={id:`REV-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,name,productId,productName:product.name,rating,comment,email,orderRef,verified,status:'pending',createdAt:new Date().toISOString(),ip:(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').toString().split(',')[0].trim()};
      reviews.push(review); writeJsonAtomic(REVIEWS_FILE,reviews);
      return json(res,201,{ok:true,message:'Gracias. Tu opinión fue enviada y aparecerá cuando sea revisada.'});
    }catch(err){ return json(res,400,{error:err.message||'No fue posible enviar tu opinión.'}); }
  }
  if(req.method==='POST'&&url.pathname==='/api/checkout'){
    if(!rateLimit(req,res,'checkout',12,60_000)) return;
    try{
      const body=await bodyJson(req); const items=validateItems(body.items);
      const customer={
        fullName:cleanString(body.customer?.fullName,90), email:cleanString(body.customer?.email,120).toLowerCase(), phone:cleanString(body.customer?.phone,24),
        document:cleanString(body.customer?.document,24), address:cleanString(body.customer?.address,150), city:cleanString(body.customer?.city,80),
        department:cleanString(body.customer?.department,80), notes:cleanString(body.customer?.notes,250)
      };
      if(customer.fullName.length<3) throw new Error('Escribe el nombre completo.');
      if(!validEmail(customer.email)) throw new Error('Escribe un correo válido.');
      if(!validPhone(customer.phone)) throw new Error('Escribe un teléfono válido.');
      if(customer.address.length<5||customer.city.length<2) throw new Error('Completa la dirección y la ciudad.');
      const paymentMethod=cleanString(body.paymentMethod||'WOMPI',24).toUpperCase();
      const reference=uniqueReference(), accessToken=token();
      const subtotal=PACK_PRICES[items.length], shipping=0, total=subtotal, amountInCents=total*100, currency='COP';
      const redirectUrl=`${config.baseUrl}/resultado.html?ref=${encodeURIComponent(reference)}&token=${encodeURIComponent(accessToken)}`;
      if(paymentMethod==='COD'){
        let order={reference,accessToken,items,customer,subtotal,shipping,total,currency,status:'COD_CONFIRMED',paymentStatus:'COD_PENDING',paymentMethod:'CASH_ON_DELIVERY',wompiTransactionId:null,inventoryApplied:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),ip:(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').toString().split(',')[0].trim()};
        order=reserveOnApproval(order);
        saveOrder(order);
        return json(res,200,{checkoutUrl:redirectUrl,reference,total,totalFormatted:money(total),paymentMethod:'COD'});
      }
      if(!wompiReady()) return json(res,503,{error:'La tienda está lista, pero falta configurar las llaves de Wompi.',code:'PAYMENT_NOT_CONFIGURED'});
      const signature=sha256(`${reference}${amountInCents}${currency}${config.wompiIntegritySecret}`);
      const params=new URLSearchParams({'public-key':config.wompiPublicKey,'currency':currency,'amount-in-cents':String(amountInCents),'reference':reference,'signature:integrity':signature,'redirect-url':redirectUrl,'customer-data:email':customer.email,'customer-data:full-name':customer.fullName,'customer-data:phone-number':customer.phone});
      const checkoutUrl=`https://checkout.wompi.co/p/?${params.toString()}`;
      const order={reference,accessToken,items,customer,subtotal,shipping,total,currency,status:'CREATED',paymentStatus:'PENDING',paymentMethod:'WOMPI',wompiTransactionId:null,inventoryApplied:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),ip:(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').toString().split(',')[0].trim()};
      saveOrder(order); return json(res,200,{checkoutUrl,reference,total,totalFormatted:money(total),paymentMethod:'WOMPI'});
    }catch(err){ return json(res,400,{error:err.message||'No fue posible preparar el pago.'}); }
  }
  if(req.method==='GET'&&url.pathname==='/api/order'){
    const reference=cleanString(url.searchParams.get('ref'),80), accessToken=cleanString(url.searchParams.get('token'),80);
    const order=readJson(ORDERS_FILE,[]).find(o=>o.reference===reference&&o.accessToken===accessToken);
    if(!order) return json(res,404,{error:'Pedido no encontrado.'});
    return json(res,200,{reference:order.reference,items:order.items,total:order.total,totalFormatted:money(order.total),status:order.status,paymentStatus:order.paymentStatus,createdAt:order.createdAt});
  }
  if(req.method==='POST'&&url.pathname==='/api/webhooks/wompi'){
    try{
      const body=await bodyJson(req,300_000);
      if(!isConfigured(config.wompiEventsSecret)) return json(res,503,{error:'WOMPI_EVENTS_SECRET no configurado.'});
      const props=Array.isArray(body.signature?.properties)?body.signature.properties:[];
      const values=props.map(p=>getNested(body.data,p));
      if(values.some(v=>v===undefined)) return json(res,400,{error:'Evento Wompi incompleto.'});
      const material=values.map(v=>String(v)).join('')+String(body.timestamp)+config.wompiEventsSecret;
      const expected=sha256(material), supplied=req.headers['x-event-checksum']||body.signature?.checksum||'';
      if(!safeEqualHex(expected,supplied)) return json(res,401,{error:'Firma de evento inválida.'});
      if(body.event==='transaction.updated'){
        const txn=body.data?.transaction||{}, reference=txn.reference, orders=readJson(ORDERS_FILE,[]), idx=orders.findIndex(o=>o.reference===reference);
        if(idx>=0){ let order=orders[idx]; order.paymentStatus=txn.status||order.paymentStatus; order.status=txn.status==='APPROVED'?'PAID':(txn.status||order.status); order.wompiTransactionId=txn.id||order.wompiTransactionId; order.paymentMethod=txn.payment_method_type||txn.paymentMethodType||order.paymentMethod||null; order.updatedAt=new Date().toISOString(); if(txn.status==='APPROVED') order=reserveOnApproval(order); orders[idx]=order; writeJsonAtomic(ORDERS_FILE,orders); }
      }
      return json(res,200,{received:true});
    }catch(err){ return json(res,400,{error:err.message||'Evento inválido.'}); }
  }
  if(req.method==='GET'&&url.pathname==='/api/admin/orders'){
    const auth=req.headers.authorization||'';
    if(!isConfigured(config.adminToken)||auth!==`Bearer ${config.adminToken}`) return json(res,401,{error:'No autorizado.'});
    const orders=readJson(ORDERS_FILE,[]).map(({accessToken,ip,...o})=>({...o,customer:{...o.customer,document:o.customer?.document?'***'+o.customer.document.slice(-4):''}})).reverse();
    return json(res,200,{orders});
  }
  if(req.method==='GET'&&url.pathname==='/api/admin/inventory'){
    const auth=req.headers.authorization||'';
    if(!isConfigured(config.adminToken)||auth!==`Bearer ${config.adminToken}`) return json(res,401,{error:'No autorizado.'});
    return json(res,200,{inventory:readJson(INVENTORY_FILE,{})});
  }
  if(req.method==='GET'&&url.pathname==='/api/admin/reviews'){
    const auth=req.headers.authorization||'';
    if(!isConfigured(config.adminToken)||auth!==`Bearer ${config.adminToken}`) return json(res,401,{error:'No autorizado.'});
    const reviews=readJson(REVIEWS_FILE,[]).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    return json(res,200,{reviews});
  }
  if(req.method==='PATCH'&&url.pathname.startsWith('/api/admin/reviews/')){
    const auth=req.headers.authorization||'';
    if(!isConfigured(config.adminToken)||auth!==`Bearer ${config.adminToken}`) return json(res,401,{error:'No autorizado.'});
    try{
      const id=cleanString(url.pathname.split('/').pop(),80); const body=await bodyJson(req,10_000);
      const status=cleanString(body.status,16); if(!['approved','rejected','pending'].includes(status)) throw new Error('Estado inválido.');
      const reviews=readJson(REVIEWS_FILE,[]), idx=reviews.findIndex(r=>r.id===id); if(idx<0) return json(res,404,{error:'Opinión no encontrada.'});
      reviews[idx].status=status; reviews[idx].moderatedAt=new Date().toISOString(); writeJsonAtomic(REVIEWS_FILE,reviews);
      return json(res,200,{ok:true,review:reviews[idx]});
    }catch(err){ return json(res,400,{error:err.message||'No fue posible actualizar la opinión.'}); }
  }
  if(req.method==='DELETE'&&url.pathname.startsWith('/api/admin/reviews/')){
    const auth=req.headers.authorization||'';
    if(!isConfigured(config.adminToken)||auth!==`Bearer ${config.adminToken}`) return json(res,401,{error:'No autorizado.'});
    const id=cleanString(url.pathname.split('/').pop(),80), reviews=readJson(REVIEWS_FILE,[]), next=reviews.filter(r=>r.id!==id);
    if(next.length===reviews.length) return json(res,404,{error:'Opinión no encontrada.'});
    writeJsonAtomic(REVIEWS_FILE,next); return json(res,200,{ok:true});
  }
  return json(res,404,{error:'Ruta API no encontrada.'});
}

const server=http.createServer(async(req,res)=>{
  secureHeaders(res); const url=new URL(req.url,config.baseUrl);
  if(url.pathname.startsWith('/api/')) return handleApi(req,res,url);
  if(url.pathname==='/robots.txt') return text(res,200,`User-agent: *\nAllow: /\nSitemap: ${config.baseUrl}/sitemap.xml\n`);
  if(url.pathname==='/sitemap.xml'){
    const pages=['/','/politicas.html','/envios.html','/cambios.html','/privacidad.html','/terminos.html','/datos.html','/garantia.html','/guia-tallas.html','/contacto.html','/nosotros.html','/autenticidad.html'];
    const xml=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map(p=>`<url><loc>${config.baseUrl}${p}</loc></url>`).join('')}</urlset>`;
    return text(res,200,xml,'application/xml; charset=utf-8');
  }
  if(serveStatic(req,res,url.pathname)) return;
  serveStatic(req,res,'/404.html')||text(res,404,'No encontrado');
});
server.listen(config.port,()=>{ console.log(`\n${config.storeName} disponible en http://localhost:${config.port}`); console.log(`BASE_URL: ${config.baseUrl}`); console.log(`Wompi: ${wompiReady()?'configurado':'pendiente de llaves'}`); console.log(`Webhook Wompi: ${config.baseUrl}/api/webhooks/wompi\n`); });
