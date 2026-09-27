(() => {
  const p=new URLSearchParams(location.search), ref=p.get('ref'), token=p.get('token');
  const $=s=>document.querySelector(s);
  const view={APPROVED:['✓','Pago aprobado','Tu pago fue aprobado. El pedido queda listo para preparación.'],PAID:['✓','Pago aprobado','Tu pago fue aprobado. El pedido queda listo para preparación.'],DECLINED:['×','Pago rechazado','La pasarela reportó que el pago no fue aprobado.'],ERROR:['!','Error en el pago','La pasarela reportó un error. Puedes volver a la tienda e intentarlo de nuevo.'],VOIDED:['×','Pago anulado','La transacción fue anulada.'],PENDING:['⋯','Pago en proceso','La transacción todavía está pendiente de confirmación.'],CREATED:['⋯','Esperando confirmación','La orden fue creada y estamos esperando la confirmación de la pasarela.']};
  async function load(){
    if(!ref||!token){$('#resultTitle').textContent='Faltan datos del pedido';$('#resultText').textContent='Abre esta página desde el regreso del checkout.';return;}
    try{const r=await fetch(`/api/order?ref=${encodeURIComponent(ref)}&token=${encodeURIComponent(token)}`,{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Pedido no encontrado');const key=d.paymentStatus||d.status||'CREATED';const v=view[key]||view.CREATED;$('#resultCard .result-status').textContent=v[0];$('#statusPill').textContent=key;$('#resultTitle').textContent=v[1];$('#resultText').textContent=v[2];$('#refText').textContent=d.reference;$('#totalText').textContent=d.totalFormatted;if(key==='PENDING'||key==='CREATED')setTimeout(load,4000);}catch(e){$('#resultTitle').textContent='No pudimos consultar el pedido';$('#resultText').textContent=e.message;$('#refText').textContent=ref;}}
  load();
})();
