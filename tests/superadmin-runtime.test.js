const test = require('node:test');
const assert = require('node:assert/strict');
const { withTestDatabase } = require('./database-helper');
const { createRuntime } = require('../server/server');
const { invoiceFile } = require('./invoice-fixture');

test('runtime conecta simulación y flujo completo conservando la identidad real', async () => {
  await withTestDatabase(async ({ database }) => {
    const runtime = createRuntime({database, env: {}, hashPassword: p => p, verifyPassword: (p,h) => p === h});
    await runtime.ready;
    const admin = await runtime.userService.createPrivilegedUser({name:'Admin',email:'admin@example.com',password:'password',role:'superadmin'});
    const login = await runtime.authService.login({email:admin.email,password:'password'});
    assert.ok(runtime.simulationService);
    assert.ok(runtime.workflowService);
    const client = await runtime.simulationService.setRole(login.token,'cliente');
    assert.equal((await runtime.authService.getSessionContext(login.token)).user.id,admin.id);
    let quote = await runtime.quoteService.createDraft(client.user.id, { effectiveRole: 'cliente', actorId: admin.id });
    await runtime.quoteService.addItem(quote.id,client.user.id,{productId:'sign-rect',materialId:'acrylic',sizeId:'100x50',quantityId:'sign-rect-qty-2',extraIds:[]});
    await runtime.quoteService.saveDetails(quote.id,client.user.id,{phone:'+56 9 1234 5678',company:'Demo'});
    await runtime.quoteService.submit(quote.id,client.user.id, { effectiveRole: 'cliente', actorId: admin.id });
    const boss = await runtime.simulationService.setRole(login.token,'jefe');
    await runtime.workflowService.transition(quote.id,boss,{status:'in_review'});
    await runtime.workflowService.transition(quote.id,boss,{status:'accepted'});
    await runtime.workflowService.attachInvoice(quote.id,boss,invoiceFile('1'));
    const worker = await runtime.simulationService.setRole(login.token,'trabajador');
    assert.equal((await runtime.workflowService.list(worker)).length, 1);
    await runtime.workflowService.transition(quote.id,worker,{status:'ready'});
    const bossAgain = await runtime.simulationService.setRole(login.token,'jefe');
    await runtime.workflowService.transition(quote.id,bossAgain,{status:'delivered'});
    quote = await runtime.quoteService.get(quote.id,client.user.id);
    assert.equal(quote.status,'delivered');
    assert.deepEqual(quote.events.slice(-5).map(e => e.effectiveRole),['jefe','jefe','jefe','trabajador','jefe']);
    assert.ok(quote.events.slice(-5).every(e => e.actorId === admin.id));
    assert.equal((await runtime.simulationService.setRole(login.token,null)).user.id,admin.id);
  });
});

test('superadmin comparte sus cotizaciones al alternar roles y registra la identidad real', async () => {
  await withTestDatabase(async ({database}) => {
    const runtime = createRuntime({database,env:{},hashPassword:p=>p,verifyPassword:(p,h)=>p===h});
    await runtime.ready;
    const admin=await runtime.userService.createPrivilegedUser({name:'Admin',email:'a@example.com',password:'password',role:'superadmin'});
    const login=await runtime.authService.login({email:admin.email,password:'password'});
    const client=await runtime.simulationService.setRole(login.token,'cliente');
    const q=await runtime.quoteService.createDraft(client.user.id, { effectiveRole: 'cliente', actorId: admin.id });
    assert.equal(q.events[0].status,'draft');
    assert.equal(q.events[0].actorId,admin.id);
    assert.equal(q.events[0].effectiveRole,'cliente');
    await runtime.quoteService.addItem(q.id,client.user.id,{productId:'sign-rect',materialId:'acrylic',sizeId:'100x50',quantityId:'sign-rect-qty-2',extraIds:[]});
    await runtime.quoteService.saveDetails(q.id,client.user.id,{phone:'+56 9 1234 5678',company:'Demo'});
    const sent=await runtime.quoteService.submit(q.id,client.user.id, { effectiveRole: 'cliente', actorId: admin.id });
    assert.deepEqual(sent.events.map(e=>e.status),['draft','submitted']);
    assert.deepEqual(sent.events.map(e=>e.effectiveRole),['cliente','cliente']);
    const boss=await runtime.simulationService.setRole(login.token,'jefe');
    assert.deepEqual((await runtime.workflowService.list(boss)).map(quote=>quote.id),[q.id]);
    const real=await runtime.simulationService.setRole(login.token,null);
    assert.deepEqual((await runtime.workflowService.list(real)).map(quote=>quote.id),[q.id]);
  });
});

test('elige personas reales sin abrir sus sesiones y conserva el actor superadmin', async () => {
  await withTestDatabase(async ({ database }) => {
    const runtime = createRuntime({ database, env: {}, hashPassword: p => p, verifyPassword: (p, h) => p === h });
    await runtime.ready;
    const admin = await runtime.userService.createPrivilegedUser({ name: 'Ignacio', email: 'admin@example.com', password: 'password', role: 'superadmin' });
    const boss = await runtime.userService.createPrivilegedUser({ name: 'Marcelo', email: 'boss@example.com', password: 'password', role: 'jefe' });
    const worker = await runtime.userService.createPrivilegedUser({ name: 'Marcos', email: 'worker@example.com', password: 'password', role: 'trabajador' });
    const client = await runtime.userService.registerClient({ name: 'Ana', email: 'client@example.com', password: 'password' });
    const login = await runtime.authService.login({ email: admin.email, password: 'password' });
    const people = await runtime.simulationService.actors(login.token);
    assert.deepEqual(people.staff.map(person => person.id), [boss.id, worker.id]);
    assert.deepEqual(people.clients.map(person => person.id), [admin.id, client.id]);
    await assert.rejects(runtime.simulationService.actAs(login.token, 'unknown'), { status: 404 });
    const actingClient = await runtime.simulationService.actAs(login.token, client.id);
    assert.equal(actingClient.user.id, client.id);
    assert.equal(actingClient.realUser.id, admin.id);
    assert.equal((await runtime.authService.getSessionUser(login.token)).id, admin.id);
    const quote = await runtime.quoteService.createDraft(actingClient.user.id, { actorId: admin.id, effectiveRole: 'cliente' });
    assert.equal(quote.events[0].actorId, admin.id);
    assert.equal(database.prepare('SELECT user_id FROM quotes WHERE id = ?').get(quote.id).user_id, client.id);
    const actingBoss = await runtime.simulationService.actAs(login.token, boss.id);
    assert.equal(actingBoss.user.id, boss.id);
    const actingWorker = await runtime.simulationService.actAs(login.token, worker.id);
    assert.equal(actingWorker.user.id, worker.id);
    assert.equal(database.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 1);
  });
});
