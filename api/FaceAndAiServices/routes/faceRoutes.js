const express = require("express");
const multer = require("multer");
const { verifyImageBlurriness } = require("../controllers/FaceController");

const faceAndAiRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

faceAndAiRouter.post("/blur_Check", upload.single("file"), verifyImageBlurriness);
faceAndAiRouter.post("/blur-check", upload.single("file"), verifyImageBlurriness);
faceAndAiRouter.post("/blur-check", upload.single("file"), verifyImageBlurriness);
faceAndAiRouter.post("/blur-check", upload.single("file"), verifyImageBlurriness);

module.exports = faceAndAiRouter;