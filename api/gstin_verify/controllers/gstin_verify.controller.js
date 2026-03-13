const gstin_verifyModel = require("../models/gstin_verify.model");
const { selectService } = require("../../service/serviceSelector");
const { ERROR_CODES, mapError } = require("../../../utils/errorCodes");
const { businessServiceLogger } = require("../../Logger/logger");
const {
  GSTActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/GstServiceResponse");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const handleValidation = require("../../../utils/lengthCheck");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const {
  GSTtoPANActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/GSTtoPANActiveServiceResponse");
const gstin_panModel = require("../models/gstin_pan.model");
const { encryptData } = require("../../../utils/EncryptAndDecrypt");
const {
  handleValidateActiveProducts,
} = require("../../../utils/ValidateActiveProducts");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const { findingInValidResponses } = require("../../../utils/InvalidResponses");
const { deductCredits } = require("../../../services/CreditService");

exports.gstinverify = async (req, res, next) => {
  const {
    gstinNumber,
    serviceId = "",
    categoryId = "",
    mobileNumber = "",
  } = req.body;

  if (!gstinNumber || !serviceId || !categoryId) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }

  const clientId = req.clientId;

  businessServiceLogger.info(
    `gstinNumber Details ===>> gstinNumber: ${gstinNumber}`,
  );

  try {
    const capitalGstNumber = gstinNumber?.toUpperCase();
    const isValid = handleValidation("gstin", capitalGstNumber, res);
    if (!isValid) return;

    businessServiceLogger.info(
      `Executing GSTIN verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );

    const identifierHash = hashIdentifiers({
      gstNo: capitalGstNumber,
    });

    const gstRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: clientId,
    });

    if (!gstRateLimitResult.allowed) {
      businessServiceLogger.warn(`Rate limit exceeded for GSTIN verification: client ${clientId}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: gstRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    businessServiceLogger.info(`Generated GSTIN txn Id: ${tnId}`);

    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      tnId,
      req.environment
    );

    if (!maintainanceResponse?.result) {
      businessServiceLogger.error(`Credit deduction failed for GSTIN verification: client ${clientId}, txnId ${tnId}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const encryptedGst = encryptData(gstinNumber);

    // Check if the record is present in the DB
    const existingGstin = await gstin_verifyModel.findOne({
      gstinNumber: encryptedGst,
    });

    // Note: AnalyticsDataUpdate was missing, adding it for consistency
    const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      businessServiceLogger.warn(
        `Analytics update failed for GSTIN verification: client ${clientId}, service ${serviceId}`,
      );
    }

    businessServiceLogger.debug(
      `Checked for existing GSTIN record in DB: ${existingGstin ? "Found" : "Not Found"}`,
    );
    if (existingGstin) {
      if (existingGstin?.status == 1) {
        businessServiceLogger.info(
          `Returning cached GSTIN response for client: ${clientId}`,
        );

        const decrypted = {
          ...existingGstin?.response,
          gstinNumber: gstinNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          clientId,
          result: existingGstin?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = decrypted;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      } else {
        businessServiceLogger.info(
          `Returning cached GSTIN response for client: ${clientId}`,
        );
        await responseModel.create({
          serviceId,
          categoryId,
          clientId,
          result: existingGstin?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingGstin?.response;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      }
    }

    // Get All Active Services
    const service = await selectService(categoryId, serviceId);
    if (!service) {
      businessServiceLogger.warn(
        `Active service not found for GSTIN category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    businessServiceLogger.info(
      `Active service selected for GSTIN verification: ${service.serviceFor}`,
    );

    //  get Acitve Service Response
    let response = await GSTActiveServiceResponse(gstinNumber, service, 0);
    businessServiceLogger.info(
      `Response received from active service ${service.serviceFor}: ${response?.message}`,
    );

    // Response form Active Service if response message is Valid
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        gstinNumber: encryptedGst,
      };
      await responseModel.create({
        serviceId,
        categoryId,
        clientId,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 1,
        gstinNumber: encryptedGst,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await gstin_verifyModel.create(storingData);
      businessServiceLogger.info(
        `Valid GSTIN response stored and sent to client: ${clientId}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId,
        result: {
          gstinNumber: gstinNumber,
          ...findingInValidResponses("gstIn"),
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 2,
        gstinNumber: encryptedGst,
        response: {
          gstinNumber: gstinNumber,
          ...findingInValidResponses("gstIn"),
        },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await gstin_verifyModel.create(storingData);
      businessServiceLogger.info(
        `Invalid GSTIN response received and sent to client: ${clientId}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { gstinNumber }, "Failed"));
    }
  } catch (error) {
    businessServiceLogger.error(
      `System error in GSTIN verification for client ${clientId}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
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

  businessServiceLogger.info(
    `gstinNumber Details ===>> gstinNumber: ${gstinNumber}`,
  );
  try {
    if (!gstinNumber) {
      return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
    }
    const capitalGstNumber = gstinNumber?.toUpperCase();

    const isValid = handleValidation("gstin", capitalGstNumber, res);
    if (!isValid) return;

    const identifierHash = hashIdentifiers({
      gstNo: capitalGstNumber,
    });

    const gstRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: req.clientId,
    });

    if (!gstRateLimitResult.allowed) {
      return res.status(429).json({
        success: false,
        message: gstRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    businessServiceLogger.info(`pan txn Id ===>> ${tnId}`);

    const maintainanceResponse = await deductCredits(
      req.clientId,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const encryptedGst = encryptData(response?.result?.gstinNumber);

    const existingGstin = await gstin_panModel.findOne({ gstinNumber: encryptedGst });

    if (existingGstin) {
      const dataToShow = existingGstin?.result;
      return res.status(200).json(createApiResponse(200, dataToShow, "Valid"));
    }

    const service = await selectService(categoryId, serviceId);

    businessServiceLogger.info(
      `gst inverify activer service ${JSON.stringify(service)}`,
    );

    if (isClient == "Client") {
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
    }

    let response = await GSTtoPANActiveServiceResponse(gstinNumber, service, 0);

    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        gstinNumber: encryptedGst,
      };
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
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
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: {
          gstinNumber: gstinNumber,
          ...findingInValidResponses("gstIn"),
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
        const storingData = {
        status: 2,
        gstinNumber: encryptedGst,
        response: {
          gstinNumber: gstinNumber,
          ...findingInValidResponses("gstIn"),
        },
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await gstin_verifyModel.create(storingData);
      return res
        .status(404)
        .json(createApiResponse(404, { gstinNumber }, "Failed"));
    }
  } catch (error) {
    businessServiceLogger.error(`Error performing GSTIN verification:${error}`);
    return res.status(500).json(ERROR_CODES?.SERVER_ERROR);
  }
};
