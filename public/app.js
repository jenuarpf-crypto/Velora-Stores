(() => {
  const $ = s => document.querySelector(s);
  const money = n => new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n);
  const state = { catalog:null, reviews:[], reviewSummary:{count:0,average:0}, filter:'Todos', selectedProduct:null, selectedColor:null, selectedSize:'M', cart:loadCart() };

  function loadCart(){
    try { const v=JSON.parse(localStorage.getItem('veloraCart')||'[]'); return Array.isArray(v)?v.slice(0,3):[]; } catch { return []; }
  }
  function saveCart(){ localStorage.setItem('veloraCart',JSON.stringify(state.cart)); }
  function byProduct(id){ return state.catalog?.products.find(p=>p.id===id); }
  function byColor(product,colorId){ return product?.colors.find(c=>c.id===colorId); }

  async function boot(){
    try{
      const r=await fetch('/api/catalog');
      if(!r.ok) throw new Error('No pudimos cargar la tienda. Intenta de nuevo.');
      state.catalog=await r.json();
      await loadReviews();
      wireStore(); renderFilters(); renderCatalog(); renderCart(); renderReviews(); fillReviewProducts(); wireEvents();
    }catch(e){
      const grid=$('#catalogGrid'); if(grid) grid.innerHTML=`<div class="legal-note">${escapeHtml(e.message)}</div>`;
    }
  }

  function wireStore(){
    const s=state.catalog.store; const wa=`https://wa.me/${String(s.whatsapp||'').replace(/\D/g,'')}`;
    ['#waLink','#floatingWa'].forEach(sel=>{ const el=$(sel); if(el) el.href=wa; });
    if($('#storeCity')) $('#storeCity').textContent=s.city||'Colombia';
    if($('#year')) $('#year').textContent=new Date().getFullYear();
  }

  function wireEvents(){
    $('#cartTrigger')?.addEventListener('click',openCart);
    $('#cartClose')?.addEventListener('click',closeCart);
    $('#drawerBackdrop')?.addEventListener('click',closeCart);
    $('#continueShopping')?.addEventListener('click',()=>{closeCart();location.hash='#coleccion';});
    $('#productModalClose')?.addEventListener('click',closeProduct);
    $('#productModal')?.addEventListener('click',e=>{if(e.target.id==='productModal') closeProduct();});
    $('#addToCart')?.addEventListener('click',addSelectedToCart);
    $('#openCheckout')?.addEventListener('click',openCheckout);
    $('#checkoutClose')?.addEventListener('click',closeCheckout);
    $('#checkoutModal')?.addEventListener('click',e=>{if(e.target.id==='checkoutModal') closeCheckout();});
    $('#checkoutForm')?.addEventListener('submit',submitCheckout);
    $('#reviewForm')?.addEventListener('submit',submitReview);
    $('#heroBuyButton')?.addEventListener('click',()=>openProduct('puma-essential'));
    document.querySelectorAll('[data-open-product]').forEach(el=>el.addEventListener('click',()=>openProduct(el.dataset.openProduct)));
    document.addEventListener('keydown',e=>{ if(e.key==='Escape'){closeProduct();closeCheckout();closeCart();} });
  }

  function renderFilters(){
    const el=$('#brandFilters'); if(!el) return;
    const brands=['Todos',...new Set(state.catalog.products.map(p=>p.brand))];
    el.innerHTML='';
    brands.forEach(b=>{
      const btn=document.createElement('button'); btn.className='filter-btn'+(state.filter===b?' active':''); btn.type='button'; btn.textContent=b;
      btn.onclick=()=>{state.filter=b;renderFilters();renderCatalog();}; el.appendChild(btn);
    });
  }

  function renderCatalog(){
    const el=$('#catalogGrid'); if(!el) return;
    const list=state.catalog.products.filter(p=>state.filter==='Todos'||p.brand===state.filter);
    el.innerHTML='';
    list.forEach(p=>{
      const first=p.colors[0];
      const card=document.createElement('article'); card.className='product-card';
      card.innerHTML=`
        <div class="product-image-zone"><div class="product-badge">${escapeHtml(p.badge||'Selección')}</div><img src="${p.modelImage||first.image}" alt="Modelo masculino con ${escapeHtml(p.name)}"></div>
        <div class="product-body">
          <div class="product-brand">${escapeHtml(p.brand.toUpperCase())}</div>
          <h3>${escapeHtml(p.name)}</h3>
          <div class="product-rating">${p.reviews?.count?`<span>★ ${Number(p.reviews.average).toFixed(1)}</span><small>${p.reviews.count} opinión${p.reviews.count===1?'':'es'}</small>`:'<span>☆ Nuevo</span><small>10 colores disponibles</small>'}</div>
          <p class="product-desc">${escapeHtml(p.description)}</p>
          <div class="mini-swatches">${p.colors.map(c=>`<span class="mini-dot" title="${escapeHtml(c.name)}" style="background:${c.hex}"></span>`).join('')}</div>
          <div class="product-benefit-line"><span>Envío gratis</span><span>Contra entrega</span></div>
          <div class="product-bottom"><div class="product-price"><strong>$65.000</strong><span>2 × $110.000 · 3 × $160.000</span></div><button class="quick-btn" type="button">VER / COMPRAR</button></div>
        </div>`;
      card.querySelector('.quick-btn').onclick=()=>openProduct(p.id);
      card.querySelector('.product-image-zone').onclick=()=>openProduct(p.id);
      card.querySelector('.product-image-zone').style.cursor='pointer';
      el.appendChild(card);
    });
  }

  function openProduct(productId){
    const p=byProduct(productId); if(!p) return;
    state.selectedProduct=p; state.selectedColor=p.colors[0].id; state.selectedSize='M';
    $('#modalBrand').textContent=p.brand.toUpperCase(); $('#modalTitle').textContent=p.name; $('#modalDescription').textContent=p.description;
    renderModalOptions();
    $('#productModal').hidden=false; document.body.classList.add('locked');
  }
  function closeProduct(){ const m=$('#productModal'); if(m) m.hidden=true; if($('#checkoutModal')?.hidden!==false && !$('#cartDrawer')?.classList.contains('open')) document.body.classList.remove('locked'); }
  function renderModalOptions(){
    const p=state.selectedProduct, color=byColor(p,state.selectedColor);
    $('#modalImage').src=color.image; $('#modalImage').alt=`${p.name} ${color.name}`; $('#modalColorName').textContent=color.name;
    $('#modalSwatches').innerHTML='';
    p.colors.forEach(c=>{ const b=document.createElement('button'); b.type='button'; b.className='color-button'+(c.id===state.selectedColor?' active':''); b.style.setProperty('--c',c.hex); b.title=c.name; b.onclick=()=>{state.selectedColor=c.id;renderModalOptions();}; $('#modalSwatches').appendChild(b); });
    $('#modalSizes').innerHTML='';
    p.sizes.forEach(size=>{ const b=document.createElement('button'); b.type='button'; b.className='size-button'+(size===state.selectedSize?' active':''); b.textContent=size; b.onclick=()=>{state.selectedSize=size;renderModalOptions();}; $('#modalSizes').appendChild(b); });
  }

  function addSelectedToCart(){
    if(state.cart.length>=3){ alert('El combo máximo es de 3 camisetas por pedido. Puedes finalizar este pedido y luego hacer otro.'); return; }
    const p=state.selectedProduct, c=byColor(p,state.selectedColor);
    state.cart.push({id:cryptoId(),productId:p.id,brand:p.brand,productName:p.name,color:c.id,colorName:c.name,size:state.selectedSize,image:c.image});
    saveCart(); renderCart(); closeProduct(); openCart();
  }
  function cryptoId(){ return `${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }

  function openCart(){ $('#cartDrawer').classList.add('open'); $('#cartDrawer').setAttribute('aria-hidden','false'); $('#drawerBackdrop').hidden=false; document.body.classList.add('locked'); }
  function closeCart(){ $('#cartDrawer')?.classList.remove('open'); $('#cartDrawer')?.setAttribute('aria-hidden','true'); if($('#drawerBackdrop')) $('#drawerBackdrop').hidden=true; if($('#productModal')?.hidden!==false && $('#checkoutModal')?.hidden!==false) document.body.classList.remove('locked'); }

  function totals(){ const q=state.cart.length; const subtotal=q?state.catalog.packs.find(p=>p.qty===q).total:0; const shipping=q?state.catalog.shippingFee:0; return {q,subtotal,shipping,total:subtotal+shipping}; }
  function renderCart(){
    const count=state.cart.length; if($('#cartCount')) $('#cartCount').textContent=count;
    const empty=$('#cartEmpty'), content=$('#cartContent'); if(!empty||!content) return;
    empty.hidden=count>0; content.hidden=count===0;
    const items=$('#cartItems'); items.innerHTML='';
    state.cart.forEach(item=>{
      const row=document.createElement('div'); row.className='cart-item';
      row.innerHTML=`<img src="${item.image}" alt=""><div><strong>${escapeHtml(item.brand)} · ${escapeHtml(item.productName.replace(item.brand,'').trim())}</strong><span>${escapeHtml(item.colorName)} · Talla ${escapeHtml(item.size)}</span></div><button class="remove-item" type="button" aria-label="Eliminar">×</button>`;
      row.querySelector('.remove-item').onclick=()=>{state.cart=state.cart.filter(x=>x.id!==item.id);saveCart();renderCart();}; items.appendChild(row);
    });
    const t=totals(); $('#cartSubtotal').textContent=money(t.subtotal); $('#cartShipping').textContent=t.shipping?money(t.shipping):'Gratis'; $('#cartTotal').textContent=money(t.total);
    const pp=$('#promoProgress');
    pp.textContent=count===1?'Agrega una segunda camiseta y tu total será $110.000.':count===2?'Agrega una tercera camiseta y tu total será $160.000.':'Tienes el mejor precio del combo de 3.';
    if($('#checkoutTotal')) $('#checkoutTotal').textContent=money(t.total);
  }

  function openCheckout(){ if(!state.cart.length) return; closeCart(); $('#checkoutModal').hidden=false; $('#checkoutTotal').textContent=money(totals().total); document.body.classList.add('locked'); }
  function closeCheckout(){ if($('#checkoutModal')) $('#checkoutModal').hidden=true; if(!$('#cartDrawer')?.classList.contains('open') && $('#productModal')?.hidden!==false){} else if(!$('#cartDrawer')?.classList.contains('open') && $('#productModal')?.hidden!==false){}; if($('#productModal')?.hidden!==false || $('#cartDrawer')?.classList.contains('open')) return; document.body.classList.remove('locked'); }

  async function submitCheckout(e){
    e.preventDefault(); const msg=$('#checkoutMessage'); msg.className='message span-2'; msg.textContent='Preparando pago seguro…';
    const form=new FormData(e.currentTarget); if(!$('#termsCheck').checked){msg.classList.add('error');msg.textContent='Debes aceptar los términos y la política de privacidad.';return;}
    const customer={fullName:form.get('fullName'),email:form.get('email'),phone:form.get('phone'),document:form.get('document'),address:form.get('address'),city:form.get('city'),department:form.get('department'),notes:form.get('notes')};
    const items=state.cart.map(i=>({productId:i.productId,color:i.color,size:i.size}));
    const paymentMethod=form.get('paymentMethod')||'WOMPI';
    const btn=$('#payButton'); btn.disabled=true;
    try{
      const r=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer,items,paymentMethod})});
      const data=await r.json(); if(!r.ok) throw new Error(data.error||'No fue posible preparar el pedido.');
      msg.classList.add('success'); msg.textContent=paymentMethod==='COD'?'Pedido contra entrega confirmado.':'Listo. Te llevamos a Wompi…';
      setTimeout(()=>{ window.location.href=data.checkoutUrl; },500);
    }catch(err){ msg.classList.add('error'); msg.textContent=err.message; btn.disabled=false; }
  }


  async function loadReviews(){
    try{
      const r=await fetch('/api/reviews');
      if(!r.ok) throw new Error('No fue posible cargar las opiniones.');
      const d=await r.json(); state.reviews=Array.isArray(d.reviews)?d.reviews:[]; state.reviewSummary=d.summary||{count:0,average:0};
    }catch{ state.reviews=[]; state.reviewSummary={count:0,average:0}; }
  }

  function fillReviewProducts(){
    const el=$('#reviewProduct'); if(!el||!state.catalog) return;
    state.catalog.products.forEach(p=>{ const o=document.createElement('option'); o.value=p.id; o.textContent=`${p.brand} · ${p.name.replace(p.brand,'').trim()}`; el.appendChild(o); });
  }

  function renderReviews(){
    const list=$('#reviewList'); if(!list) return;
    const s=state.reviewSummary||{count:0,average:0};
    if($('#reviewAverage')) $('#reviewAverage').textContent=s.count?Number(s.average).toFixed(1):'—';
    if($('#reviewStars')) $('#reviewStars').textContent=s.count?starsText(Math.round(s.average)):'☆☆☆☆☆';
    if($('#reviewCount')) $('#reviewCount').textContent=s.count?`${s.count} opinión${s.count===1?'':'es'} publicada${s.count===1?'':'s'}`:'Aún no hay opiniones publicadas';
    if(!state.reviews.length){ list.innerHTML='<div class="review-empty">Aún no hay opiniones publicadas. Sé la primera persona en compartir tu experiencia.</div>'; return; }
    list.innerHTML=state.reviews.slice(0,12).map(r=>`<article class="customer-review">
      <div class="customer-review-top"><div><strong>${escapeHtml(r.name)}</strong><span>${escapeHtml(r.productName||'VELORA')}</span></div><div class="review-badges"><span class="review-stars">${starsText(Number(r.rating)||0)}</span>${r.verified?'<span class="verified-badge">Compra verificada</span>':''}</div></div>
      <p>${escapeHtml(r.comment)}</p>
      <footer>${new Date(r.createdAt).toLocaleDateString('es-CO',{year:'numeric',month:'short',day:'numeric'})}</footer>
    </article>`).join('');
  }
  function starsText(n){ n=Math.max(0,Math.min(5,Number(n)||0)); return '★★★★★'.slice(0,n)+'☆☆☆☆☆'.slice(n); }

  async function submitReview(e){
    e.preventDefault(); const form=e.currentTarget, msg=$('#reviewMessage'), btn=$('#reviewSubmit');
    msg.className='message'; msg.textContent='Enviando tu opinión…'; btn.disabled=true;
    const fd=new FormData(form); const payload={name:fd.get('name'),productId:fd.get('productId'),rating:Number(fd.get('rating')),comment:fd.get('comment'),email:fd.get('email'),orderRef:fd.get('orderRef')};
    try{
      const r=await fetch('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const d=await r.json();
      if(!r.ok) throw new Error(d.error||'No fue posible enviar tu opinión.');
      msg.classList.add('success'); msg.textContent=d.message||'Gracias. Tu opinión fue enviada para revisión.'; form.reset();
    }catch(err){ msg.classList.add('error'); msg.textContent=err.message; }
    finally{ btn.disabled=false; }
  }

  function escapeHtml(v){ return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  boot();
})();
