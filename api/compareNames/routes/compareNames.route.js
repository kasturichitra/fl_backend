const express = require('express');
const nameRouter = express.Router();

const compareNameController = require('../controller/compareNames.controller');

nameRouter.post("/compareNames",compareNameController.compareNames)

module.exports = nameRouter;
