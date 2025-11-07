const { body } = require('express-validator');

exports.sentadhaarotp = [
  body('aadharNumber').optional().isNumeric().withMessage('enter aadharNumber'),
];
exports.adhaarotpverify = [
  body('aadharNumber').optional().isNumeric().withMessage('enter aadharNumber'),
  body('client_id').exists().withMessage('client_id is required'),
  body('otp').exists().withMessage('OTP is required')
];


