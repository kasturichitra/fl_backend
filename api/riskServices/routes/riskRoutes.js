const express = require('express');
const { handleDomainVerification, handleAdvanceProfile } = require('../controller/riskController');
const riskRouter = express.Router();

riskRouter.post('/domain/verify', handleDomainVerification);
riskRouter.post('/advance/profile', handleAdvanceProfile);

module.exports = riskRouter;
