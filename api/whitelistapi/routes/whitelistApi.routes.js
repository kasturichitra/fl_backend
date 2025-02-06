const express = require('express');

const {addWhitelistApi,GetWhitelistApi} = require('../controllers/whitelistapi.controllers')
const ipRouter = express.Router();
ipRouter.route('/Addipwhitelist').get(GetWhitelistApi).post(addWhitelistApi)
module.exports = ipRouter;
