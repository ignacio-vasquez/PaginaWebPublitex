const test = require('node:test');
const assert = require('node:assert/strict');
const {withTestDatabase} = require('./database-helper');
const {createRuntime} = require('../server/server');

test('jefe y superadmin crean clientes sin abrir sesión y asignan trabajadores sin elevar otros roles', async () => {
 await withTestDatabase(async ({database}) => {
  const runtime=createRuntime({database,env:{},hashPassword:p=>p,verifyPassword:(p,h)=>p===h});await runtime.ready;
  const admin=await runtime.userService.createPrivilegedUser({name:'Admin',email:'admin@example.com',password:'password',role:'superadmin'});
  const boss=await runtime.userService.createPrivilegedUser({name:'Jefe',email:'boss@example.com',password:'password',role:'jefe'});
  const manager={user:boss,realUser:boss,simulation:null};
  const service=runtime.userManagementService;
  assert.ok(service);
  const client=await service.createClient(manager,{name:'Ana',email:'ana@example.com',password:'password',role:'superadmin'});
  assert.equal(client.role,'cliente');assert.equal(client.passwordHash,undefined);
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);
  assert.deepEqual(await service.list(manager),[client]);
  await assert.rejects(service.promote(manager,admin.id,{role:'trabajador'}),{status:403});
  await assert.rejects(service.promote(manager,client.id,{role:'jefe'}),{status:400});
  const login=await runtime.authService.login({email:client.email,password:'password'});
  assert.equal((await service.promote(manager,client.id,{role:'trabajador'})).role,'trabajador');
  assert.equal(await runtime.authService.getSessionUser(login.token),null);
  assert.equal((await runtime.authService.login({email:client.email,password:'password'})).user.role,'trabajador');
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM user_role_events').get().n,1);
  await assert.rejects(service.promote(manager,client.id,{role:'trabajador'}),{status:409});
  await assert.rejects(service.list({user:client,realUser:client}),{status:403});
  await assert.rejects(service.createClient({user:client,realUser:client},{name:'Bad',email:'bad@example.com',password:'password'}),{status:403});
 });
});

test('directorio excluye demos y simulaciones no administran usuarios reales',async()=>{
 await withTestDatabase(async({database})=>{
  const runtime=createRuntime({database,env:{},hashPassword:p=>p,verifyPassword:(p,h)=>p===h});await runtime.ready;
  const admin=await runtime.userService.createPrivilegedUser({name:'Admin',email:'admin@example.com',password:'password',role:'superadmin'});
  const login=await runtime.authService.login({email:admin.email,password:'password'});
  const simulated=await runtime.simulationService.setRole(login.token,'jefe');
  await assert.rejects(runtime.userManagementService.list(simulated),{status:403});
  const real=await runtime.simulationService.setRole(login.token,null);
  assert.deepEqual(await runtime.userManagementService.list(real),[]);
 });
});
