const { body,validationResult } = require('express-validator');
const emailModel = require('../models/email.model');
// const response = require('../../../response');

exports.storeEmail = [
  body("email").trim().notEmpty().withMessage("is required").isEmail(),
  body("mobileNumber").trim().optional(),
  
];


