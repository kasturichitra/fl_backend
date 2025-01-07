const { body,validationResult } = require('express-validator');
const adhaarverificationModel = require('../models/adhaarverification.model');
// const response = require('../../../response');

// exports.Aadhaarotp = [

//   body('aadharNumber').optional().isNumeric().withMessage('enter aadharNumber'),
//  // body('fullName').optional().isNumeric().withMessage('enter fullName'),

// ];


// exports.verifyAadhaarOTP = [
//   body('token').notEmpty().withMessage('Token is required'),
//   body('aadharNumber').notEmpty().withMessage('Aadhaar number is required'),
//   body('request_id').notEmpty().withMessage('Request ID is required'),
//   body('response').notEmpty().withMessage('Response is required')
// ];
exports.sentadhaarotp = [

  body('aadharNumber').optional().isNumeric().withMessage('enter aadharNumber'),
 // body('token').notEmpty().withMessage('Token is required'),

];
exports.adhaarotpverify = [
  body('aadharNumber').optional().isNumeric().withMessage('enter aadharNumber'),

  body('client_id').exists().withMessage('client_id is required'),
  body('otp').exists().withMessage('OTP is required')
];


