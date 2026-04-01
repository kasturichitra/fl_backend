const { deductCredits } = require("../../../services/CreditService");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
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
  longLatToDigiPinActiveServiceResponse,
  digipinToLongLatActiveServiceResponse,
  addressToDigiPinActiveServiceResponse,
  geoTaggingActiveServiceResponse,
} = require("../service/locationServicesResp");
const { locationServiceLogger } = require("../../Logger/logger");
const { selectService } = require("../../service/serviceSelector");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const addressToDigiPinModel = require("../models/addressToDigiPinModel");
const digiPinToLongLatModel = require("../models/digiPinToLongLatModel");
const longLatGeofencingModel = require("../models/longLatGeofencingModel");
const longLatToDigiPinModel = require("../models/longLatToDigiPinModel");
const pincodeGeofencingModel = require("../models/pincodeGeofencingModel");

exports.handlePincodeGeofencing = async (req, res) => {
  const { pincode, mobileNumber = "" } = req.body;

  const clientId = req.clientId || "CID-6140971541";

  locationServiceLogger.info(
    `pincode Details ===>> pincode: ${pincode} for this client: ${clientId}`,
  );

  const isValid = handleValidation("pincode", pincode, res, clientId);
  if (!isValid) return;

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "PINCODE_GEOFENCING",
    clientId,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  locationServiceLogger.info(
    `Executing pincode geofencing for client: ${clientId}, service: ${idOfService}, category: ${idOfCategory}`,
  );

  try {
    // const identifierHash = hashIdentifiers({
    //   pin: pincode,
    // });

    // const pincodeGeofencingRateLimitResult = await checkingRateLimit({
    //   identifiers: { identifierHash },
    //   serviceId: idOfService,
    //   categoryId: idOfCategory,
    //   clientId: clientId,
    // });

    // if (!pincodeGeofencingRateLimitResult.allowed) {
    //   locationServiceLogger.warn(
    //     `Rate limit exceeded for GSTIN verification: client ${clientId}, service ${idOfService}`,
    //   );
    //   return res.status(429).json({
    //     success: false,
    //     message: pincodeGeofencingRateLimitResult.message,
    //   });
    // }

    // const tnId = genrateUniqueServiceId();
    // locationServiceLogger.info(
    //   `Generated pincode geofencing txn Id: ${tnId} for this client: ${clientId}`,
    // );

    // const maintainanceResponse = await deductCredits(
    //   clientId,
    //   serviceId,
    //   idOfCategory,
    //   tnId,
    //   req,
    // );

    // if (!maintainanceResponse?.result) {
    //   locationServiceLogger.error(
    //     `Credit deduction failed for GSTIN verification: client ${clientId}, txnId ${tnId}`,
    //   );
    //   return res.status(500).json({
    //     success: false,
    //     message: maintainanceResponse?.message || "Invalid",
    //     response: {},
    //   });
    // }

    const encryptedPincode = encryptData(pincode);

    // Check if the record is present in the DB
    const existingPincode = await pincodeGeofencingModel.findOne({
      pincode: encryptedPincode,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      idOfService,
      idOfCategory,
    );
    if (!analyticsResult.success) {
      locationServiceLogger.info(
        `Analytics update failed for pincode geofencing for this client: ${clientId} with service: ${idOfService} and category: ${idOfCategory}`,
      );
    }

    locationServiceLogger.info(
      `Checked for existing pincode geofencing record in DB: ${existingPincode ? "Found" : "Not Found"}`,
    );
    if (existingPincode) {
      if (existingPincode?.status == 1) {
        locationServiceLogger.info(
          `Returning cached GSTIN response for client: ${clientId}`,
        );

        const decrypted = {
          ...existingPincode?.response,
          gstinNumber: gstinNumber,
        };
        await responseModel.create({
          serviceId: idOfService,
          categoryId: idOfCategory,
          clientId,
          result: existingPincode?.response,
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
          serviceId: idOfService,
          categoryId: idOfCategory,
          clientId,
          result: existingPincode?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingPincode?.response;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      }
    }

    // Get All Active Services
    const service = await selectService(idOfCategory, idOfService);
    if (!service) {
      locationServiceLogger.warn(
        `Active service not found for GSTIN category ${idOfCategory}, service ${idOfService}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    locationServiceLogger.info(
      `Active service selected for GSTIN verification: ${service.serviceFor}`,
    );

    //  get Acitve Service Response
    let response = await pincodeGeofencingActiveServiceResponse(
      pincode,
      service,
      0,
      clientId,
    );
    locationServiceLogger.info(
      `Response received from active service ${service.serviceFor}: ${response?.message}`,
    );

    // Response form Active Service if response message is Valid
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        gstinNumber: encryptedPincode,
      };
      await responseModel.create({
        serviceId: idOfService,
        categoryId: idOfCategory,
        clientId,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 1,
        pincode: encryptedPincode,
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
        serviceId: idOfService,
        categoryId: idOfCategory,
        clientId,
        result: {
          pincode: pincode,
          ...findingInValidResponses("pincode"),
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 2,
        pincode: encryptedPincode,
        response: {
          pincode: pincode,
          ...findingInValidResponses("pincode"),
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
        `Invalid pincode geofencing response received and sent to client: ${clientId}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            pincode: pincode,
            ...findingInValidResponses("pincode"),
          },
          "Invalid",
        ),
      );
    }
  } catch (error) {
    locationServiceLogger.error(
      `System error in pincode geofencing for client ${clientId}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleLongLatGeofencing = async (req, res) => {
  const { latitude, longitude, mobileNumber = "" } = req.body;

  const clientId = req.clientId || "CID-6140971541";

  locationServiceLogger.info(
    `latitude and longitude Details ===>> longitude: ${longitude} and latitude: ${latitude} for this client: ${clientId}`,
  );

  try {
    const isLatValid = handleValidation("latitude", latitude, res, clientId);
    if (!isLatValid) return;
    const isLongValid = handleValidation("longitude", longitude, res, clientId);
    if (!isLongValid) return;

    const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
      "LONG_LAT_GEOFENCING",
    );
    console.log(
      "idOfService and idOfCategory ====>>",
      idOfService,
      idOfCategory,
    );

    locationServiceLogger.info(
      `Executing longLat geofencing for client: ${clientId}, service: ${idOfService}, category: ${idOfCategory}`,
    );

    const identifierHash = hashIdentifiers({
      lat: latitude,
      long: longitude,
    });

    const longLatGeofencingRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId: idOfService,
      categoryId: idOfCategory,
      clientId: clientId,
    });

    if (!longLatGeofencingRateLimitResult.allowed) {
      locationServiceLogger.info(
        `Rate limit exceeded for GSTIN verification: client ${clientId}, service ${idOfService}`,
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
      idOfService,
      idOfCategory,
      tnId,
      req,
    );

    if (!maintainanceResponse?.result) {
      locationServiceLogger.info(
        `[FAILED] Credit deduction failed for GSTIN verification: client ${clientId}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedLatitude = encryptData(latitude);
    const encryptedLongitude = encryptData(longitude);

    // Check if the record is present in the DB
    const existingLongLatGeofencing = await longLatGeofencingModel.findOne({
      longitude: encryptedLongitude,
      latitude: encryptedLatitude,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      idOfService,
      idOfCategory,
    );
    if (!analyticsResult.success) {
      locationServiceLogger.warn(
        `Analytics update failed for GSTIN verification: client ${clientId}, service ${idOfService}`,
      );
    }

    locationServiceLogger.debug(
      `Checked for existing GSTIN record in DB: ${existingLongLatGeofencing ? "Found" : "Not Found"}`,
    );
    if (existingLongLatGeofencing) {
      if (existingLongLatGeofencing?.status == 1) {
        locationServiceLogger.info(
          `Returning cached GSTIN response for client: ${clientId}`,
        );

        const decrypted = {
          ...existingLongLatGeofencing?.response,
          gstinNumber: gstinNumber,
        };
        await responseModel.create({
          serviceId: idOfService,
          categoryId: idOfCategory,
          clientId,
          result: existingLongLatGeofencing?.response,
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
          serviceId: idOfService,
          categoryId: idOfCategory,
          clientId,
          result: existingLongLatGeofencing?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingLongLatGeofencing?.response;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      }
    }

    // Get All Active Services
    const service = await selectService(idOfCategory, idOfService);
    if (!service) {
      locationServiceLogger.warn(
        `Active service not found for long lat Geofencing with category ${idOfCategory}, service ${idOfService}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    locationServiceLogger.info(
      `Active service selected for long lat Geofencing: ${service.serviceFor}`,
    );

    //  get Acitve Service Response
    let response = await longLatGeofencingActiveServiceResponse(
      { longitude, latitude },
      service,
      0,
      clientId,
    );
    locationServiceLogger.info(
      `Response received from active service ${response?.service}: ${response?.message}`,
    );

    // Response form Active Service if response message is Valid
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        gstinNumber: encryptedGst,
      };
      await responseModel.create({
        serviceId: idOfService,
        categoryId: idOfCategory,
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
        serviceId: idOfService,
        categoryId: idOfCategory,
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
      `System error in long lat geofencing for client ${clientId}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleLongLatToDigiPin = async (req, res) => {
  const { latitude, longitude, mobileNumber = "" } = req.body;

  const clientId = req.clientId || "CID-6140971541";

  locationServiceLogger.info(
    `latitude and longitude Details ===>> longitude: ${longitude} and latitude: ${latitude} for this client: ${clientId}`,
  );

  const isLatValid = handleValidation("latitude", latitude, res, clientId);
  if (!isLatValid) return;
  const isLongValid = handleValidation("longitude", longitude, res, clientId);
  if (!isLongValid) return;

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "LONG_LAT_TO_DIGIPIN",
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  locationServiceLogger.info(
    `Executing longLat geofencing for client: ${clientId}, service: ${idOfService}, category: ${idOfCategory}`,
  );
  try {
    const identifierHash = hashIdentifiers({
      lat: latitude,
      long: longitude,
    });

    const longLatGeofencingRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId: idOfService,
      categoryId: idOfCategory,
      clientId: clientId,
    });

    if (!longLatGeofencingRateLimitResult.allowed) {
      locationServiceLogger.info(
        `Rate limit exceeded for GSTIN verification: client ${clientId}, service ${idOfService}`,
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
      idOfService,
      idOfCategory,
      tnId,
      req,
    );

    if (!maintainanceResponse?.result) {
      locationServiceLogger.info(
        `[FAILED] Credit deduction failed for GSTIN verification: client ${clientId}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedLatitude = encryptData(latitude);
    const encryptedLongitude = encryptData(longitude);

    // Check if the record is present in the DB
    const existingGstin = await longLatToDigiPinModel.findOne({
      longitude: encryptedLongitude,
      latitude: encryptedLatitude,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      idOfService,
      idOfCategory,
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
          serviceId: idOfService,
          categoryId: idOfCategory,
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
          serviceId: idOfService,
          categoryId: idOfCategory,
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
    const service = await selectService(idOfCategory, idOfService);
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
    let response = await longLatToDigiPinActiveServiceResponse(
      { longitude, latitude },
      service,
      0,
      clientId,
    );
    locationServiceLogger.info(
      `Response received from active service ${response?.service}: ${response?.message}`,
    );

    // Response form Active Service if response message is Valid
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        gstinNumber: encryptedGst,
      };
      await responseModel.create({
        serviceId: idOfService,
        categoryId: idOfCategory,
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

      await longLatToDigiPinModel.create(storingData);
      locationServiceLogger.info(
        `Valid GSTIN response stored and sent to client: ${clientId}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId: idOfService,
        categoryId: idOfCategory,
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

      await longLatToDigiPinModel.create(storingData);
      locationServiceLogger.info(
        `Invalid GSTIN response received and sent to client: ${clientId}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { gstinNumber }, "Failed"));
    }
  } catch (error) {
    locationServiceLogger.error(
      `System error in long lat to digiPin for client ${clientId}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleDigiPinToLongLat = async (req, res) => {
  const { digiPin, mobileNumber = "" } = req.body;

  const clientId = req.clientId || "CID-6140971541";

  locationServiceLogger.info(
    `digiPin Details ===>> digiPin: ${digiPin} for this client: ${clientId}`,
  );

  const isValid = handleValidation("digipin", digiPin, res, clientId);
  if (!isValid) return;

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "DIGIPIN_TO_LONG_LAT",
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  locationServiceLogger.info(
    `Executing longLat geofencing for client: ${clientId}, service: ${idOfService}, category: ${idOfCategory}`,
  );
  try {
    const identifierHash = hashIdentifiers({
      digiPin: digiPin,
    });

    const longLatGeofencingRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId: idOfService,
      categoryId: idOfCategory,
      clientId: clientId,
    });

    if (!longLatGeofencingRateLimitResult.allowed) {
      locationServiceLogger.info(
        `Rate limit exceeded for GSTIN verification: client ${clientId}, service ${idOfService}`,
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
      idOfService,
      idOfCategory,
      tnId,
      req,
    );

    if (!maintainanceResponse?.result) {
      locationServiceLogger.info(
        `[FAILED] Credit deduction failed for GSTIN verification: client ${clientId}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedLatitude = encryptData(latitude);
    const encryptedLongitude = encryptData(longitude);

    // Check if the record is present in the DB
    const existingGstin = await digiPinToLongLatModel.findOne({
      longitude: encryptedLongitude,
      latitude: encryptedLatitude,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      idOfService,
      idOfCategory,
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
          serviceId: idOfService,
          categoryId: idOfCategory,
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
          serviceId: idOfService,
          categoryId: idOfCategory,
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
    const service = await selectService(idOfCategory, idOfService);
    if (!service) {
      locationServiceLogger.warn(
        `Active service not found for GSTIN category ${idOfCategory}, service ${idOfService}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    locationServiceLogger.info(
      `Active service selected for GSTIN verification: ${service.serviceFor}`,
    );

    //  get Acitve Service Response
    let response = await digipinToLongLatActiveServiceResponse(
      digiPin,
      service,
      0,
      clientId,
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
        serviceId: idOfService,
        categoryId: idOfCategory,
        clientId,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 1,
        digiPin: encryptedGst,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await digiPinToLongLatModel.create(storingData);
      locationServiceLogger.info(
        `Valid GSTIN response stored and sent to client: ${clientId}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId: idOfService,
        categoryId: idOfCategory,
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
          digiPin: digiPin,
          ...findingInValidResponses("gstIn"),
        },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await digiPinToLongLatModel.create(storingData);
      locationServiceLogger.info(
        `Invalid GSTIN response received and sent to client: ${clientId}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { gstinNumber }, "Failed"));
    }
  } catch (error) {
    locationServiceLogger.error(
      `System error in digiPin to long lat for client ${clientId}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleAddressToDigiPin = async (req, res) => {
  const { address, mobileNumber = "" } = req.body;

  const clientId = req.clientId || "CID-6140971541";

  locationServiceLogger.info(
    `digiPin Details ===>> digiPin: ${digiPin} for this client: ${clientId}`,
  );

  const isValid = handleValidation("address", address, res, clientId);
  if (!isValid) return;

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "DIGIPIN_TO_LONG_LAT",
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  locationServiceLogger.info(
    `Executing longLat geofencing for client: ${clientId}, service: ${idOfService}, category: ${idOfCategory}`,
  );
  try {
    const identifierHash = hashIdentifiers({
      digiPin: digiPin,
    });

    const longLatGeofencingRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId: idOfService,
      categoryId: idOfCategory,
      clientId: clientId,
    });

    if (!longLatGeofencingRateLimitResult.allowed) {
      locationServiceLogger.info(
        `Rate limit exceeded for GSTIN verification: client ${clientId}, service ${idOfService}`,
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
      idOfService,
      idOfCategory,
      tnId,
      req,
    );

    if (!maintainanceResponse?.result) {
      locationServiceLogger.info(
        `[FAILED] Credit deduction failed for GSTIN verification: client ${clientId}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedLatitude = encryptData(latitude);
    const encryptedLongitude = encryptData(longitude);

    // Check if the record is present in the DB
    const existingGstin = await addressToDigiPinModel.findOne({
      longitude: encryptedLongitude,
      latitude: encryptedLatitude,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      idOfService,
      idOfCategory,
    );
    if (!analyticsResult.success) {
      locationServiceLogger.warn(
        `Analytics update failed for Address to digipin: client ${clientId}, service ${serviceId}`,
      );
    }

    locationServiceLogger.debug(
      `Checked for existing Address to digipin record in DB: ${existingGstin ? "Found" : "Not Found"}`,
    );
    if (existingGstin) {
      if (existingGstin?.status == 1) {
        locationServiceLogger.info(
          `Returning cached Address to digipin response for client: ${clientId}`,
        );

        const decrypted = {
          ...existingGstin?.response,
          gstinNumber: gstinNumber,
        };
        await responseModel.create({
          serviceId: idOfService,
          categoryId: idOfCategory,
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
          `Returning cached Address to digipin response for client: ${clientId}`,
        );
        await responseModel.create({
          serviceId: idOfService,
          categoryId: idOfCategory,
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
    const service = await selectService(idOfCategory, idOfService);
    if (!service) {
      locationServiceLogger.warn(
        `Active service not found for Address to digipin of category ${idOfCategory}, service ${idOfService}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    locationServiceLogger.info(
      `Active service selected for Address to digipin: ${JSON.stringify(service)}`,
    );

    //  get Acitve Service Response
    let response = await addressToDigiPinActiveServiceResponse(
      address,
      service,
      0,
      clientId,
    );
    locationServiceLogger.info(
      `Response received from active service ${response?.service}: ${response?.message}`,
    );

    // Response form Active Service if response message is Valid
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        gstinNumber: encryptedGst,
      };
      await responseModel.create({
        serviceId: idOfService,
        categoryId: idOfCategory,
        clientId,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 1,
        digiPin: encryptedGst,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await addressToDigiPinModel.create(storingData);
      locationServiceLogger.info(
        `Valid GSTIN response stored and sent to client: ${clientId}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId: idOfService,
        categoryId: idOfCategory,
        clientId,
        result: {
          gstinNumber: gstinNumber,
          ...findingInValidResponses("AddressToDigiPin"),
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 2,
        gstinNumber: encryptedGst,
        response: {
          digiPin: digiPin,
          ...findingInValidResponses("AddressToDigiPin"),
        },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await addressToDigiPinModel.create(storingData);
      locationServiceLogger.info(
        `Invalid GSTIN response received and sent to client: ${clientId}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            digiPin: digiPin,
            ...findingInValidResponses("AddressToDigiPin"),
          },
          "Invalid",
        ),
      );
    }
  } catch (error) {
    locationServiceLogger.error(
      `System error in Address to digipin for client ${clientId}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleGeoTagging = async (req, res) => {
  const { latitude, longitude, mobileNumber = "" } = req.body;

  const clientId = req.clientId || "CID-6140971541";

  locationServiceLogger.info(
    `latitude and longitude Details ===>> longitude: ${longitude} and latitude: ${latitude} for this client: ${clientId}`,
  );

  const isLatValid = handleValidation("latitude", latitude, res, clientId);
  if (!isLatValid) return;
  const isLongValid = handleValidation("longitude", longitude, res, clientId);
  if (!isLongValid) return;

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "GEO_TAGGING",
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  locationServiceLogger.info(
    `Executing longLat geofencing for client: ${clientId}, service: ${idOfService}, category: ${idOfCategory}`,
  );
  try {
    const identifierHash = hashIdentifiers({
      lat: latitude,
      long: longitude,
    });

    const geoTaggingRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId: idOfService,
      categoryId: idOfCategory,
      clientId: clientId,
    });

    if (!geoTaggingRateLimitResult.allowed) {
      locationServiceLogger.info(
        `Rate limit exceeded for GSTIN verification: client ${clientId}, service ${idOfService}`,
      );
      return res.status(429).json({
        success: false,
        message: geoTaggingRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    locationServiceLogger.info(
      `Generated longLat geofencing txn Id: ${tnId} for this client: ${clientId}`,
    );

    const maintainanceResponse = await deductCredits(
      clientId,
      idOfService,
      idOfCategory,
      tnId,
      req,
    );

    if (!maintainanceResponse?.result) {
      locationServiceLogger.info(
        `[FAILED] Credit deduction failed for GSTIN verification: client ${clientId}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedLatitude = encryptData(latitude);
    const encryptedLongitude = encryptData(longitude);

    // Check if the record is present in the DB
    const existingGstin = await longLatToDigiPinModel.findOne({
      longitude: encryptedLongitude,
      latitude: encryptedLatitude,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      idOfService,
      idOfCategory,
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
          serviceId: idOfService,
          categoryId: idOfCategory,
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
          serviceId: idOfService,
          categoryId: idOfCategory,
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
    const service = await selectService(idOfCategory, idOfService);
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
    let response = await geoTaggingActiveServiceResponse(
      { longitude, latitude },
      service,
      0,
      clientId,
    );
    locationServiceLogger.info(
      `Response received from active service ${response?.service}: ${response?.message}`,
    );

    // Response form Active Service if response message is Valid
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        gstinNumber: encryptedGst,
      };
      await responseModel.create({
        serviceId: idOfService,
        categoryId: idOfCategory,
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

      await longLatToDigiPinModel.create(storingData);
      locationServiceLogger.info(
        `Valid GSTIN response stored and sent to client: ${clientId}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId: idOfService,
        categoryId: idOfCategory,
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

      await longLatToDigiPinModel.create(storingData);
      locationServiceLogger.info(
        `Invalid GSTIN response received and sent to client: ${clientId}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { gstinNumber }, "Failed"));
    }
  } catch (error) {
    locationServiceLogger.error(
      `System error in long lat to digiPin for client ${clientId}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleGeoTaggingDistacnceCalculation = async (req, res) => {
  const { address, latitude, longitude, mobileNumber = "" } = req.body;

  const clientId = req.clientId || "CID-6140971541";

  locationServiceLogger.info(
    `digiPin Details ===>> digiPin: ${digiPin} for this client: ${clientId}`,
  );

  const isValid = handleValidation("address", address, res, clientId);
  if (!isValid) return;
  const isLatValid = handleValidation("latitude", latitude, res, clientId);
  if (!isLatValid) return;
  const isLongValid = handleValidation("longitude", longitude, res, clientId);
  if (!isLongValid) return;

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "GEO_TAGGING_DISTANCE_CALCULATION",
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  locationServiceLogger.info(
    `Executing longLat geofencing for client: ${clientId}, service: ${idOfService}, category: ${idOfCategory}`,
  );
  try {
    const identifierHash = hashIdentifiers({
      digiPin: digiPin,
    });

    const geoTaggingDistanceCalculationRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId: idOfService,
      categoryId: idOfCategory,
      clientId: clientId,
    });

    if (!geoTaggingDistanceCalculationRateLimitResult.allowed) {
      locationServiceLogger.info(
        `Rate limit exceeded for GSTIN verification: client ${clientId}, service ${idOfService}`,
      );
      return res.status(429).json({
        success: false,
        message: geoTaggingDistanceCalculationRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    locationServiceLogger.info(
      `Generated longLat geofencing txn Id: ${tnId} for this client: ${clientId}`,
    );

    const maintainanceResponse = await deductCredits(
      clientId,
      idOfService,
      idOfCategory,
      tnId,
      req,
    );

    if (!maintainanceResponse?.result) {
      locationServiceLogger.info(
        `[FAILED] Credit deduction failed for GSTIN verification: client ${clientId}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedLatitude = encryptData(latitude);
    const encryptedLongitude = encryptData(longitude);

    // Check if the record is present in the DB
    const existingDistance = await addressToDigiPinModel.findOne({
      longitude: encryptedLongitude,
      latitude: encryptedLatitude,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      idOfService,
      idOfCategory,
    );
    if (!analyticsResult.success) {
      locationServiceLogger.warn(
        `Analytics update failed for Address to digipin: client ${clientId}, service ${serviceId}`,
      );
    }

    locationServiceLogger.debug(
      `Checked for existing Address to digipin record in DB: ${existingDistance ? "Found" : "Not Found"} for this client: ${clientId}`,
    );
    if (existingDistance) {
      if (existingDistance?.status == 1) {
        locationServiceLogger.info(
          `Returning cached Address to digipin response for client: ${clientId}`,
        );

        const decrypted = {
          ...existingDistance?.response,
          gstinNumber: gstinNumber,
        };
        await responseModel.create({
          serviceId: idOfService,
          categoryId: idOfCategory,
          clientId,
          result: existingDistance?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = decrypted;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      } else {
        locationServiceLogger.info(
          `Returning cached Address to digipin response for client: ${clientId}`,
        );
        await responseModel.create({
          serviceId: idOfService,
          categoryId: idOfCategory,
          clientId,
          result: existingDistance?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingDistance?.response;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      }
    }

    // Get All Active Services
    const service = await selectService(idOfCategory, idOfService);
    if (!service) {
      locationServiceLogger.warn(
        `Active service not found for Address to digipin of category ${idOfCategory}, service ${idOfService}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    locationServiceLogger.info(
      `Active service selected for Address to digipin: ${JSON.stringify(service)}`,
    );

    //  get Acitve Service Response
    let response = await addressToDigiPinActiveServiceResponse(
      address,
      service,
      0,
      clientId,
    );
    locationServiceLogger.info(
      `Response received from active service ${response?.service}: ${response?.message}`,
    );

    // Response form Active Service if response message is Valid
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        gstinNumber: encryptedGst,
      };
      await responseModel.create({
        serviceId: idOfService,
        categoryId: idOfCategory,
        clientId,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 1,
        digiPin: encryptedGst,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await addressToDigiPinModel.create(storingData);
      locationServiceLogger.info(
        `Valid GSTIN response stored and sent to client: ${clientId}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId: idOfService,
        categoryId: idOfCategory,
        clientId,
        result: {
          gstinNumber: gstinNumber,
          ...findingInValidResponses("AddressToDigiPin"),
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 2,
        gstinNumber: encryptedGst,
        response: {
          digiPin: digiPin,
          ...findingInValidResponses("AddressToDigiPin"),
        },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await addressToDigiPinModel.create(storingData);
      locationServiceLogger.info(
        `Invalid GSTIN response received and sent to client: ${clientId}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            digiPin: digiPin,
            ...findingInValidResponses("AddressToDigiPin"),
          },
          "Invalid",
        ),
      );
    }
  } catch (error) {
    locationServiceLogger.error(
      `System error in Address to digipin for client ${clientId}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
