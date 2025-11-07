const express = require('express');
const shopRouter = express.Router();

const shopestablishmentController = require('../controllers/shopestablishment.controller');
const shopestablishmentValidator = require('../validations/shopestablishment.validator');

//router.post('/createShopEstablishment', shopestablishmentValidator.createShopEstablishment,shopestablishmentController.createShopEstablishment);
shopRouter.post("/shopest",shopestablishmentController.handleCreateShopEstablishment)

module.exports = shopRouter;
 