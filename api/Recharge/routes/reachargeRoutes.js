const express = require('express');
const { FetchOperators, FetchPlans, FetchOffers, RechargeURL, FetchOldPlans } = require('../controller/rechargeController');
const RechargeRoute = express.Router();

RechargeRoute.post("/Operators",FetchOperators);
RechargeRoute.post("/Plans",FetchPlans);
RechargeRoute.post("/OldPlans",FetchOldPlans);
RechargeRoute.post("/OffersPlans",FetchOffers);
RechargeRoute.post("/RechargeURL",RechargeURL);

module.exports = RechargeRoute