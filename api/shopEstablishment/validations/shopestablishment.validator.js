const { body } = require('express-validator');
const shopestablishmentModel = require('../models/shopestablishment.model');
const jwt = require("jsonwebtoken");
const { JWTSECRET } = process.env;

exports.handleCreateShopEstablishment = () => {
    return [
        body('registrationNumber').notEmpty().withMessage('Registration number is required'),
        body('response').isObject().withMessage('Response must be an object'),
        body('state').notEmpty().withMessage('State is required'),
        body('category').notEmpty().withMessage('Category is required')
    ];
};
