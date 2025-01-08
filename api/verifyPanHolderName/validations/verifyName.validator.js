const { body } = require('express-validator');

exports.verifyName = [
    body('account_no').notEmpty().withMessage('Account number is required'),
    body('ifsc').notEmpty().withMessage('IFSC code is required'),
    body('accountHolderName').notEmpty().withMessage('accountHolderName is required')
];
