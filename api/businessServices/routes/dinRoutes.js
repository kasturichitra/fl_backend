const express = require('express');
const businessRouters = express.Router();

const { dinVerification,gstinverify, handleCINVerification, handleGST_INtoPANDetails, gstInTaxPayerVerification } = require("../controller/businessServices.Controller");

businessRouters.post("/verify/din",dinVerification);
businessRouters.post('/Gstinverify',gstinverify);
businessRouters.post('/getpanwithgstin',handleGST_INtoPANDetails);
businessRouters.post('/gstIn/TaxPayer/Verification',gstInTaxPayerVerification);
businessRouters.post('/CinNumberverify',handleCINVerification);

module.exports = businessRouters;