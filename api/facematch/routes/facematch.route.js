const express = require('express');
const faceRouter = express.Router();

const facematchController = require('../controllers/facematch.controller');
const facematchValidator = require('../validations/facematch.validator');

faceRouter.post('/facematchapiwithzoop', facematchValidator.facematchapi,facematchController.facematchapi);
faceRouter.post('/facematchapiwithtruthscreen', facematchController.handleTruthScreenFaceVerification);
faceRouter.post('/facematchapiinvincible', facematchController.handleFaceComparison);


module.exports = faceRouter;
