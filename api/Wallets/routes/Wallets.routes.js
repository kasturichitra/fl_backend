const express = require('express');
const WalletRoutes = express.Router()

const {HandileGetWallet} = require('../controllers/wallets.Controllers')

WalletRoutes.route('/MerchantWallet').get(HandileGetWallet)

module.exports = WalletRoutes;