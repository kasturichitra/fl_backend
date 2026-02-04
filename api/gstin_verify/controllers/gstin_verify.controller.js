const gstin_verifyModel = require("../models/gstin_verify.model");
const { selectService } = require("../../service/serviceSelector");
const { ERROR_CODES } = require("../../../utlis/errorCodes");
// const { gstLogger } = require("../../Logger/logger");
const { GSTActiveServiceResponse } = require("../../GlobalApiserviceResponse/GstServiceResponse");
const { createApiResponse } = require("../../../utlis/ApiResponseHandler");
const handleValidation = require("../../../utlis/lengthCheck");
const checkingRateLimit = require("../../../utlis/checkingRateLimit");
const { GSTtoPANActiveServiceResponse } = require("../../GlobalApiserviceResponse/GSTtoPANActiveServiceResponse");
const gstin_panModel = require("../models/gstin_pan.model");
const { encryptData } = require("../../../utlis/EncryptAndDecrypt");


exports.gstinverify = async (req, res, next) => {
  const { gstinNumber } = req.body;
  console.log(`gstinNumber Details ===>> gstinNumber: ${gstinNumber}`);
  // gstLogger.info(`gstinNumber Details ===>> gstinNumber: ${gstinNumber}`);

  const capitalNumber = gstinNumber?.toUpperCase();
  const isValid = handleValidation("gstin", capitalNumber, res);
  if (!isValid) return;

  try {
    if (!gstinNumber) {
      return res.status(400).json(ERROR_CODES?.BAD_REQUEST)
    }
    const gstinRateLimitResult = await checkingRateLimit({
      identifiers: { gstinNumber },
      service: "GSTIN",
      clientId: req.userClientId,
    });

    if (!gstinRateLimitResult.allowed) {
      return res.status(429).json({
        success: false,
        message: gstinRateLimitResult.message,
      });
    }
    const encryptedGst = encryptData(gstinNumber);
    const existingGstin = await gstin_verifyModel.findOne({ gstinNumber: encryptedGst });

    if (existingGstin) {
      console.log('existing GSTIN Response')
      const dataToShow = existingGstin?.response;
      return res.status(200).json(createApiResponse(200, dataToShow, 'Valid'));
    }
    const service = await selectService('GSTIN');
    console.log('gst inverify activer service', service);
    let response = await GSTActiveServiceResponse(gstinNumber, service, 0);
    console.log('gst inverify activer response', response);
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = { ...response?.result, gstinNumber: encryptedGst };
      const storingData = {
        status: 1,
        gstinNumber: encryptedGst,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await gstin_verifyModel.create(storingData);
      return res.status(200).json(createApiResponse(200, response?.result, 'Success'));
    } else {
      return res.status(404).json(createApiResponse(404, { gstinNumber }, 'Failed'));
    }
  } catch (error) {
    console.error("Error performing GSTIN verification:", error);
    // gstLogger.error(`Error performing GSTIN verification:${error}`);
    return res.status(500).json(ERROR_CODES?.SERVER_ERROR);
  }
};


exports.handleGST_INtoPANDetails = async (req, res, next) => {
  const { gstinNumber } = req.body;
  console.log(`gstinNumber Details ===>> gstinNumber: ${gstinNumber}`);
  gstLogger.info(`gstinNumber Details ===>> gstinNumber: ${gstinNumber}`);

  const capitalNumber = gstinNumber?.toUpperCase();
  const isValid = handleValidation("gstin", capitalNumber, res);
  if (!isValid) return;

  try {
    if (!gstinNumber) {
      return res.status(400).json(ERROR_CODES?.BAD_REQUEST)
    }
    const existingGstin = await gstin_panModel.findOne({ gstinNumber });

    if (existingGstin) {
      const dataToShow = existingGstin?.result;
      return res.status(200).json(createApiResponse(200, dataToShow, 'Valid'));
    }

    const service = await selectService('GSTIN');
    console.log('gst inverify activer service', service);
    let response = await GSTtoPANActiveServiceResponse(gstinNumber, service, 0)

    if (response?.message?.toUpperCase() == "VALID") {

      const encryptedGst = encryptData(response?.result?.gstinNumber);
      const encryptedResponse = { ...response?.result, gstinNumber: encryptedGst };
      const storingData = {
        status: 1,
        gstinNumber: encryptedGst,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await gstin_verifyModel.create(storingData);
      return res.status(200).json(createApiResponse(200, response?.result, 'Success'));
    } else {
      return res.satus(404).json(createApiResponse(404, { gstinNumber }, 'Failed'));
    }
  } catch (error) {
    console.error("Error performing GSTIN verification:", error);
    gstLogger.error(`Error performing GSTIN verification:${error}`);
    return res.status(500).json(ERROR_CODES?.SERVER_ERROR);
  }
};