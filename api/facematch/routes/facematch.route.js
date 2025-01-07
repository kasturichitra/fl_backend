const express = require('express');
const faceRouter = express.Router();

const facematchController = require('../controllers/facematch.controller');
const facematchValidator = require('../validations/facematch.validator');

faceRouter.post('/facematchapi', facematchValidator.facematchapi,facematchController.facematchapi);


module.exports = faceRouter;
