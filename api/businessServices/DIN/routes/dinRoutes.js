const express = require('express');
const dinRouter = express.Router();

const { dinVerification } = require("../controller/dinVerification");

dinRouter.post("/verify/din",dinVerification);

module.exports = dinRouter;