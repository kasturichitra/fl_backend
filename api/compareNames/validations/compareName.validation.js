const { body } = require('express-validator');


exports.compareNames = [
    body('firstName').notEmpty().withMessage('firstName is required'),
    body('secondName').notEmpty().withMessage('secondName is required')
];

