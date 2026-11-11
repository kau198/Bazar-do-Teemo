import test from 'node:test';
import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import express from 'express';
import session from 'express-session';
import { up as adminSchema } from '../backend/database/migrations/003_admin.js';
import { up as orderSchema } from '../backend/database/migrations/002_orders.js';
import { createAdminService, validateProduct } from '../backend/src/services/adminService.js';
import { createOrderService } from '../backend/src/services/orderService.js';
import adminRoutes from '../backend/src/routes/admin.js';
import { errorHandler } from '../backend/src/middlewares/errorHandler.js';

const product = () => ({name:'Pelúcia Teemo',category:'Pelúcias',description:'Um explorador.',price:159.90,stock:5,active:true,imageUrl:'/assets/images/products/teemo-plush.png',sizes:[],tag:'Novo',art:''});
async function setup() {
  const { Pool } = newDb().adapters.createPg();const pool = new Pool();
  await pool.query(`CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,email TEXT,updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE products(id INTEGER PRIMARY KEY,name TEXT,category TEXT,description TEXT,price NUMERIC(10,2),currency TEXT DEFAULT 'BRL',image_url TEXT,source_url TEXT,sizes TEXT[],tag TEXT,art TEXT,updated_at TIMESTAMPTZ DEFAULT NOW());`);
  await orderSchema(pool);await adminSchema(pool);
  await pool.query("INSERT INTO users(id,name,email,role) VALUES (1,'Admin','admin@example.invalid','admin'),(2,'Cliente','cliente@example.invalid','customer')");
  return pool;
}
const input = () => ({items:[{productId:1000000,quantity:2,size:''}],address:{recipient:'Explorador Teste',phone:'11999999999',postalCode:'01001000',street:'Rua de Teste',number:'10',complement:'',district:'Centro',city:'São Paulo',state:'SP'},expectedTotalCents:31980});

test('produto rejeita preço, estoque, imagem e visibilidade inválidos',()=>{
  for(const change of [p=>p.price=-1,p=>p.price=1.001,p=>p.price='1.99',p=>p.stock=-1,p=>p.stock=1.5,p=>p.active='true',p=>p.name='',p=>p.imageUrl='javascript:alert(1)',p=>p.imageUrl='//evil.invalid/img',p=>p.sizes=['']]) {
    const p=product();change(p);assert.throws(()=>validateProduct(p),err=>err.status===400);
  }
  assert.equal(validateProduct({...product(),stock:null}).stock,null);
});

test('cadastro, edição de preço e ocultação persistem no banco',async()=>{
  const pool=await setup();const admin=createAdminService(pool);
  try {
    const saved=await admin.save(null,product());assert.equal(saved.id,1000000);
    await admin.save(saved.id,{...product(),price:99.90,active:false,stock:0});
    const [p]=await admin.products();assert.equal(p.price,99.90);assert.equal(p.active,false);assert.equal(p.stock,0);
    await assert.rejects(admin.save(42,product()),err=>err.status===404);
    const s=await admin.summary();assert.equal(s.products,1);assert.equal(s.active,0);
  }finally{await pool.end();}
});

test('estoque baixa uma vez, cancelamento repõe uma vez e impede reabertura',async()=>{
  const pool=await setup();const admin=createAdminService(pool),checkout=createOrderService(pool);
  try{
    await admin.save(null,product());
    const first=await checkout.create(2,input(),'admin-test-order-0001');
    const repeated=await checkout.create(2,input(),'admin-test-order-0001');assert.equal(first.id,repeated.id);
    assert.equal((await admin.products())[0].stock,3);
    await admin.status(first.id,'preparing');await admin.status(first.id,'cancelled');await admin.status(first.id,'cancelled');
    assert.equal((await admin.products())[0].stock,5);
    await assert.rejects(admin.status(first.id,'preparing'),err=>err.status===409);
    assert.equal((await admin.summary()).revenueCents,0);
    assert.equal((await admin.orders())[0].customer_name,'Cliente');
  }finally{await pool.end();}
});

test('checkout rejeita estoque somado entre tamanhos, produto oculto e total antigo',async()=>{
  const pool=await setup();const admin=createAdminService(pool),checkout=createOrderService(pool);
  try {
    await admin.save(null,{...product(),stock:1});
    await assert.rejects(checkout.quote(input()),err=>err.status===409);
    await admin.save(1000000,{...product(),stock:3,sizes:['P','M']});
    await assert.rejects(checkout.quote({...input(),items:[{productId:1000000,quantity:2,size:'P'},{productId:1000000,quantity:2,size:'M'}]}),err=>err.status===409);
    await admin.save(1000000,{...product(),active:false});
    await assert.rejects(checkout.quote(input()),err=>err.status===400);
    await admin.save(1000000,{...product(),price:200});
    await assert.rejects(checkout.create(2,input(),'admin-test-order-0002'),err=>err.status===409);
    assert.equal((await admin.products())[0].stock,5);
  }finally{await pool.end();}
});

test('API bloqueia visitante, cliente, CSRF e revogação de administrador',async()=>{
  const pool=await setup();const app=express();app.use(express.json());
  app.use(session({secret:'isolated-test-session-secret',resave:false,saveUninitialized:false}));
  // Test-only session establishment; this endpoint is never included in the app.
  app.post('/test-login/:id',(req,res)=>{req.session.userId=Number(req.params.id);res.json({ok:true});});
  app.use('/admin',adminRoutes(pool));app.use(errorHandler);
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base='http://127.0.0.1:'+server.address().port;
  try {
    assert.equal((await fetch(base+'/admin/products')).status,401);
    let login=await fetch(base+'/test-login/2',{method:'POST'});const customerCookie=login.headers.get('set-cookie').split(';')[0];
    for(const path of ['/session','/products','/orders','/summary']) assert.equal((await fetch(base+'/admin'+path,{headers:{Cookie:customerCookie}})).status,403);
    login=await fetch(base+'/test-login/1',{method:'POST'});const cookie=login.headers.get('set-cookie').split(';')[0];
    const sessionRes=await fetch(base+'/admin/session',{headers:{Cookie:cookie}});assert.equal(sessionRes.headers.get('cache-control'),'no-store');const {csrfToken}=await sessionRes.json();
    let response=await fetch(base+'/admin/products',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(product())});assert.equal(response.status,403);
    response=await fetch(base+'/admin/products',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify(product())});assert.equal(response.status,201);
    await pool.query("UPDATE users SET role='customer' WHERE id=1");
    assert.equal((await fetch(base+'/admin/products',{headers:{Cookie:cookie}})).status,403);
  } finally {server.closeAllConnections();await new Promise(r=>server.close(r));await pool.end();}
});
