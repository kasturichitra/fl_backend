const express = require("express");
const multer = require("multer");
const { verifyImageBlurriness } = require("../controllers/FaceController");

const faceRouter = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

faceRouter.post("/blur-check", upload.single("file"), verifyImageBlurriness);

module.exports = faceRouter;