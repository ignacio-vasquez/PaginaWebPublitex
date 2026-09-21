const express = require('express');
const { getSessionToken } = require('../auth/auth-routes');
function createSimulationRouter({ simulationService }) {
  const router = express.Router();
  router.get('/', async (request,response,next) => {
    try {
      const context = await simulationService.getContext(getSessionToken(request));
      if (!context.realUser) return response.status(401).json({error:'Debes iniciar sesión.'});
      if (context.realUser.role !== 'superadmin') return response.status(403).json({error:'Solo superadmin puede simular un rol.'});
      return response.json(context);
    } catch (error) { return next(error); }
  });
  router.get('/actors', async (request,response,next) => {
    try { return response.json(await simulationService.actors(getSessionToken(request))); }
    catch (error) {
      if ([401,403].includes(error.status)) return response.status(error.status).json({error:error.message});
      return next(error);
    }
  });
  router.post('/act-as', async (request,response,next) => {
    try { return response.json(await simulationService.actAs(getSessionToken(request),request.body?.targetUserId)); }
    catch (error) {
      if ([400,401,403,404].includes(error.status)) return response.status(error.status).json({error:error.message});
      return next(error);
    }
  });
  router.post('/role', async (request,response,next) => {
    try {
      return response.json(await simulationService.setRole(getSessionToken(request),request.body?.role));
    } catch (error) {
      if ([400,401,403].includes(error.status)) return response.status(error.status).json({error:error.message});
      return next(error);
    }
  });
  return router;
}
module.exports = { createSimulationRouter };
