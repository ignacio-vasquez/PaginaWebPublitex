const test = require('node:test');
const assert = require('node:assert/strict');
const { withTestDatabase } = require('./database-helper');
const { createRuntime } = require('../server/server');

test('HTTP protege Superadmin, conecta roles y bloquea archivos privados', async () => {
  await withTestDatabase(async ({database}) => {
    const runtime = createRuntime({database,env:{},hashPassword:p=>p,verifyPassword:(p,h)=>p===h});
    await runtime.ready;
    const adminAccount=await runtime.userService.createPrivilegedUser({name:'Admin',email:'admin@example.com',password:'password',role:'superadmin'});
    const bossAccount=await runtime.userService.createPrivilegedUser({name:'Marcelo',email:'boss@example.com',password:'password',role:'jefe'});
    const server = runtime.app.listen(0,'127.0.0.1');
    await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
    const base = `http://127.0.0.1:${server.address().port}`;
    const req = (url,cookie,body) => fetch(base+url,{method:body?'POST':'GET',headers:{...(cookie?{cookie}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    try {
      assert.equal((await req('/api/superadmin')).status,401);
      const register=await req('/api/auth/register',null,{name:'Client',email:'client@example.com',password:'password',role:'superadmin'});
      const ordinary=register.headers.get('set-cookie').split(';')[0];
      const clientAccount=(await register.json()).user;
      assert.equal((await req('/api/superadmin/role',ordinary,{role:'jefe'})).status,403);
      assert.equal((await req('/api/superadmin/act-as',ordinary,{targetUserId:bossAccount.id})).status,403);
      assert.equal((await req('/api/work/quotes',ordinary)).status,403);
      const login=await req('/api/auth/login',null,{email:'admin@example.com',password:'password'});
      const admin=login.headers.get('set-cookie').split(';')[0];
      const adminUser=(await (await req('/api/auth/session',admin)).json()).user;
      const actorsResponse=await req('/api/superadmin/actors',admin);
      assert.equal(actorsResponse.status,200);
      const actors=await actorsResponse.json();
      assert.equal(actors.clients[0].id,adminUser.id);
      assert.equal(actors.staff[0].id,bossAccount.id);
      assert.equal(actors.clients[1].id,clientAccount.id);
      assert.equal((await req('/api/superadmin/act-as',admin,{targetUserId:'missing'})).status,404);
      const clientActing=await req('/api/superadmin/act-as',admin,{targetUserId:clientAccount.id});
      assert.equal(clientActing.status,200);
      const draftResponse=await req('/api/quotes',admin,{});
      assert.equal(draftResponse.status,201);
      const draft=await draftResponse.json();
      assert.equal(draft.events[0].actorId,adminAccount.id);
      assert.equal(draft.events[0].effectiveRole,'cliente');
      assert.equal((await (await req('/api/quotes',ordinary)).json()).some(quote=>quote.id===draft.id),true);
      assert.equal(database.prepare('SELECT user_id FROM quotes WHERE id = ?').get(draft.id).user_id,clientAccount.id);
      assert.equal((await req('/api/superadmin/act-as',admin,{targetUserId:bossAccount.id})).status,200);
      assert.equal((await req('/api/quotes',admin)).status,403);
      const acting=await req('/api/superadmin/act-as',admin,{targetUserId:actors.clients[0].id});
      assert.equal(acting.status,200);
      assert.equal((await acting.json()).user.role,'cliente');
      assert.equal((await req('/api/quotes',admin)).status,200);
      assert.equal((await req('/api/superadmin/role',admin,{role:'jefe'})).status,200);
      const session=await (await req('/api/auth/session',admin)).json();
      assert.equal(session.user.role,'jefe');assert.equal(session.realUser.role,'superadmin');
      assert.equal((await req('/api/work/quotes',admin)).status,200);
      assert.equal((await req('/api/superadmin/role',admin,{role:null})).status,200);
      for (const path of ['/server/server.js','/data/publitex.sqlite','/package.json','/tests/simulation.test.js']) {
        assert.equal((await req(path)).status,404,path);
      }
    } finally { await new Promise(resolve=>server.close(resolve)); }
  });
});
