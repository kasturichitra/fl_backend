const express = require('express');
const { FetchUserDetails, updatedMerchantDetails } = require('../controller/merchant.controller');
const merchatRoutes = express.Router();

merchatRoutes.get('/get/tokenbased/merchantdetails',FetchUserDetails);
merchatRoutes.post('/update/merchantdetails',updatedMerchantDetails)

module.exports = merchatRoutes

