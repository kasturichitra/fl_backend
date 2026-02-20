const express = require('express');
const analyticdataRouter = express.Router();
const analyticsDataController = require("../controllers/analyticdata.controller")

analyticdataRouter.get("/Analyticalreports", analyticsDataController.AnaliticsData)


module.exports = analyticdataRouter;
