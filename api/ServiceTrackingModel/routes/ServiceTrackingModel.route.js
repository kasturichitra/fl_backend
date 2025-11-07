const express = require('express');
const serviceRouter = express.Router();
const serviceTrackingController = require('../controllers/ServiceTrackingModel.controller');

serviceRouter.post('/save/serviceTracking', serviceTrackingController.saveServiceTrackingModels);
serviceRouter.get('/get/serviceTracking', serviceTrackingController.getAllServiceTrackingModels);
serviceRouter.get('/get/serviceTracking/:serviceName', serviceTrackingController.getServiceTrackingModelByName);
serviceRouter.put('/updateService', serviceTrackingController.updateServiceTracking);
serviceRouter.delete('/deleteServiceTracking/:serviceName', serviceTrackingController.DeleteServiceTracking);

module.exports = serviceRouter;
