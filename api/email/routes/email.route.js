const express = require('express');
const Emailroutes = express.Router();

const emailController = require('../controllers/email.controller');
const emailValidator = require('../validations/email.validator');

Emailroutes.post('/storeEmail', emailValidator.storeEmail,emailController.storeEmail);


module.exports = Emailroutes;
