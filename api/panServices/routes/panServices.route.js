const express = require('express');
const panRouter = express.Router();

const panverificationController = require('../controllers/panServices.controller');

panRouter.post('/verify', panverificationController.verifyPanBasic);
panRouter.post('/verify_to_aadhaar', panverificationController.verifyPanToAadhaar);
panRouter.post('/getgst_in/withpan', panverificationController.verifyPanToGstIn);
panRouter.post('/gst/with/pan', panverificationController.verifyPanToGst);
panRouter.post('/panNameMatch', panverificationController.verifyPanNameMatch);
panRouter.post('/panName/DobVerify', panverificationController.verifyPanNameDob);
panRouter.post('/knowDirector', panverificationController.verifyPanToDirector);
panRouter.post('/know/fatherName', panverificationController.verifyPanToFatherName);
panRouter.post('/tan/verify', panverificationController.handlePanTanVerification);
panRouter.post('/know/itdStatus/otp_generate', panverificationController.panItdStatusOtpGeneration);
panRouter.post('/know/itdStatus/otp_validate', panverificationController.panItdStatusOtpVerification);

module.exports = panRouter;
