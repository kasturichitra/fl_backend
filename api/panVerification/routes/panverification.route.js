const express = require('express');
const panRouter = express.Router();

const panverificationController = require('../controllers/panverification.controller');
const panverificationValidator = require("../validations/panverification.validator")

panRouter.post('/panverifying', panverificationValidator.verifyPan , panverificationController.verifyPan);

module.exports = panRouter;
