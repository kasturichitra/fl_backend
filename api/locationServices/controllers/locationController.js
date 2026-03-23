const { deductCredits } = require("../../../services/CreditService");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const { encryptData } = require("../../../utils/EncryptAndDecrypt");
const { mapError } = require("../../../utils/errorCodes");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const { findingInValidResponses } = require("../../../utils/InvalidResponses");
const handleValidation = require("../../../utils/lengthCheck");
const {
  pincodeGeofencingActiveServiceResponse,
  longLatGeofencingActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/locationServicesResp");
const { locationServiceLogger } = require("../../Logger/logger");
const { selectService } = require("../../service/serviceSelector");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const longLatGeofencingModel = require("../models/longLatGeofencingModel");
const pincodeGeofencingModel = require("../models/pincodeGeofencingModel");

exports.handlePincodeGeofencing = async (req, res) => {
  const { pincode, mobileNumber = "" } = req.body;

  const clientId = req.clientId || "CID-6140971541";

  locationServiceLogger.info(
    `pincode Details ===>> pincode: ${pincode} for this client: ${clientId}`,
  );

  const isValid = handleValidation("pincode", pincode, res, clientId);
  if (!isValid) return;

  const { idOfCategory, idOfService } =
    getCategoryIdAndServiceId("PINCODE_GEOFENCING");
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  locationServiceLogger.info(
    `Executing pincode geofencing for client: ${clientId}, service: ${idOfService}, category: ${idOfCategory}`,
  );

  try {
    const identifierHash = hashIdentifiers({
      pin: pincode,
    });

    const pincodeGeofencingRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      idOfService,
      idOfCategory,
      clientId: clientId,
    });

    if (!pincodeGeofencingRateLimitResult.allowed) {
      locationServiceLogger.warn(
        `Rate limit exceeded for GSTIN verification: client ${clientId}, service ${idOfService}`,
      );
      return res.status(429).json({
        success: false,
        message: pincodeGeofencingRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    locationServiceLogger.info(
      `Generated pincode geofencing txn Id: ${tnId} for this client: ${clientId}`,
    );

    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      idOfCategory,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      locationServiceLogger.error(
        `Credit deduction failed for GSTIN verification: client ${clientId}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const encryptedGst = encryptData(pincode);

    // Check if the record is present in the DB
    const existingGstin = await pincodeGeofencingModel.findOne({
      pincode: encryptedGst,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      locationServiceLogger.warn(
        `Analytics update failed for GSTIN verification: client ${clientId}, service ${serviceId}`,
      );
    }

    locationServiceLogger.debug(
      `Checked for existing GSTIN record in DB: ${existingGstin ? "Found" : "Not Found"}`,
    );
    if (existingGstin) {
      if (existingGstin?.status == 1) {
        locationServiceLogger.info(
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
        locationServiceLogger.info(
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
      locationServiceLogger.warn(
        `Active service not found for GSTIN category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    locationServiceLogger.info(
      `Active service selected for GSTIN verification: ${service.serviceFor}`,
    );

    //  get Acitve Service Response
    let response = await pincodeGeofencingActiveServiceResponse(
      gstinNumber,
      service,
      0,
    );
    locationServiceLogger.info(
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

      await pincodeGeofencingModel.create(storingData);
      locationServiceLogger.info(
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

      await pincodeGeofencingModel.create(storingData);
      locationServiceLogger.info(
        `Invalid GSTIN response received and sent to client: ${clientId}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { gstinNumber }, "Failed"));
    }
  } catch (error) {
    locationServiceLogger.error(
      `System error in GSTIN verification for client ${clientId}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleLongLatGeofencing = async (req, res) => {
  const {
    latitude,
    longitude,
    serviceId = "",
    categoryId = "",
    mobileNumber = "",
  } = req.body;

  const clientId = req.clientId || "CID-6140971541";

  locationServiceLogger.info(
    `latitude and longitude Details ===>> gstinNumber: ${gstinNumber} for this client: ${clientId}`,
  );

  try {
    const isLatValid = handleValidation("latitude", latitude, res);
    if (!isLatValid) return;
    const isLongValid = handleValidation("longitude", longitude, res);
    if (!isLongValid) return;

    locationServiceLogger.info(
      `Executing longLat geofencing for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );

    const identifierHash = hashIdentifiers({
      lat: latitude,
      long: longitude,
    });

    const longLatGeofencingRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: clientId,
    });

    if (!longLatGeofencingRateLimitResult.allowed) {
      locationServiceLogger.warn(
        `Rate limit exceeded for GSTIN verification: client ${clientId}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: longLatGeofencingRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    locationServiceLogger.info(
      `Generated longLat geofencing txn Id: ${tnId} for this client: ${clientId}`,
    );

    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      locationServiceLogger.error(
        `Credit deduction failed for GSTIN verification: client ${clientId}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const encryptedLatitude = encryptData(latitude);
    const encryptedLongitude = encryptData(longitude);

    // Check if the record is present in the DB
    const existingGstin = await longLatGeofencingModel.findOne({
      longitude: encryptedLongitude,
      latitude: encryptedLatitude,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      locationServiceLogger.warn(
        `Analytics update failed for GSTIN verification: client ${clientId}, service ${serviceId}`,
      );
    }

    locationServiceLogger.debug(
      `Checked for existing GSTIN record in DB: ${existingGstin ? "Found" : "Not Found"}`,
    );
    if (existingGstin) {
      if (existingGstin?.status == 1) {
        locationServiceLogger.info(
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
        locationServiceLogger.info(
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
      locationServiceLogger.warn(
        `Active service not found for GSTIN category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    locationServiceLogger.info(
      `Active service selected for GSTIN verification: ${service.serviceFor}`,
    );

    //  get Acitve Service Response
    let response = await longLatGeofencingActiveServiceResponse(
      gstinNumber,
      service,
      0,
    );
    locationServiceLogger.info(
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

      await longLatGeofencingModel.create(storingData);
      locationServiceLogger.info(
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

      await longLatGeofencingModel.create(storingData);
      locationServiceLogger.info(
        `Invalid GSTIN response received and sent to client: ${clientId}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { gstinNumber }, "Failed"));
    }
  } catch (error) {
    locationServiceLogger.error(
      `System error in GSTIN verification for client ${clientId}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
