const express = require('express');
const { handlePincodeGeofencing, handleLongLatGeofencing } = require('../controllers/locationController');
const locationRouter = express.Router();

locationRouter.post('/pincode/geofencing', handlePincodeGeofencing);
locationRouter.post('/longLat/geofencing', handleLongLatGeofencing);

module.exports = locationRouter;
