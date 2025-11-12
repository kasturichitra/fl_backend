const express = require("express");
const udyamNumberVerfication = require("../controller/udyamController");

const udyamRouter = express.Router();

udyamRouter.post("/verify", udyamNumberVerfication)

module.exports = udyamRouter;