const express = require('express');
const businessRouters = express.Router();

const { dinVerification, gstinverify, handleCINVerification, handleGST_INtoPANDetails, gstInTaxPayerVerification, handleTINVerification, udyamNumberVerfication } = require("../controller/businessServices.Controller");

businessRouters.post("/din/verify", dinVerification);
businessRouters.post('/Gstinverify', gstinverify);
businessRouters.post('/getpanwithgstin', handleGST_INtoPANDetails);
businessRouters.post('/gstIn/TaxPayer/verify', gstInTaxPayerVerification);
businessRouters.post('/Cin/verify', handleCINVerification);
businessRouters.post('/tin/verify', handleTINVerification);
businessRouters.post('/udyam/verify/', udyamNumberVerfication);

module.exports = businessRouters;