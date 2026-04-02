const express = require("express");
const multer = require("multer");
const { verifyImageBlurriness, verifyAiImage, verifyDeepfakeImage, verifyAiAndDeepfakeImage } = require("../controllers/FaceController");

const faceAndAiRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

faceAndAiRouter.post("/blur_Check", upload.single("file"), verifyImageBlurriness);
faceAndAiRouter.post("/ai_image_check", upload.single("file"), verifyAiImage);
faceAndAiRouter.post("/deepfake_check", upload.single("file"), verifyDeepfakeImage);
faceAndAiRouter.post("/ai_deepfake_check", upload.single("file"), verifyAiAndDeepfakeImage);

module.exports = faceAndAiRouter;