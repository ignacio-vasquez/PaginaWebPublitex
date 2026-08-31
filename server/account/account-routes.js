const express = require('express');
const { requireUser } = require('../auth/authorization');

function createAccountRouter({ authService } = {}) {
  if (!authService) throw new TypeError('authService es obligatorio.');
  const router = express.Router();
  router.get('/profile', requireUser(authService), (request, response) => {
    response.status(200).json({ user: request.user });
  });
  return router;
}

module.exports = { createAccountRouter };
