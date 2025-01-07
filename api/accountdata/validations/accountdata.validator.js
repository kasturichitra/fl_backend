const { body } = require('express-validator');

exports.verifyBankAccount = [
    body('account_no').notEmpty().withMessage('Account number is required'),
    body('ifsc').notEmpty().withMessage('IFSC code is required')
];
exports.verifyAccount = [
    body('account_no').notEmpty().withMessage('Account number is required'),
    body('ifsc').notEmpty().withMessage('IFSC code is required')
];
