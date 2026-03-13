const express = require("express");
const { handleRcVerification, handleStolenVehicleVerification, handleChallanViaRc, handleDrivingLicenseVerification } = require("../controllers/vehicleControllers");

const vehicleRouter = express.Router();

vehicleRouter.post("/rcverify", handleRcVerification)
vehicleRouter.post("/stolen_vehicle/verification", handleStolenVehicleVerification)
vehicleRouter.post("/challan_via_rc", handleChallanViaRc)
vehicleRouter.post("/driving_license/verify", handleDrivingLicenseVerification)

module.exports = vehicleRouter