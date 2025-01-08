const express = require('express');
const verifyNameRouter = express.Router();

const verifyNameController = require('../controllers/verifyName.controller');
const verifyNameValidator = require('../validations/verifyName.validator');

verifyNameRouter.post("/verifyholdername",verifyNameValidator.verifyName,verifyNameController.verifyholdername)

module.exports = verifyNameRouter;
