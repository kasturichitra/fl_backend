const express = require('express');
const gstRouter = express.Router();

const gstin_verifyController = require('../controllers/gstin_verify.controller');
const CINVerificationController=require("../controllers/IncorporationCertificatController")
 
gstRouter.post('/Gstinverify',gstin_verifyController.gstinverify);
gstRouter.post('/CinNumberverify',CINVerificationController.handleCINVerification);
gstRouter.post('/getpanwithgstin',gstin_verifyController.handleGST_INtoPANDetails);
module.exports = gstRouter;
