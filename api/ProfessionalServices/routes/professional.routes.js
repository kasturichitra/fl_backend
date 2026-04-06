const express = require('express');
const professionalRoute = express.Router();
const { InsuranceVerification, CharteredAccountantVerification, eSignAadhaarBased, DentistVerification, DocterVerification } = require('../controller/professional.controller');


professionalRoute.post('/Insurance/verify',InsuranceVerification);
professionalRoute.post('/charteredAccount/verify',CharteredAccountantVerification)
professionalRoute.post('/docter/verify',DocterVerification);
professionalRoute.post('/dentist/verify',DentistVerification);
professionalRoute.post('/esignAadhaar/verify',eSignAadhaarBased);

module.exports = professionalRoute
