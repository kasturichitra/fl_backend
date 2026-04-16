const express = require("express");
const { ComprehensiveGSTSolution, GstAdvance } = require("../controllers/gstServiceController");

const gstRouter = express.Router();

gstRouter.post("/comprehensivegst/verify", ComprehensiveGSTSolution)
gstRouter.post("/gstAdvance/verify", GstAdvance)

module.exports = gstRouter