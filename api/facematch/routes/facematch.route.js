const express = require('express');
const faceRouter = express.Router();

const facematchController = require('../controllers/facematch.controller');

// faceRouter.post('/facematchapiwithzoop', facematchValidator.facematchapi,facematchController.facematchapi);
// faceRouter.post('/facematchapiwithtruthscreen', facematchController.handleTruthScreenFaceVerification);
// faceRouter.post('/facematchapiinvincible', facematchController.handleFaceComparison);

faceRouter.post("/facematch",facematchController.faceMatchVerification);
// faceRouter.post("/FaceVerification",facematchController.FaceVerification);


module.exports = faceRouter;
