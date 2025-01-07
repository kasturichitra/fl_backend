const { body,validationResult } = require('express-validator');
const gstin_verifyModel = require('../models/gstin_verify.model');

exports.gstinverify = [

  body('gstinNumber').optional().isNumeric().withMessage('enter gstinNumber'),
 // body('firstname').optional().isNumeric().withMessage('enter firstname'),

];

