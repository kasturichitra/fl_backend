const express = require('express');
const gstRouter = express.Router();

const gstin_verifyController = require('../controllers/gstin_verify.controller');
const gstin_verifyValidator = require('../validations/gstin_verify.validator');
const CINVerificationController=require("../controllers/IncorporationCertificatController")
 
gstRouter.post('/Gstinverify',gstin_verifyController.gstinverify);
gstRouter.post('/verify/CinNumberverify',CINVerificationController.handleCINVerification);
module.exports = gstRouter;
