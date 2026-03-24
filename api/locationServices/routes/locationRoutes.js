const express = require("express");
const {
  handlePincodeGeofencing,
  handleLongLatGeofencing,
  handleDigiPinToLongLat,
  handleLongLatToDigiPin,
  handleAddressToDigiPin,
  handleGeoTagging,
  handleGeoTaggingDistacnceCalculation,
} = require("../controllers/locationController");
const locationRouter = express.Router();

locationRouter.post("/pincode/geofencing", handlePincodeGeofencing);
locationRouter.post("/longLat/geofencing", handleLongLatGeofencing);
locationRouter.post("/longLat/digipin", handleLongLatToDigiPin);
locationRouter.post("/digipin/longLat", handleDigiPinToLongLat);
locationRouter.post("/address/digipin", handleAddressToDigiPin);
locationRouter.post("/geo/tagging", handleGeoTagging);
locationRouter.post("/geo/tagging/distance_calculation", handleGeoTaggingDistacnceCalculation);

module.exports = locationRouter;
