const gstin_verifyModel = require("../models/gstin_verify.model");
const { selectService } = require("../../service/serviceSelector");
const { ERROR_CODES } = require("../../../utlis/errorCodes");
const { companyLogger } = require("../../Logger/logger");
const {
  GSTActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/GstServiceResponse");
const { createApiResponse } = require("../../../utlis/ApiResponseHandler");
const handleValidation = require("../../../utlis/lengthCheck");
const checkingRateLimit = require("../../../utlis/checkingRateLimit");
const {
  GSTtoPANActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/GSTtoPANActiveServiceResponse");
const gstin_panModel = require("../models/gstin_pan.model");
const { encryptData } = require("../../../utlis/EncryptAndDecrypt");
const {
  handleValidateActiveProducts,
} = require("../../../utlis/ValidateActiveProducts");
const chargesToBeDebited = require("../../../utlis/chargesMaintainance");
const creditsToBeDebited = require("../../../utlis/creditsMaintainance");

exports.gstinverify = async (req, res, next) => {
  const {
    gstinNumber,
    serviceId = "",
    categoryId = "",
    mobileNumber = "",
  } = req.body;

  const clientId = req.clientId;
  const environment = req.environment

  companyLogger.info(`gstinNumber Details ===>> gstinNumber: ${gstinNumber}`);

  const encryptedGst = encryptData(gstinNumber);
  companyLogger.info(`gstinNumber Details ===>> gstinNumber: ${gstinNumber}`);

  const capitalGstNumber = gstinNumber?.toUpperCase();
  const isValid = handleValidation("gstin", capitalGstNumber, res);
  if (!isValid) return;

  const identifierHash = hashIdentifiers({
    gstNo: capitalGstNumber,
  });

  const panRateLimitResult = await checkingRateLimit({
    identifiers: { identifierHash },
    serviceId,
    categoryId,
    clientId: req.clientId,
  });

  if (!panRateLimitResult.allowed) {
    return res.status(429).json({
      success: false,
      message: panRateLimitResult.message,
    });
  }

  const tnId = genrateUniqueServiceId();
  kycLogger.info(`pan txn Id ===>> ${tnId}`);
  let maintainanceResponse;
  if (req.environment?.toLowercase() == "test") {
    maintainanceResponse = await creditsToBeDebited(
      req.clientId,
      serviceId,
      categoryId,
      tnId,
    );
  } else {
    maintainanceResponse = await chargesToBeDebited(
      req.clientId,
      serviceId,
      categoryId,
      tnId,
    );
  }

  if (!maintainanceResponse?.result) {
    return res.status(500).json({
      success: false,
      message: "InValid",
      response: {},
    });
  }

  // Check if the record is present in the DB
  const existingGstin = await gstin_verifyModel.findOne({
    gstinNumber: encryptedGst,
  });
  if (existingGstin) {
    companyLogger.info("existing GSTIN Response");
    const dataToShow = existingGstin?.response;
    return res.status(200).json(createApiResponse(200, dataToShow, "Valid"));
  }

  // Get All Active Services
  const service = await selectService(categoryId, serviceId);
  companyLogger.info(`gst inverify activer service ${JSON.stringify(service)}`);

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
    companyLogger.info(
      `gst inverify activer response ${JSON.stringify(response)}`,
    );

    // Response form Active Service if response message is Valid
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        gstinNumber: encryptedGst,
      };
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
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      return res
        .status(404)
        .json(createApiResponse(404, { gstinNumber }, "Failed"));
    }
  } catch (error) {
    companyLogger.error(`Error performing GSTIN verification:${error}`);
    return res.status(500).json(ERROR_CODES?.SERVER_ERROR);
  }
};

exports.handleGST_INtoPANDetails = async (req, res, next) => {
  const {
    gstinNumber,
    serviceId = "",
    categoryId = "",
    mobileNumber = "",
  } = req.body;
  const clientId = req.clientId;
  const isClient = req.role;

  companyLogger.info(`gstinNumber Details ===>> gstinNumber: ${gstinNumber}`);

  if (!gstinNumber) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }
  const capitalGstNumber = gstinNumber?.toUpperCase();

  const isValid = handleValidation("gstin", capitalGstNumber, res);
  if (!isValid) return;

  const identifierHash = hashIdentifiers({
    panNo: capitalGstNumber,
  });

  const panRateLimitResult = await checkingRateLimit({
    identifiers: { identifierHash },
    serviceId,
    categoryId,
    clientId: req.clientId,
  });

  if (!panRateLimitResult.allowed) {
    return res.status(429).json({
      success: false,
      message: panRateLimitResult.message,
    });
  }

  const tnId = genrateUniqueServiceId();
  kycLogger.info(`pan txn Id ===>> ${tnId}`);
  let maintainanceResponse;
  if (req.environment?.toLowercase() == "test") {
    maintainanceResponse = await creditsToBeDebited(
      req.clientId,
      serviceId,
      categoryId,
      tnId,
    );
  } else {
    maintainanceResponse = await chargesToBeDebited(
      req.clientId,
      serviceId,
      categoryId,
      tnId,
    );
  }

  if (!maintainanceResponse?.result) {
    return res.status(500).json({
      success: false,
      message: "InValid",
      response: {},
    });
  }

  const existingGstin = await gstin_panModel.findOne({ gstinNumber });

  if (existingGstin) {
    const dataToShow = existingGstin?.result;
    return res.status(200).json(createApiResponse(200, dataToShow, "Valid"));
  }

  const service = await selectService(categoryId, serviceId);

  try {
    if (isClient == "Client") {
      // STEP 1: Check the rate limit
      const gstinRateLimitResult = await checkingRateLimit({
        identifiers: { gstinNumber },
        service: "GSTIN",
        clientId,
      });
      if (!gstinRateLimitResult.allowed) {
        return res
          .status(429)
          .json({ success: false, message: gstinRateLimitResult.message });
      }

      // STEP 2: check the is Product Subscribe
      const isClientSubscribe = await handleValidateActiveProducts({
        clientId,
        serviceId: "GSTIN",
      });
      if (!isClientSubscribe?.isSubscribe) {
        return res.status(200).json({
          success: false,
          message: isClientSubscribe?.message,
        });
      }

      // We Also have to check the Environment form request for TEST key or live key
      // STEP 3: Add charge back trn
      // await chargesToBeDebited(clientId, "GSTIN", tnId);
    }

    console.log("gst_in to pan verify activer service ===>>>", service);
    companyLogger.info(
      `gst inverify activer service ${JSON.stringify(service)}`,
    );
    let response = await GSTtoPANActiveServiceResponse(gstinNumber, service, 0);

    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedGst = encryptData(response?.result?.gstinNumber);
      const encryptedResponse = {
        ...response?.result,
        gstinNumber: encryptedGst,
      };
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
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      return res
        .satus(404)
        .json(createApiResponse(404, { gstinNumber }, "Failed"));
    }
  } catch (error) {
    companyLogger.error(`Error performing GSTIN verification:${error}`);
    return res.status(500).json(ERROR_CODES?.SERVER_ERROR);
  }
};
