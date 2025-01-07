const { body,validationResult } = require('express-validator');
const authModel = require('../models/auth.model');
const response = require('../../../response');

exports.signup = [

  body("fullname").trim().notEmpty().withMessage('required').isLength({ min: 2 }).withMessage('must be at least 2 letters'),
  body("password")
  .trim()
  .notEmpty().withMessage('Required')
  .isLength({ min: 6 }).withMessage('must be at least 6 characters long')
  .custom((value, { req }) => {
    // if (value.length > 10) {
    //   throw new Error('must not exceed 10 characters');
    // }
    const re = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])");
    if (re.test(value)) {
      return true;
    } else {
      return Promise.reject('must contain 1 upper case, 1 lower case, 1 special character, and 1 number');
    }
  }),

    
  body("email")
  .trim()
  .isEmail().withMessage('is invalid')
  .isLength({ max: 64 }).withMessage('must not exceed 64 characters')
  .custom(value => {
    return authModel.findOne({ email: value }).then(user => {
      if (user) {
        return Promise.reject('already exists');
      }
    });
  }),

  
    async (req, res, next) =>
    {
      const errors = validationResult(req);
      if (!errors.isEmpty()) 
      {
        var error_message = "";
        errors.array().forEach(function (errorsList) {
          error_message +=  errorsList.param+" " + errorsList.msg + ", ";
        });
        error_message = error_message.replace(/,\s*$/, "");
        data = {
          message: error_message,
        };
        response.validation_error_message(data, res);

      }else{
        next();
      }
    }
];

exports.login = [

body("email").trim().notEmpty().withMessage('required').isEmail().withMessage('is invalid'),

body("password")
  .trim()
  .notEmpty().withMessage('required'),
  // .isLength({ min: 6 }).withMessage('must be at least 6 characters long'),
  // .isLength({ max: 10 }).withMessage('must not exceed 10 characters'),
async (req, res, next) =>
{
    const errors = validationResult(req);
    if (!errors.isEmpty()) 
    {
      var error_message = "";
      errors.array().forEach(function (errorsList) {
        error_message +=  errorsList.param+" " + errorsList.msg + ", ";
      });
      error_message = error_message.replace(/,\s*$/, "");
      data = {
        message: error_message,
      };
      response.validation_error_message(data, res);

    }else{
      next();
    }
}];

exports.forgot_password = [

  body("email").trim().notEmpty().withMessage('required').isEmail().withMessage('is invalid'),
  async (req, res, next) =>
  {
    const errors = validationResult(req);
    if (!errors.isEmpty()) 
    {
      var error_message = "";
      errors.array().forEach(function (errorsList) {
        error_message +=  errorsList.param+" " + errorsList.msg + ", ";
      });
      error_message = error_message.replace(/,\s*$/, "");
      data = {
        message: error_message,
      };
      response.validation_error_message(data, res);

    }else{
      next();
    }
}];

exports.reset_password = [

  body("new_password").trim().notEmpty().withMessage('required')
  .isLength({ min: 6 }).withMessage('must be at least 6 characters long')
  .custom((value, { req }) => {
    if (value.length > 10) {
      throw new Error('must not exceed 10 characters');
    }
    const re = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])");
     if(re.test(value)){
      return true;
     }else{
      return Promise.reject('must contain 1 upper case, 1 lower case, 1 special character, and 1 number');
     }
     
  }),
  
  body("content").trim().notEmpty().withMessage('required').isLength({ min: 1 }).withMessage('must be at least 1 chars long'),
  body("iv").trim().notEmpty().withMessage('required').isLength({ min: 1 }).withMessage('must be at least 1 chars long'),

  async (req, res, next) =>
  {
    const errors = validationResult(req);
    if (!errors.isEmpty()) 
    {
      var error_message = "";
      errors.array().forEach(function (errorsList) {
        error_message +=  errorsList.param+" " + errorsList.msg + ", ";
      });
      error_message = error_message.replace(/,\s*$/, "");
      data = {
        message: error_message,
      };
      response.validation_error_message(data, res);

    }else{
      next();  
    }
}];

exports.change_password = [

  body('oldPassword').notEmpty().withMessage('Old password is required'),
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 6 }).withMessage('New password must be at least 6 characters long'),

  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      var error_message = [];
      errors.array().forEach(function (errorsList) {
        error_message.push(errorsList.param + " " + errorsList.msg)
      });
      data = {
        message: error_message,
      };
      response.validation_error_message(data, res);
    } else {
      next();
    }
  }
];

