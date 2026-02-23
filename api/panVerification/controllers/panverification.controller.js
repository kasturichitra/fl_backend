const panverificationModel = require("../models/panverification.model");
const panToAadhaarModel = require("../models/panToAadhaarModel");
const axios = require("axios");
require("dotenv").config();
const { kycLogger } = require("../../Logger/logger");
const {
  encryptData,
  decryptData,
} = require("../../../utils/EncryptAndDecrypt");
const { selectService } = require("../../service/serviceSelector");
const { ERROR_CODES, mapError } = require("../../../utils/errorCodes");
const handleValidation = require("../../../utils/lengthCheck");
const { findingInValidResponses } = require("../../../utils/InvalidResponses");
const {
  PanActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/PanServiceResponse");
const {
  PantoAadhaarActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/PantoAadhaarRes");

const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const {
  PANtoGSTActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/PANtoGSTActiveServiceResponse");
const { deductCredits } = require("../../../services/CreditService");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");

exports.verifyPanNumber = async (req, res) => {
  const data = req.body;
  const {
    panNumber,
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
    clientId = "",
  } = data;
  const capitalPanNumber = panNumber?.toUpperCase();
  const isValid = handleValidation("pan", capitalPanNumber, res);
  if (!isValid) return;

  kycLogger.info("All inputs in pan are valid, continue processing...");

  const storingClient = req.clientId || clientId;

  try {
    kycLogger.info(`Executing PAN verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`);

    const identifierHash = hashIdentifiers({
      panNo: capitalPanNumber,
    });

    const panRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!panRateLimitResult.allowed) {
      kycLogger.warn(`Rate limit exceeded for PAN verification: client ${storingClient}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: panRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    kycLogger.info(`Generated PAN txn Id: ${tnId}`);

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment
    );

    if (!maintainanceResponse?.result) {
      kycLogger.error(`Credit deduction failed for PAN verification: client ${storingClient}, txnId ${tnId}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const encryptedPan = encryptData(capitalPanNumber);

    const existingPanNumber = await panverificationModel.findOne({
      panNumber: encryptedPan,
    });

    const analyticsResult = await AnalyticsDataUpdate(storingClient, serviceId, categoryId);
    if (!analyticsResult.success) {
      kycLogger.warn(`Analytics update failed for PAN verification: client ${storingClient}, service ${serviceId}`);
    }

    kycLogger.debug(`Checked for existing PAN record in DB: ${existingPanNumber ? "Found" : "Not Found"}`);
    if (existingPanNumber) {
      const decryptedPanNumber = decryptData(existingPanNumber?.panNumber);
      const resOfPan = existingPanNumber?.response;

      if (existingPanNumber?.status == 1) {
        const decryptedResponse = {
          ...existingPanNumber?.response,
          PAN: decryptedPanNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: decryptedResponse,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        kycLogger.info(`Returning cached valid PAN response for client: ${storingClient}`);
        return res.json({
          message: "Valid",
          data: decryptedResponse,
          success: true,
        });
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: resOfPan,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        kycLogger.info(`Returning cached invalid PAN response for client: ${storingClient}`);
        return res.json({
          message: "InValid",
          data: resOfPan,
          success: false,
        });
      }
    }

    const service = await selectService(categoryId, serviceId);
    
    if (!service) {
      kycLogger.warn(`Active service not found for category ${categoryId}, service ${serviceId}`);
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    kycLogger.info(`Active service selected for PAN verification: ${service.serviceFor}`);
    let response = await PanActiveServiceResponse(panNumber, service, 0);

    kycLogger.info(
      `Response received from active service ${service.serviceFor}: ${response?.message}`,
    );

    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(response?.result?.PAN);
      const encryptedResponse = { ...response?.result, PAN: encryptedPan };

      const storingData = {
        panNumber: encryptedPan,
        userName: response?.result?.Name,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        status: 1,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panverificationModel.create(storingData);
      kycLogger.info(`Valid PAN response stored and sent to client: ${storingClient}`);

      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      const invalidResponse = {
        PAN: panNumber,
        Name: "",
        PAN_Status: "",
        PAN_Holder_Type: "",
      };
      kycLogger.info(`Invalid PAN response received and sent to client: ${storingClient}`);
      return res
        .status(404)
        .json(createApiResponse(404, invalidResponse, "Failed"));
    }
  } catch (error) {
    kycLogger.error(`System error in PAN verification for client ${storingClient}: ${error.message}`, error);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.verifyPantoGst_InNumber = async (req, res) => {
  const data = req.body;
  const {
    panNumber,
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
  } = data;
  const capitalNumber = panNumber?.toUpperCase();
  const isValid = handleValidation("pan", capitalNumber, res);
  if (!isValid) return;

  const storingClient = req.clientId || clientId;

  kycLogger.info("All inputs in pan are valid, continue processing...");

  try {
    kycLogger.info(`Executing PAN to GST verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`);

    const identifierHash = hashIdentifiers({
      panNo: capitalNumber,
    });

    const panRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!panRateLimitResult.allowed) {
      kycLogger.warn(`Rate limit exceeded for PAN to GST verification: client ${storingClient}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: panRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    kycLogger.info(`Generated PAN to GST txn Id: ${tnId}`);

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment
    );

    if (!maintainanceResponse?.result) {
      kycLogger.error(`Credit deduction failed for PAN to GST verification: client ${storingClient}, txnId ${tnId}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const encryptedPan = encryptData(capitalNumber);

    const existingPanNumber = await panverificationModel.findOne({
      panNumber: encryptedPan,
    });

    const analyticsResult = await AnalyticsDataUpdate(storingClient, serviceId, categoryId);
    if (!analyticsResult.success) {
      kycLogger.warn(`Analytics update failed for PAN to GST verification: client ${storingClient}, service ${serviceId}`);
    }

    kycLogger.debug(`Checked for existing PAN to GST record in DB: ${existingPanNumber ? "Found" : "Not Found"}`);
    if (existingPanNumber) {
      const decryptedPanNumber = decryptData(existingPanNumber?.panNumber);
      const resOfPan = existingPanNumber?.response;

      if (existingPanNumber?.status == 1) {
        const decryptedResponse = {
          ...existingPanNumber?.response,
          PAN: decryptedPanNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: decryptedResponse,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        kycLogger.info(`Returning cached valid PAN to GST response for client: ${storingClient}`);
        return res.json({
          message: "Valid",
          data: decryptedResponse,
          success: true,
        });
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: {
            PAN: decryptedPanNumber,
          },
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        kycLogger.info(`Returning cached invalid PAN to GST response for client: ${storingClient}`);
        return res.json({
          message: "InValid",
          data: resOfPan,
          success: false,
        });
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      kycLogger.warn(`Active service not found for PAN to GST category ${categoryId}, service ${serviceId}`);
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    kycLogger.info(`Active service selected for PAN to GST verification: ${service.serviceFor}`);
    let response = await PANtoGSTActiveServiceResponse(panNumber, service, 0);

    kycLogger.info(
      `Response received from active service ${service.serviceFor} for PAN to GST: ${response?.message}`,
    );

    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(response?.result?.PAN);
      const encryptedResponse = { ...response?.result, PAN: encryptedPan };

      const storingData = {
        panNumber: encryptedPan,
        userName: response?.result?.Name,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        status: 1,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panverificationModel.create(storingData);
      kycLogger.info(`Valid PAN to GST response stored and sent to client: ${storingClient}`);

      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      const storingData = {
        panNumber: encryptedPan,
        userName: "",
        response: null,
        status: 2,
        serviceResponse: {},
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panverificationModel.create(storingData);
      kycLogger.info(`Invalid PAN to GST response stored and sent to client: ${storingClient}`);

      const invalidResponse = {
        PAN: panNumber,
        Name: "",
        PAN_Status: "",
        PAN_Holder_Type: "",
      };
      return res
        .status(404)
        .json(createApiResponse(404, invalidResponse, "Failed"));
    }
  } catch (error) {
    kycLogger.error(`System error in PAN to GST verification for client ${storingClient}: ${error.message}`, error);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.verifyPanToAadhaar = async (req, res) => {
  const data = req.body;
  const {
    panNumber,
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
    clientId = "",
  } = data;
  const capitalPanNumber = panNumber?.toUpperCase();
  const isValid = handleValidation("pan", capitalPanNumber, res);
  if (!isValid) return;

  kycLogger.info("All inputs in pan are valid, continue processing...");

  const storingClient = req.clientId || clientId;

  try {
    kycLogger.info(`Executing PAN to Aadhaar verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`);

    const identifierHash = hashIdentifiers({
      panNo: capitalPanNumber,
    });

    const panRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!panRateLimitResult.allowed) {
      kycLogger.warn(`Rate limit exceeded for PAN to Aadhaar verification: client ${storingClient}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: panRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    kycLogger.info(`Generated PAN to Aadhaar txn Id: ${tnId}`);

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment
    );

    if (!maintainanceResponse?.result) {
      kycLogger.error(`Credit deduction failed for PAN to Aadhaar verification: client ${storingClient}, txnId ${tnId}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const encryptedPan = encryptData(capitalPanNumber);

    const existingPanNumber = await panToAadhaarModel.findOne({
      panNumber: encryptedPan,
    });

    const analyticsResult = await AnalyticsDataUpdate(storingClient, serviceId, categoryId);
    if (!analyticsResult.success) {
      kycLogger.warn(`Analytics update failed for PAN to Aadhaar verification: client ${storingClient}, service ${serviceId}`);
    }

    kycLogger.debug(`Checked for existing PAN to Aadhaar record in DB: ${existingPanNumber ? "Found" : "Not Found"}`);
    if (existingPanNumber) {
      if (existingPanNumber?.status == 1) {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: existingPanNumber?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        kycLogger.info(`Returning cached valid PAN to Aadhaar response for client: ${storingClient}`);
        return res.json({
          message: "Valid",
          success: true,
          data: existingPanNumber?.response,
        });
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: {
            pan: panNumber,
            ...findingInValidResponses("panToAadhaar"),
          },
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        kycLogger.info(`Returning cached invalid PAN to Aadhaar response for client: ${storingClient}`);
        return res.json({
          message: "InValid",
          success: false,
          data: {
            pan: panNumber,
            ...findingInValidResponses("panToAadhaar"),
          },
        });
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      kycLogger.warn(`Active service not found for PAN to Aadhaar category ${categoryId}, service ${serviceId}`);
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    kycLogger.info(`Active service selected for PAN to Aadhaar verification: ${service.serviceFor}`);
    const response = await PantoAadhaarActiveServiceResponse(
      panNumber,
      service,
      0,
    );

    kycLogger.info(
      `Response received from active service ${service.serviceFor} for PAN to Aadhaar: ${response?.message}`,
    );

    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(response?.result?.panNumber);
      const encryptedResponse = {
        ...response?.result,
        panNumber: encryptedPan,
      };
      const storingData = {
        panNumber: encryptedPan,
        response: encryptedResponse,
        aadhaarNumber: response?.result?.aadhaarNumber,
        serviceResponse: response?.responseOfService,
        status: 1,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panToAadhaarModel.create(storingData);
      kycLogger.info(`Valid PAN to Aadhaar response stored and sent to client: ${storingClient}`);
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      kycLogger.info(`Invalid PAN to Aadhaar response received and sent to client: ${storingClient}`);
      return res.status(404).json(
        createApiResponse(
          404,
          {
            panNumber: panNumber,
            ...findingInValidResponses("panToAadhaar"),
          },
          "InValid",
        ),
      );
    }
  } catch (error) {
    kycLogger.error(`System error in PAN to Aadhaar verification for client ${storingClient}: ${error.message}`, error);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

