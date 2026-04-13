const express = require('express');
const { handleDomainVerification, handleAdvanceProfile, handleCourtRecords } = require('../controller/riskController');
const riskRouter = express.Router();

riskRouter.post('/domain/verify', handleDomainVerification);
riskRouter.post('/advance/profile', handleAdvanceProfile);
riskRouter.post('/court/record', handleCourtRecords);

module.exports = riskRouter;
