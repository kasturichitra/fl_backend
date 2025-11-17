const express = require('express');
const nameRouter = express.Router();

const compareNameController = require('../controller/compareNames.controller');

nameRouter.post("/compareName",compareNameController.compareNames)

module.exports = nameRouter;
