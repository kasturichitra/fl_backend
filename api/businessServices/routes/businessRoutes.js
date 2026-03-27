const express = require('express');
const businessRouters = express.Router();

const { dinVerification, gstinverify, handleCINVerification,
        handleGST_INtoPANDetails, gstInTaxPayerVerification,
        handleTINVerification, udyamNumberVerfication,
        handleCreateShopEstablishment, LEIVerification, 
        CompanVerification,
        gstinViewAndTrack,
        CompanSearchVerification,
        handleIECVerification,
        DGFTVerification,
        udyogAadhaarVerification,
        udyogwithPhoneAadhaarVerification} = require("../controller/businessServices.Controller");

businessRouters.post("/din/verify", dinVerification);
businessRouters.post('/Gstinverify', gstinverify);
businessRouters.post('/getpanwithgstin', handleGST_INtoPANDetails);
businessRouters.post('/gstIn/TaxPayer/verify', gstInTaxPayerVerification);
businessRouters.post('/gstinViewAndTrack', gstinViewAndTrack);
businessRouters.post('/Cin/verify', handleCINVerification);
businessRouters.post('/companylist/verify', CompanVerification);
businessRouters.post('/company/search', CompanSearchVerification);
businessRouters.post('/tin/verify', handleTINVerification);
businessRouters.post('/IEC/verify', handleIECVerification);
businessRouters.post('/udyam/verify', udyamNumberVerfication);
businessRouters.post('/DGFT/verify', DGFTVerification);
businessRouters.post('/LEI/verify', LEIVerification);
businessRouters.post('/udyogAadhaar/verify', udyogAadhaarVerification);
businessRouters.post('/udyog/phoneAadhaar/verify', udyogwithPhoneAadhaarVerification);
businessRouters.post('/shopest/verify', handleCreateShopEstablishment);

module.exports = businessRouters;