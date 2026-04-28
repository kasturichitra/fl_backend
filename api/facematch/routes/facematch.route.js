const express = require('express');
const faceRouter = express.Router();
const multer = require('multer');

const facematchController = require('../controllers/facematch.controller');
const upload = multer({ storage: multer.memoryStorage() });

// faceRouter.post('/facematchapiwithzoop', facematchValidator.facematchapi,facematchController.facematchapi);
// faceRouter.post('/facematchapiwithtruthscreen', facematchController.handleTruthScreenFaceVerification);
// faceRouter.post('/facematchapiinvincible', facematchController.handleFaceComparison);

faceRouter.post("/facematch",upload.fields([
  { name: "userImages", maxCount: 1 },
  { name: "aadhaarImages", maxCount: 1 }
]),facematchController.faceMatchVerification);
// faceRouter.post("/FaceVerification",facematchController.FaceVerification);


module.exports = faceRouter;
