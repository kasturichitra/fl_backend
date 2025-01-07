const {body} = require("express-validator")

exports.signUp = [
    // Assuming 'email' and 'password' are required fields in the request body
    body('email').notEmpty().withMessage('Email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('mobileNumber').isNumeric().isLength({ min: 10, max: 10 }).withMessage('Mobile number should be 10 digits'),

  ];