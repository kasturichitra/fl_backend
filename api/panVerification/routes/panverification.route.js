const express = require('express');
const panRouter = express.Router();

const panverificationController = require('../controllers/panverification.controller');

panRouter.post('/panverifying', panverificationController.verifyPanNumber);
panRouter.post('/panHolderNameVerify', panverificationController.verifyPanHolderName);
panRouter.post('/panDobVerify', panverificationController.dobverify);
panRouter.post('/panToAadhaar', panverificationController.verifyPanToAadhaar);

module.exports = panRouter;
