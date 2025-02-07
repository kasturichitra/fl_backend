const express = require('express');
const NominalRouter = express.Router();

const NominalChargesController = require('../Controller/NominalChargesController');


NominalRouter.post('/save/nominalCharges', NominalChargesController.createNominalCharge);
NominalRouter.get("/get/all/nominalCharges",NominalChargesController.getNominalCharges)
NominalRouter.get("/get/all/nominalCharges/by/service/:service",NominalChargesController.getNominalChargeByService)

module.exports = NominalRouter;
