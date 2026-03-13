const express = require('express');
const gst_in_Router = express.Router();

const gstin_verifyController = require('../controllers/gstin_verify.controller');
const CINVerificationController=require("../controllers/IncorporationCertificatController")
 
gst_in_Router.post('/Gstinverify',gstin_verifyController.gstinverify);
gst_in_Router.post('/CinNumberverify',CINVerificationController.handleCINVerification);
gst_in_Router.post('/getpanwithgstin',gstin_verifyController.handleGST_INtoPANDetails);
module.exports = gst_in_Router;
