const { body } = require('express-validator');

exports.handleCreateShopEstablishment = () => {
    return [
        body('registrationNumber').notEmpty().withMessage('Registration number is required'),
        body('state').notEmpty().withMessage('State is required'),
    ];
};
