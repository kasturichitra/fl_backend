const { body,validationResult } = require('express-validator');

exports.facematchapi = [
  body('adhaarimage').exists().withMessage('Aadhaar face data is required'),
  body('userimage').exists().withMessage('User face data is required'),
  
];

