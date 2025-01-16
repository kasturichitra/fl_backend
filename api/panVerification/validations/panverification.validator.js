const { body } = require('express-validator');

exports.verifyPan = [
  body('panNumber').optional().isNumeric().withMessage('enter pancard'),
];
exports.verifyPanHolderName = [
  body('panNumber').optional().isNumeric().withMessage('enter pancard'),
  body('name').optional().isNumeric().withMessage('enter name'),
];

