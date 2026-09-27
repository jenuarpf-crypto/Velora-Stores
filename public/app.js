(() => {
  const money = n => new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', maximumFractionDigits:0 }).format(n);
  const $ = s => document.querySelector(s);
  const state = { catalog:null, selectedColor:'negro', qty:1, items:[{color:'negro', size:'M'}] };

  async function boot(){
    try{
      const r = await fetch('/api/catalog');
      if(!r.ok) throw new Error('No se pudo cargar el catálogo');
      state.catalog = await r.json();
      wireStoreInfo();
      renderColors();
      renderPacks();
      renderItems();
      updateTotals();
      $('#checkoutForm').addEventListener('submit', submitCheckout);
    }catch(e){
      showMessage(e.message, 'error');
    }
  }

  function wireStoreInfo(){
    const s = state.catalog.store;
    $('#waLink').href = `https://wa.me/${String(s.whatsapp).replace(/\D/g,'')}`;
    $('#emailLink').href = `mailto:${s.email}`;
    $('#emailLink').textContent = s.email;
    $('#storeCity').textContent = s.city;
  }

  function renderColors(){
    const sw = $('#swatches'); const tr = $('#thumbRow');
    sw.innerHTML=''; tr.innerHTML='';
    state.catalog.product.colors.forEach(c => {
      const b = document.createElement('button');
      b.type='button'; b.className='swatch'+(c.id===state.selectedColor?' active':'');
      b.style.setProperty('--swatch',c.hex); b.title=c.name; b.setAttribute('aria-label',c.name);
      b.onclick=()=>selectHeroColor(c.id);
      sw.appendChild(b);
      const t = document.createElement('button');
      t.type='button';t.className='thumb'+(c.id===state.selectedColor?' active':'');t.title=c.name;
      t.innerHTML=`<img src="${c.image}" alt="">`;
      t.onclick=()=>selectHeroColor(c.id);
      tr.appendChild(t);
    });
  }

  function selectHeroColor(id){
    state.selectedColor=id;
    const c=state.catalog.product.colors.find(x=>x.id===id);
    const img=$('#heroImage');img.classList.add('switching');
    setTimeout(()=>{img.src=c.image;img.alt=`Camiseta Puma color ${c.name}`;img.classList.remove('switching');},100);
    $('#selectedColorName').textContent=c.name;
    if(state.items.length===1) state.items[0].color=id;
    renderColors();renderItems();
  }

  function renderPacks(){
    const el=$('#packCards');el.innerHTML='';
    state.catalog.product.packs.forEach(p=>{
      const b=document.createElement('button');b.type='button';b.className='pack'+(p.qty===state.qty?' active':'');
      const unit=Math.round(p.total/p.qty);
      b.innerHTML=`<b>${p.label}</b><small>${money(unit)} c/u</small><strong>${money(p.total)}</strong>`;
      b.onclick=()=>{state.qty=p.qty;while(state.items.length<p.qty) state.items.push({color:state.selectedColor,size:'M'});state.items=state.items.slice(0,p.qty);renderPacks();renderItems();updateTotals();};
      el.appendChild(b);
    });
  }

  function renderItems(){
    const box=$('#itemsConfig');box.innerHTML='';
    state.items.forEach((item,i)=>{
      const row=document.createElement('div');row.className='item-row';
      const colorOptions=state.catalog.product.colors.map(c=>`<option value="${c.id}" ${c.id===item.color?'selected':''}>${c.name}</option>`).join('');
      const sizeOptions=state.catalog.product.sizes.map(s=>`<option value="${s}" ${s===item.size?'selected':''}>${s}</option>`).join('');
      row.innerHTML=`<div class="item-number">${i+1}</div><label>Color<select data-i="${i}" data-key="color">${colorOptions}</select></label><label>Talla<select data-i="${i}" data-key="size">${sizeOptions}</select></label>`;
      box.appendChild(row);
    });
    box.querySelectorAll('select').forEach(sel=>sel.onchange=()=>{state.items[Number(sel.dataset.i)][sel.dataset.key]=sel.value;});
  }

  function pack(){return state.catalog.product.packs.find(p=>p.qty===state.qty)}
  function updateTotals(){
    if(!state.catalog) return; const p=pack(); const shipping=state.catalog.shippingFee||0; const total=p.total+shipping;
    $('#summarySubtotal').textContent=money(p.total);$('#summaryShipping').textContent=shipping?money(shipping):'Incluido';$('#summaryTotal').textContent=money(total);
  }

  function showMessage(msg,type='info'){
    const el=$('#checkoutMessage');el.textContent=msg;el.className=`message ${type}`;
  }

  async function submitCheckout(ev){
    ev.preventDefault(); const btn=$('#buyButton'); showMessage('', 'info');
    const fd=new FormData(ev.currentTarget); const customer=Object.fromEntries(fd.entries());
    btn.disabled=true;btn.querySelector('span').textContent='Preparando pago…';
    try{
      const r=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:state.items,customer})});
      const data=await r.json(); if(!r.ok) throw new Error(data.error||'No se pudo preparar el pago');
      showMessage(`Pedido ${data.reference} creado. Abriendo pago seguro por ${data.totalFormatted}…`,'info');
      window.location.assign(data.checkoutUrl);
    }catch(e){showMessage(e.message,'error');btn.disabled=false;btn.querySelector('span').textContent='Ir al pago seguro';}
  }
  boot();
})();
