const express = require('express');
const { handleDomainVerification } = require('../controller/riskController');
const riskRouter = express.Router();

riskRouter.post('/domain/verify', handleDomainVerification);

module.exports = riskRouter;
