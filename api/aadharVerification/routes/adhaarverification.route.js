const express = require('express');
const aadhaarRouter = express.Router();

const adhaarverificationController = require('../controllers/adhaarverification.controller');
// const checkAccess = require("../../../middleware/permission.middleware");
// aadhaarRouter.post('/sentAadhaarotp', adhaarverificationValidator.sentadhaarotp,adhaarverificationController.sentadhaarotp);
// aadhaarRouter.post('/Aadhaarotpverify', adhaarverificationValidator.adhaarotpverify,adhaarverificationController.adhaarotpverify);
aadhaarRouter.post('/Aadhaarmaskedverify', adhaarverificationController.handleAadhaarMaskedVerify);

aadhaarRouter.post("/initiate",adhaarverificationController.initiateAadhaarDigilocker)
aadhaarRouter.post("/status",adhaarverificationController.checkAadhaarDigilockerStatus)
module.exports = aadhaarRouter;
