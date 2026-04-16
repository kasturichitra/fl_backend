const express = require('express');
const panRouter = express.Router();

const panverificationController = require('../controllers/panServices.controller');

panRouter.post('/verify', panverificationController.verifyPanBasic);
panRouter.post('/knowDirector', panverificationController.verifyPanToDirector);
panRouter.post('/getgst_in/withpan', panverificationController.verifyPanToGstIn);
panRouter.post('/tan/verify', panverificationController.handlePanTanVerification);
panRouter.post('/panNameMatch', panverificationController.verifyPanNameMatch);
panRouter.post('/gst/with/pan', panverificationController.verifyPanToGst);
panRouter.post('/panName/DobVerify', panverificationController.verifyPanNameDob);
panRouter.post('/know/fatherName', panverificationController.verifyPanToFatherName);
panRouter.post('/know/itdStatus/otp_generate', panverificationController.panItdStatusOtpGeneration);
panRouter.post('/know/itdStatus/otp_validate', panverificationController.panItdStatusOtpVerification);

panRouter.post('/verify_to_aadhaar', panverificationController.verifyPanToAadhaar);

module.exports = panRouter;
