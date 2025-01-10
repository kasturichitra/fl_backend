const express = require('express');
const router = express.Router();

const emailController = require('../controllers/email.controller');
const emailValidator = require('../validations/email.validator');

router.post('/storeEmail', emailValidator.storeEmail,emailController.storeEmail);


module.exports = router;
