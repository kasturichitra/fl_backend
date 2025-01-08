const express = require('express');
const nameRouter = express.Router();

const compareNameController = require('../controller/compareNames.controller');
const compareNameValidator = require('../validations/compareName.validation');

nameRouter.post("/compareName",compareNameValidator.compareNames,compareNameController.compareNames)

module.exports = nameRouter;
