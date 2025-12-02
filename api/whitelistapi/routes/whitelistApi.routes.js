const express = require('express');

const {addWhitelistApi,GetWhitelistApi, DeleteWhitelistApi} = require('../controllers/whitelistapi.controllers')
const ipRouter = express.Router();

// ipRouter.route('/Addipwhitelist').get(GetWhitelistApi).post(addWhitelistApi).delete(DeleteWhitelistApi)

ipRouter.get('/Getipwhitelist/:MerchatId',GetWhitelistApi);
ipRouter.post('/WhiteListIP',addWhitelistApi);
ipRouter.post('/Delete/IPWhitesList',DeleteWhitelistApi);

module.exports = ipRouter;
        