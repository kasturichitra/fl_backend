const { body,validationResult } = require('express-validator');
const panverificationModel = require('../models/panverification.model');

exports.verifyPan = [

  body('panNumber').optional().isNumeric().withMessage('enter pancard'),

];
exports.verifyPanHolderName = [

  body('panNumber').optional().isNumeric().withMessage('enter pancard'),
  body('name').optional().isNumeric().withMessage('enter name'),

];

