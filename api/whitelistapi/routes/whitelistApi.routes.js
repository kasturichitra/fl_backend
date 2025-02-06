const express = require('express');

const {addWhitelistApi} = require('../controllers/whitelistapi.controllers')
const ipRouter = express.Router();

ipRouter.post('/Addipwhitelist',addWhitelistApi)


module.exports = ipRouter;
