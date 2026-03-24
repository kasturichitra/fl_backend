const express = require('express');
const panRouter = express.Router();

const panverificationController = require('../controllers/panServices.controller');

panRouter.post('/verify', panverificationController.verifyPanNumber);
panRouter.post('/verify_to_aadhaar', panverificationController.verifyPanToAadhaar);
panRouter.post('/getgstwithpan', panverificationController.verifyPantoGst_InNumber);
panRouter.post('/panNameMatch', panverificationController.verifyPanNameMatch);
panRouter.post('/panName/DobVerify', panverificationController.verifyPanNameDob);
panRouter.post('/knowDirector', panverificationController.panDirector);
panRouter.post('/know/fatherName', panverificationController.panToFatherName);
panRouter.post('/tan/verify', panverificationController.handlePanTanVerification);
panRouter.post('/know/itdStatus/otp_generate', panverificationController.panItdStatusOtpGeneration);
panRouter.post('/know/itdStatus/otp_validate', panverificationController.panItdStatusOtpVerification);

module.exports = panRouter;
