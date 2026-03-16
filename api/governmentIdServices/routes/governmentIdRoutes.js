const express = require('express');
const governmentIdRouter = express.Router();

const { handleVoterIdVerify, handlePassportVerify } = require('../controllers/governmentIdController');

governmentIdRouter.post('/voterId/verify', handleVoterIdVerify);
governmentIdRouter.post('/passport/verify', handlePassportVerify);

module.exports = governmentIdRouter;
