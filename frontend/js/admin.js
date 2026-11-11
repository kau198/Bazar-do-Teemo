const $ = s => document.querySelector(s);
const money = cents => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const date = value => new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
const escape = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names = {demo_confirmed:'Confirmado',preparing:'Em preparação',shipped:'Enviado',completed:'Concluído',cancelled:'Cancelado'};
const nextStatuses = {demo_confirmed:['preparing','cancelled'],preparing:['shipped','cancelled'],shipped:['completed'],completed:[],cancelled:[]};
let csrf = '', products = [], orders = [], summary = {}, activeView = 'overview', toastTimer;
async function api(path, method = 'GET', body) {
  const res = await fetch('/api/v1/admin'+path,{method,cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},...(body === undefined ? {} : {body:JSON.stringify(body)})});
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) { $('#shell').hidden = true; $('#gate').hidden = false; $('#login-form').hidden = false; }
    throw Object.assign(new Error(data.error || 'Não foi possível concluir a operação.'),{status:res.status});
  }
  return data;
}
function notify(message) { clearTimeout(toastTimer); $('#toast').textContent=message; $('#toast').hidden=false; toastTimer=setTimeout(()=>$('#toast').hidden=true,4500); }
function error(message) { $('#page-error').textContent=message; $('#page-error').hidden=!message; }
function badge(status) { return `<span class="badge ${status==='cancelled'?'muted':status==='preparing'?'warning':''}">${escape(names[status]||status)}</span>`; }
function picture(p) { return p.imageUrl && /^\/assets\/images\/[a-zA-Z0-9_./-]+$/.test(p.imageUrl) ? p.imageUrl : '/assets/icons/icon.svg'; }
async function load() {
  error('');
  const [p,o,s] = await Promise.all([api('/products'),api('/orders'),api('/summary')]);
  products=p.items; orders=o.items; summary=s;
  const selected=$('#category-filter').value;
  const categories=[...new Set(products.map(p=>p.category))].sort();
  $('#category-filter').innerHTML='<option value="">Todas as categorias</option>'+categories.map(c=>`<option>${escape(c)}</option>`).join('');
  if(categories.includes(selected)) $('#category-filter').value=selected;
  $('#categories').innerHTML=categories.map(c=>`<option value="${escape(c)}"></option>`).join('');
  renderProducts(); renderOrders(); renderOverview();
}
function renderOverview() {
  $('#metrics').innerHTML=[['Valor dos pedidos',money(summary.revenueCents),'Total simulado, sem cancelamentos','↗'],['Pedidos',summary.orders,`${summary.pending} aguardando andamento`,'▤'],['Produtos ativos',summary.active,`${summary.products} produtos cadastrados`,'▦'],['Estoque baixo',summary.lowStock,'Produtos com até 5 unidades','◷']].map(([label,value,detail,icon])=>`<article class="metric"><span class="metric-label">${label}<span>${icon}</span></span><strong>${escape(value)}</strong><small>${escape(detail)}</small></article>`).join('');
  $('#recent-orders').innerHTML=orders.slice(0,5).map(o=>`<div class="recent-row"><div><strong>#${escape(o.id.slice(0,8).toUpperCase())} · ${escape(o.customer_name)}</strong><small>${escape(date(o.created_at))}</small></div><div>${badge(o.status)}<small>${money(o.total_cents)}</small></div><button class="text-button" data-order="${escape(o.id)}" aria-label="Ver pedido ${escape(o.id.slice(0,8))}">↗</button></div>`).join('')||'<p class="empty">Seus primeiros pedidos vão aparecer aqui.</p>';
  const low=products.filter(p=>p.active&&p.stock!==null&&p.stock<=5);
  $('#stock-alerts').innerHTML=low.slice(0,4).map(p=>`<div class="stock-row"><img src="${escape(picture(p))}" alt=""><div><strong>${escape(p.name)}</strong><small>${p.stock===0?'Esgotado':`${p.stock} unidades restantes`}</small></div><button data-edit="${p.id}" aria-label="Repor ${escape(p.name)}">Repor →</button></div>`).join('')||'<p class="empty">Tudo em dia por aqui.<br>Nenhum produto com estoque baixo.</p>';
}
function filteredProducts() {
  const term=$('#search').value.trim().toLocaleLowerCase('pt-BR'), category=$('#category-filter').value,status=$('#status-filter').value;
  return products.filter(p=>(!term||`${p.name} ${p.category} ${p.id}`.toLocaleLowerCase('pt-BR').includes(term))&&(!category||p.category===category)&&(!status||(status==='active'?p.active:status==='inactive'?!p.active:p.active&&p.stock!==null&&p.stock<=5)));
}
function renderProducts() {
  const list=filteredProducts();
  $('#product-rows').innerHTML=list.map(p=>`<tr><td><div class="product-cell"><img src="${escape(picture(p))}" alt=""><div><strong>${escape(p.name)}</strong><small>#${p.id}${p.tag?' · '+escape(p.tag):''}</small></div></div></td><td>${escape(p.category)}</td><td>${money(Math.round(p.price*100))}</td><td>${p.stock===null?'Ilimitado':`<span class="${p.stock<=5?'badge warning':''}">${p.stock} un.</span>`}</td><td><span class="badge ${p.active?'':'muted'}">${p.active?'Ativo':'Oculto'}</span></td><td><button data-edit="${p.id}" aria-label="Editar ${escape(p.name)}">Editar</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty">Nenhum produto encontrado. Ajuste os filtros ou adicione um produto.</td></tr>';
  $('#product-count').textContent=`${list.length} de ${products.length} produtos`;
}
function renderOrders() {
  const status=$('#order-filter').value;
  const list=orders.filter(o=>!status||o.status===status);
  $('#order-rows').innerHTML=list.map(o=>`<tr><td>#${escape(o.id.slice(0,8).toUpperCase())}<small>${escape(date(o.created_at))}</small></td><td>${escape(o.customer_name)}<small>${escape(o.customer_email)}</small></td><td>${o.items.reduce((sum,i)=>sum+i.quantity,0)}</td><td>${money(o.total_cents)}</td><td>${badge(o.status)}</td><td><button data-order="${escape(o.id)}">Ver pedido</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty">Nenhum pedido encontrado.</td></tr>';
}
function view(value) {
  activeView=value;
  for (const v of ['overview','products','orders']) $('#view-'+v).hidden=v!==value;
  document.querySelectorAll('nav [data-view]').forEach(b=>{b.classList.toggle('selected',b.dataset.view===value);b.setAttribute('aria-current',b.dataset.view===value?'page':'false');});
  const titles={overview:['Visão geral','Tudo pronto para uma boa aventura.','Um olhar sobre o que acontece na sua loja.'],products:['Produtos','Cada produto, uma nova aventura.','Organize o catálogo, ajuste os preços e cuide do estoque.'],orders:['Pedidos','Acompanhe cada etapa.','Consulte os pedidos e mantenha tudo no caminho certo.']};
  const [crumb,title,subtitle]=titles[value]; $('#breadcrumb').textContent=crumb; $('#page-title').textContent=title; $('#page-subtitle').textContent=subtitle; $('#add-product').hidden=value==='orders';
}
const imageFiles=['teemo-collectible-plush','tibbers-plush','panda-teemo','teemo-figure','jinx-anime-inspired-tee-unisex','winter-wonder-soraka-mousepad','arcane-jinx-ekko-tee','teemo-plush','worlds-2026-poro-plush','high-noon-thresh-mousepad','apex-kda-ahri-figure','bbc-arcane-jinx-tee','lcs-2024-tibbers-plush','kalista-posters','jhin-art-print','kayn-posters','spirit-blossom-ahri-xl-mousepad','gromp-plush','baron-nashor-plush','kda-firestarter-crossbody-bag','battle-academia-keychains-6-pack'];
function preview() { const image=$('#image-preview');image.hidden=!$('#image-select').value;image.src=$('#image-select').value||'/assets/icons/icon.svg'; }
function editProduct(id) {
  const p=products.find(p=>p.id===id),form=$('#product-form');form.reset();
  const values=p?{...p,sizes:p.sizes.join(', '),stock:p.stock??''}:{id:'',name:'',category:'',description:'',price:'',stock:'',sizes:'',imageUrl:'',tag:'',art:''};
  $('#image-select').innerHTML='<option value="">Sem imagem</option>'+imageFiles.map(f=>`<option value="/assets/images/products/${f}.png">${escape(f.replaceAll('-',' '))}</option>`).join('');
  if(p?.imageUrl&&!Array.from($('#image-select').options).some(o=>o.value===p.imageUrl)) { const option=new Option(p.imageUrl,p.imageUrl);$('#image-select').add(option); }
  for(const key of ['id','name','category','description','price','stock','sizes','imageUrl','tag','art']) form.elements.namedItem(key).value=values[key]??'';
  form.elements.active.checked=p?p.active:true;
  $('#product-dialog-title').textContent=p?'Editar produto':'Novo produto';$('#product-error').textContent='';preview();$('#product-dialog').showModal();
}
function showOrder(id) {
  const o=orders.find(o=>o.id===id);if(!o)return;
  const a=o.address;
  $('#order-detail').innerHTML=`<div class="detail-block"><strong>#${escape(o.id.slice(0,8).toUpperCase())}</strong><p>${escape(date(o.created_at))} · ${escape(o.customer_name)}</p><p>${escape(o.customer_email)}</p>${badge(o.status)}</div><h3>Produtos</h3><ul>${o.items.map(i=>`<li>${i.quantity} × ${escape(i.name)}${i.size?' · '+escape(i.size):''}<p>${money(i.unitPriceCents)} por unidade · ${money(i.lineTotalCents)}</p></li>`).join('')}</ul><p>Produtos: ${money(o.subtotal_cents)} · Frete: ${money(o.shipping_cents)}</p><h3>Total: ${money(o.total_cents)}</h3><div class="detail-block"><strong>Endereço informado</strong><p>${escape(a.recipient)} · ${escape(a.phone)}</p><p>${escape(a.street)}, ${escape(a.number)} ${escape(a.complement)}<br>${escape(a.district)} · ${escape(a.city)} / ${escape(a.state)}<br>CEP ${escape(a.postalCode)}</p></div>${(nextStatuses[o.status]||[]).length?`<form id="status-form"><label>Próxima etapa<select name="status">${nextStatuses[o.status].map(s=>`<option value="${s}">${names[s]}</option>`).join('')}</select></label><p class="hint">Cancelar devolve ao estoque as unidades controladas. Pedidos cancelados não podem ser reabertos.</p><p id="status-error" class="error" role="alert"></p><button class="primary" type="submit">Atualizar status</button></form>`:'<p class="hint">Este pedido não possui outras etapas disponíveis.</p>'}`;
  $('#status-form')?.addEventListener('submit',async e=>{
    e.preventDefault();const status=e.target.elements.status.value;
    if(status==='cancelled'&&!confirm('Cancelar este pedido e devolver as unidades controladas ao estoque?'))return;
    const button=e.target.querySelector('button');button.disabled=true;
    try {await api('/orders/'+o.id+'/status','PATCH',{status});$('#order-dialog').close();notify('Status do pedido atualizado.');await load();}
    catch(err){const target=$('#status-error');if(target)target.textContent=err.message;else error(err.message);}
    finally{button.disabled=false;}
  });
  $('#order-dialog').showModal();
}
async function enter() {
  try {
    const session=await api('/session');csrf=session.csrfToken;$('#admin-name').textContent=session.user.name;$('.avatar').textContent=session.user.name.charAt(0).toUpperCase();
    $('#gate').hidden=true;$('#shell').hidden=false;view(activeView);
    try {await load();}catch(err){error(err.message);}
  } catch(err) {
    $('#shell').hidden=true;$('#gate').hidden=false;$('#denied').hidden=err.status!==403;$('#switch-account').hidden=err.status!==403;$('#login-form').hidden=err.status===403;
    if(![401,403].includes(err.status)) $('#login-error').textContent=err.message;
  }
}
$('#login-form').addEventListener('submit',async e=>{
  e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;$('#login-error').textContent='';
  try {const res=await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e.target.elements.email.value,password:e.target.elements.password.value})});const data=await res.json();if(!res.ok)throw new Error(data.error||'Não foi possível entrar.');e.target.reset();await enter();}
  catch(err){$('#login-error').textContent=err.message;}finally{button.disabled=false;}
});
async function logout() { try { const res=await fetch('/api/v1/auth/logout',{method:'POST'});if(!res.ok)throw new Error('Não foi possível sair. Tente novamente.');location.reload(); }catch(err){notify(err.message);} }
$('#logout').addEventListener('click',logout);$('#switch-account').addEventListener('click',logout);
$('#add-product').addEventListener('click',()=>editProduct());$('#image-select').addEventListener('change',preview);
for(const id of ['search','category-filter','status-filter']) $('#'+id).addEventListener('input',renderProducts);
$('#order-filter').addEventListener('change',renderOrders);
document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-view]'),edit=e.target.closest('[data-edit]'),order=e.target.closest('[data-order]'),close=e.target.closest('[data-close]');
  if(nav)view(nav.dataset.view);if(edit)editProduct(Number(edit.dataset.edit));if(order)showOrder(order.dataset.order);if(close)$('#'+close.dataset.close).close();
});
$('#product-form').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.target,f=form.elements,button=form.querySelector('[type="submit"]');button.disabled=true;$('#product-error').textContent='';
  const body={name:f.namedItem('name').value,category:f.category.value,price:Number(f.price.value),description:f.description.value,imageUrl:f.imageUrl.value,stock:f.stock.value===''?null:Number(f.stock.value),sizes:f.sizes.value.split(',').map(s=>s.trim()).filter(Boolean),tag:f.tag.value,art:f.art.value,active:f.active.checked};
  try {await api('/products'+(f.id.value?'/'+f.id.value:''),f.id.value?'PUT':'POST',body);$('#product-dialog').close();notify('Produto salvo. Catálogo atualizado.');await load();}
  catch(err){if($('#product-dialog').open)$('#product-error').textContent=err.message;else error(err.message);}finally{button.disabled=false;}
});
$('#export').addEventListener('click',()=>{
  // Prevent spreadsheet formulas in user-controlled text.
  const cell=value=>'"'+String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
  const rows=[['Código','Produto','Categoria','Preço (BRL)','Estoque','Ativo'],...filteredProducts().map(p=>[p.id,p.name,p.category,p.price.toFixed(2),p.stock??'Ilimitado',p.active?'Sim':'Não'])];
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='bazar-do-teemo-produtos.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
await enter();
