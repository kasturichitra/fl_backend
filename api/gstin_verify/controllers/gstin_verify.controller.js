const gstin_verifyModel = require("../models/gstin_verify.model");
const { selectService } = require("../../service/serviceSelector");
const { ERROR_CODES } = require("../../../utlis/errorCodes");
const { kycLogger } = require("../../Logger/logger");
const { GSTActiveServiceResponse } = require("../../GlobalApiserviceResponse/GstServiceResponse");
const { createApiResponse } = require("../../../utlis/ApiResponseHandler");
const handleValidation = require("../../../utlis/lengthCheck");
const checkingRateLimit = require("../../../utlis/checkingRateLimit");
const { GSTtoPANActiveServiceResponse } = require("../../GlobalApiserviceResponse/GSTtoPANActiveServiceResponse");
const gstin_panModel = require("../models/gstin_pan.model");
const { encryptData } = require("../../../utlis/EncryptAndDecrypt");
const { handleValidateActiveProducts } = require("../../../utlis/ValidateActiveProducts");
const chargesToBeDebited = require("../../../utlis/chargesMaintainance");

exports.gstinverify = async (req, res, next) => {
  const { gstinNumber } = req.body;
  const clientId = req.clientId;
  const environment = req.environment

  kycLogger.info(`gstinNumber Details ===>> gstinNumber: ${gstinNumber}`);

  try {
    if (!gstinNumber) {
      return res.status(400).json(ERROR_CODES?.BAD_REQUEST)
    };
    const encryptedGst = encryptData(gstinNumber);
    kycLogger.info(`gstinNumber Details ===>> gstinNumber: ${gstinNumber}`);

    const capitalNumber = gstinNumber?.toUpperCase();
    const isValid = handleValidation("gstin", capitalNumber, res);
    if (!isValid) return;

    // STEP 1: Check the rate limit
    // const gstinRateLimitResult = await checkingRateLimit({
    //   identifiers: { gstinNumber },
    //   service: "GSTIN", clientId
    // });
    // if (!gstinRateLimitResult.allowed) {
    //   return res.status(429).json({ success: false, message: gstinRateLimitResult.message });
    // };

    // STEP 2: check the is Product Subscribe
    // const isClientSubscribe = await handleValidateActiveProducts({ clientId, serviceId: 'GSTIN' });
    // if (!isClientSubscribe?.isSubscribe) {
    //   return res.status(200).json({
    //     success: false, message: isClientSubscribe?.message
    //   });
    // };

    // SETP 3: Add charge back trn
    // await chargesToBeDebited(clientId, "GSTIN", tnId, environment);

    // Check if the record is present in the DB
    const existingGstin = await gstin_verifyModel.findOne({ gstinNumber: encryptedGst });
    if (existingGstin) {
      const dataToShow = {
        ...existingGstin?.response,
        gstinNumber
      };
      kycLogger.info('existing GSTIN Response', dataToShow);

      return res.status(200).json(createApiResponse(200, dataToShow, 'Valid'));
    }

    // Get All Active Services
    const service = await selectService('GSTIN');
    kycLogger.info(`gst inverify activer service ${JSON.stringify(service)}`);

    //  get Acitve Service Response
    let response = await GSTActiveServiceResponse(gstinNumber, service, 0);
    kycLogger.info(`gst inverify activer response ${JSON.stringify(response)}`);

    // Response form Active Service if response message is Valid
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
    kycLogger.error(`Error performing GSTIN verification:${error}`);
    return res.status(500).json(ERROR_CODES?.SERVER_ERROR);
  }
};


exports.handleGST_INtoPANDetails = async (req, res, next) => {
  const { gstinNumber } = req.body;
  const clientId = req.clientId;
  const isClient = req.role;

  kycLogger.info(`gstinNumber Details ===>> gstinNumber: ${gstinNumber}`);

  try {
    if (!gstinNumber) {
      return res.status(400).json(ERROR_CODES?.BAD_REQUEST)
    }
    const capitalNumber = gstinNumber?.toUpperCase();

    const isValid = handleValidation("gstin", capitalNumber, res);
    if (!isValid) return;

    if (isClient == 'Client') {
      // STEP 1: Check the rate limit
      const gstinRateLimitResult = await checkingRateLimit({
        identifiers: { gstinNumber },
        service: "GSTIN", clientId
      });
      if (!gstinRateLimitResult.allowed) {
        return res.status(429).json({ success: false, message: gstinRateLimitResult.message });
      };

      // STEP 2: check the is Product Subscribe
      const isClientSubscribe = await handleValidateActiveProducts({ clientId, serviceId: 'GSTIN' });
      if (!isClientSubscribe?.isSubscribe) {
        return res.status(200).json({
          success: false, message: isClientSubscribe?.message
        });
      };

      // We Also have to check the Environment form request for TEST key or live key
      // STEP 3: Add charge back trn 
      // await chargesToBeDebited(clientId, "GSTIN", tnId);

    }
    const existingGstin = await gstin_panModel.findOne({ gstinNumber });

    if (existingGstin) {
      const dataToShow = existingGstin?.result;
      return res.status(200).json(createApiResponse(200, dataToShow, 'Valid'));
    }

    const service = await selectService('GSTIN');
    kycLogger.info(`gst inverify activer service ${JSON.stringify(service)}`);
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
    kycLogger.error(`Error performing GSTIN verification:${error}`);
    return res.status(500).json(ERROR_CODES?.SERVER_ERROR);
  }
};