const express = require('express');
const aadhaarRouter = express.Router();

const adhaarverificationController = require('../controllers/adhaarverification.controller');
const adhaarverificationValidator = require('../validations/adhaarverification.validator');

aadhaarRouter.post('/Aadhaarmaskedverify', adhaarverificationController.handleAadhaarMaskedVerify);

aadhaarRouter.post("/initiate",adhaarverificationController.initiateAadhaarDigilocker)
aadhaarRouter.post("/status",adhaarverificationController.checkAadhaarDigilockerStatus)
module.exports = aadhaarRouter;
