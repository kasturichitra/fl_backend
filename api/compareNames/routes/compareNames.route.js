const express = require('express');
const nameRouter = express.Router();

const compareNameController = require('../controller/compareNames.controller');

nameRouter.post("/compareNames",compareNameController.compareNames)
nameRouter.post("/Verify",compareNameController.compareNamesWithServices);
nameRouter.post("/FSSAI/Verify",compareNameController.FSSAIVerification);

module.exports = nameRouter;
