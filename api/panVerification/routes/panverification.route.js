const express = require('express');
const panRouter = express.Router();

const panverificationController = require('../controllers/panverification.controller');

panRouter.post('/verify', panverificationController.verifyPanNumber);
panRouter.post('/verify_to_aadhaar', panverificationController.verifyPanToAadhaar);

module.exports = panRouter;
