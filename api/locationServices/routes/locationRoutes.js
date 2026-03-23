const express = require("express");
const {
  handlePincodeGeofencing,
  handleLongLatGeofencing,
  handleDigiPinToLongLat,
  handleLongLatToDigiPin,
  handleAddressToDigiPin,
} = require("../controllers/locationController");
const locationRouter = express.Router();

locationRouter.post("/pincode/geofencing", handlePincodeGeofencing);
locationRouter.post("/longLat/geofencing", handleLongLatGeofencing);
locationRouter.post("/longLat/digipin", handleLongLatToDigiPin);
locationRouter.post("/digipin/longLat", handleDigiPinToLongLat);
locationRouter.post("/address/digipin", handleAddressToDigiPin);

module.exports = locationRouter;
