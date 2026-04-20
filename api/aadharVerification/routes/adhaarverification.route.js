const express = require('express');
const aadhaarRouter = express.Router();

const adhaarverificationController = require('../controllers/adhaarverification.controller');
// const checkAccess = require("../../../middleware/permission.middleware");
// aadhaarRouter.post('/sentAadhaarotp', adhaarverificationValidator.sentadhaarotp,adhaarverificationController.sentadhaarotp);
// aadhaarRouter.post('/Aadhaarotpverify', adhaarverificationValidator.adhaarotpverify,adhaarverificationController.adhaarotpverify);
aadhaarRouter.post('/pan/maskedverify', adhaarverificationController.handleAadhaarMaskedVerify);
aadhaarRouter.post('/digilocker/verify', adhaarverificationController.handleDigilockerAccountVerify);
aadhaarRouter.post("/initiate",adhaarverificationController.initiateAadhaarDigilocker);
aadhaarRouter.post("/status",adhaarverificationController.checkAadhaarDigilockerStatus);
aadhaarRouter.post("/upload", adhaarverificationController.handleE_AadhaarUpload)
aadhaarRouter.post("/sign/verify", adhaarverificationController.handleAadhaarBasedSign)

module.exports = aadhaarRouter;
