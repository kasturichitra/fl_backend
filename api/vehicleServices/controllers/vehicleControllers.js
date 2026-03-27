const { deductCredits } = require("../../../services/CreditService");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const {
  encryptData,
  decryptData,
} = require("../../../utils/EncryptAndDecrypt");
const { mapError } = require("../../../utils/errorCodes");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const { findingInValidResponses } = require("../../../utils/InvalidResponses");
const handleValidation = require("../../../utils/lengthCheck");
const {
  vehicleRcVerificationServiceResponse,
  stolenVehicleVerificationServiceResponse,
  challanViaRcServiceResponse,
  drivingLicenseServiceResponse,
  vehicleRegisterationVerificationServiceResponse,
} = require("../service/vehicleServiceResp");
const { vehicleServiceLogger } = require("../../Logger/logger");
const { selectService } = require("../../service/serviceSelector");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const challanViaRcModel = require("../models/challanViaRcModel");
const drivingLicenseModel = require("../models/drivingLicenseModel");
const rcVerificationModel = require("../models/rcVerificationModel");
const stolenVehicleModel = require("../models/stolenVehicleModel");
const vehicleRegisterationModel = require("../models/vehicleRegisterationModel");

exports.handleRcVerification = async (req, res) => {
  const data = req.body;
  const { rcNumber, mobileNumber = "" } = data;
  const capitalRcNumber = rcNumber?.toUpperCase();
  console.log("req coming in rc verification ===>>", req?.baseUrl);

  const isValid = handleValidation("rc", capitalRcNumber, res);
  if (!isValid) return;

  vehicleServiceLogger.info(
    "All inputs in Rc verification are valid, continue processing...",
  );

  const storingClient = req.clientId;

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "RC_VERIFICATION",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    vehicleServiceLogger.info(
      `Executing Rc verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Always generate txnId
    const tnId = genrateUniqueServiceId();
    vehicleServiceLogger.info(
      `Generated Rc verification txn Id: ${tnId} for the client: ${storingClient}`,
    );

    const identifierHash = hashIdentifiers({
      rcNo: capitalRcNumber,
    });

    const rcRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!rcRateLimitResult.allowed) {
      vehicleServiceLogger.warn(
        `Rate limit exceeded for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: rcRateLimitResult.message,
      });
    }

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      vehicleServiceLogger.error(
        `Credit deduction failed for PAN verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedRc = encryptData(capitalRcNumber);

    const existingVehicleNumber = await rcVerificationModel.findOne({
      rcNumber: encryptedRc,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      vehicleServiceLogger.warn(
        `Analytics update failed for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    vehicleServiceLogger.debug(
      `Checked for existing PAN record in DB: ${existingRcNumber ? "Found" : "Not Found"}`,
    );
    if (existingRcNumber) {
      const decryptedPanNumber = decryptData(existingRcNumber?.rcNumber);
      const resOfRc = existingRcNumber?.response;

      if (existingRcNumber?.status == 1) {
        const decryptedResponse = {
          ...existingRcNumber?.response,
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
        vehicleServiceLogger.info(
          `Returning cached valid PAN response for client: ${storingClient}`,
        );
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
          result: resOfRc,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        vehicleServiceLogger.info(
          `Returning cached invalid PAN response for client: ${storingClient}`,
        );
        return res.json({
          message: "Invalid",
          data: resOfRc,
          success: false,
        });
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      vehicleServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    vehicleServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let rcNumberResponse = await vehicleRcVerificationServiceResponse(
      rcNumber,
      service,
      0,
    );

    vehicleServiceLogger.info(
      `Response received from active service ${rcNumberResponse?.service}: ${rcNumberResponse?.message}`,
    );

    if (rcNumberResponse?.message?.toUpperCase() == "VALID") {
      const encryptedRc = encryptData(rcNumberResponse?.result?.PAN);
      const encryptedResponse = {
        ...rcNumberResponse?.result,
        rcNumber: encryptedRc,
      };

      const storingData = {
        rcNumber: encryptedRc,
        userName: rcNumberResponse?.result?.Name,
        response: encryptedResponse,
        serviceResponse: rcNumberResponse?.responseOfService,
        status: 1,
        mobileNumber,
        serviceName: rcNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await rcVerificationModel.create(storingData);
      vehicleServiceLogger.info(
        `Valid RC Verification response stored and sent to client: ${storingClient}`,
      );

      return res.status(200).json(
        createApiResponse(
          200,
          {
            rcNumber: rcNumber,
          },
          "Valid",
        ),
      );
    } else {
      const storingData = {
        rcNumber: encryptedRc,
        userName: "",
        response: { rcNumber: rcNumber },
        serviceResponse: rcNumberResponse?.responseOfService,
        status: 2,
        mobileNumber,
        serviceName: rcNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await rcVerificationModel.create(storingData);
      vehicleServiceLogger.info(
        `Invalid PAN response received and sent to client: ${storingClient}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            rcNumber: rcNumber,
          },
          "Invalid",
        ),
      );
    }
  } catch (error) {
    vehicleServiceLogger.error(
      `System error in RC verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleVehicleRegisteration = async (req, res) => {
  const data = req.body;
  const { RegistrationNumber, mobileNumber = "" } = data;
  const capitalRegisterationNumber = RegistrationNumber?.toUpperCase();
  const storingClient = req.clientId;

  const isValid = handleValidation(
    "vehicleNumber",
    capitalRegisterationNumber,
    res,
    storingClient,
  );
  if (!isValid) return;

  vehicleServiceLogger.info(
    "All inputs in Rc verification are valid, continue processing...",
  );

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "RC_VERIFICATION",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    vehicleServiceLogger.info(
      `Executing Rc verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Always generate txnId
    const tnId = genrateUniqueServiceId();
    vehicleServiceLogger.info(
      `Generated Rc verification txn Id: ${tnId} for the client: ${storingClient}`,
    );

    const identifierHash = hashIdentifiers({
      vehicleNo: capitalRegisterationNumber,
    });

    const vehicleNoRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!vehicleNoRateLimitResult.allowed) {
      vehicleServiceLogger.warn(
        `Rate limit exceeded for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: vehicleNoRateLimitResult.message,
      });
    }

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      vehicleServiceLogger.error(
        `Credit deduction failed for PAN verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedVehicleNo = encryptData(capitalRegisterationNumber);

    const existingVehicleNumber = await vehicleRegisterationModel.findOne({
      RegistrationNumber: encryptedVehicleNo,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      vehicleServiceLogger.warn(
        `Analytics update failed for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    vehicleServiceLogger.info(
      `Checked for existing PAN record in DB: ${existingVehicleNumber ? "Found" : "Not Found"} for this client: ${storingClient}`,
    );
    if (existingVehicleNumber) {
      const decryptedPanNumber = decryptData(existingVehicleNumber?.rcNumber);
      const resOfvehicleRegister = existingVehicleNumber?.response;

      if (existingVehicleNumber?.status == 1) {
        const decryptedResponse = {
          ...existingVehicleNumber?.response,
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
        vehicleServiceLogger.info(
          `Returning cached valid PAN response for client: ${storingClient}`,
        );
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
          result: resOfvehicleRegister,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        vehicleServiceLogger.info(
          `Returning cached invalid PAN response for client: ${storingClient}`,
        );
        return res.json({
          message: "Invalid",
          data: resOfvehicleRegister,
          success: false,
        });
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      vehicleServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    vehicleServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let rcNumberResponse =
      await vehicleRegisterationVerificationServiceResponse(
        rcNumber,
        service,
        0,
        storingClient,
      );

    vehicleServiceLogger.info(
      `Response received from active service ${service.serviceFor}: ${rcNumberResponse?.message}`,
    );

    if (rcNumberResponse?.message?.toUpperCase() == "VALID") {
      const encryptedRc = encryptData(rcNumberResponse?.result?.PAN);
      const encryptedResponse = {
        ...rcNumberResponse?.result,
        PAN: encryptedRc,
      };

      const storingData = {
        rcNumber: encryptedRc,
        userName: rcNumberResponse?.result?.Name,
        response: encryptedResponse,
        serviceResponse: rcNumberResponse?.responseOfService,
        status: 1,
        mobileNumber,
        serviceName: rcNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await vehicleRegisterationModel.create(storingData);
      vehicleServiceLogger.info(
        `Valid PAN response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      const storingData = {
        rcNumber: encryptedRc,
        userName: "",
        response: { rcNumber: rcNumber },
        serviceResponse: rcNumberResponse?.responseOfService,
        status: 2,
        mobileNumber,
        serviceName: rcNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await vehicleRegisterationModel.create(storingData);
      vehicleServiceLogger.info(
        `Invalid vehicle registeration response received and sent to client: ${storingClient}`,
      );
      return res
        .status(404)
        .json(
          createApiResponse(
            404,
            { RegistrationNumber: RegistrationNumber },
            "Invalid",
          ),
        );
    }
  } catch (error) {
    vehicleServiceLogger.error(
      `System error in RC verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleStolenVehicleVerification = async (req, res) => {
  const data = req.body;
  const { vehicleRegisterationNumber, mobileNumber = "" } = data;

  const capitalVehicleNumber = vehicleRegisterationNumber?.toUpperCase();
  const storingClient = req.clientId;

  const isValid = handleValidation(
    "vehicleNo",
    capitalVehicleNumber,
    res,
    storingClient,
  );
  if (!isValid) return;

  vehicleServiceLogger.info(
    "All inputs in pan are valid, continue processing...",
  );

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "RC_VERIFICATION",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    vehicleServiceLogger.info(
      `Executing PAN verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Always generate txnId
    const tnId = genrateUniqueServiceId();
    vehicleServiceLogger.info(
      `Generated PAN txn Id: ${tnId} for the client: ${storingClient}`,
    );

    const identifierHash = hashIdentifiers({
      panNo: capitalVehicleNumber,
    });

    const stolenVehicleVerificationLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!stolenVehicleVerificationLimitResult.allowed) {
      vehicleServiceLogger.warn(
        `Rate limit exceeded for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: stolenVehicleVerificationLimitResult.message,
      });
    }

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      vehicleServiceLogger.error(
        `Credit deduction failed for PAN verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedVehicleNo = encryptData(capitalVehicleNumber);

    const existingVehicleNumber = await stolenVehicleModel.findOne({
      vehicleRegisterationNumber: encryptedVehicleNo,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      vehicleServiceLogger.warn(
        `Analytics update failed for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    vehicleServiceLogger.debug(
      `Checked for existing PAN record in DB: ${existingVehicleNumber ? "Found" : "Not Found"} for this client: ${storingClient}`,
    );
    if (existingVehicleNumber) {
      const decryptedVehicleNumber = decryptData(
        existingVehicleNumber?.vehicleRegisterationNumber,
      );
      const resOfPan = existingVehicleNumber?.response;

      if (existingVehicleNumber?.status == 1) {
        const decryptedResponse = {
          ...existingVehicleNumber?.response,
          PAN: decryptedVehicleNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: decryptedResponse,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        vehicleServiceLogger.info(
          `Returning cached valid PAN response for client: ${storingClient}`,
        );
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
        vehicleServiceLogger.info(
          `Returning cached invalid PAN response for client: ${storingClient}`,
        );
        return res.json({
          message: "Invalid",
          data: resOfPan,
          success: false,
        });
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      vehicleServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    vehicleServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let VehicleNumberResponse = await stolenVehicleVerificationServiceResponse(
      panNumber,
      service,
      0,
    );

    vehicleServiceLogger.info(
      `Response received from active service ${service.serviceFor}: ${VehicleNumberResponse?.message}`,
    );

    if (VehicleNumberResponse?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(VehicleNumberResponse?.result?.PAN);
      const encryptedResponse = {
        ...VehicleNumberResponse?.result,
        PAN: encryptedPan,
      };

      const storingData = {
        vehicleRegisterationNumber: encryptedPan,
        response: encryptedResponse,
        serviceResponse: VehicleNumberResponse?.responseOfService,
        status: 1,
        mobileNumber,
        serviceName: VehicleNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await stolenVehicleModel.create(storingData);
      vehicleServiceLogger.info(
        `Valid stolen vehicle verification response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      const storingData = {
        vehicleRegisterationNumber: encryptedPan,
        response: findingInValidResponses("panBasic"),
        serviceResponse: {},
        status: 2,
        mobileNumber,
        serviceName: VehicleNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await stolenVehicleModel.create(storingData);
      vehicleServiceLogger.info(
        `Invalid PAN response received and sent to client: ${storingClient}`,
      );
      return res
        .status(404)
        .json(
          createApiResponse(
            404,
            { vehicleRegisterationNumber: RegistrationNumber },
            "Invalid",
          ),
        );
    }
  } catch (error) {
    vehicleServiceLogger.error(
      `System error in Stolen Vehicle verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleChallanViaRc = async (req, res) => {
  const data = req.body;
  const { rcNumber, mobileNumber = "", clientId = "" } = data;
  const capitalRcNumber = rcNumber?.toUpperCase();
  console.log("req coming in pan ===>>", req?.baseUrl);
  const storingClient = req.clientId || clientId;

  const isValid = handleValidation("rc", capitalRcNumber, res, storingClient);
  if (!isValid) return;

  vehicleServiceLogger.info(
    "All inputs in pan are valid, continue processing...",
  );

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "CHALLAN_VIA_RC",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    vehicleServiceLogger.info(
      `Executing PAN verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Always generate txnId
    const tnId = genrateUniqueServiceId();
    vehicleServiceLogger.info(
      `Generated challan via rc txn Id: ${tnId} for the client: ${storingClient}`,
    );

    const identifierHash = hashIdentifiers({
      rcNumber: capitalRcNumber,
    });

    const challanViaRcRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!challanViaRcRateLimitResult.allowed) {
      vehicleServiceLogger.warn(
        `Rate limit exceeded for challan via rc for the client ${storingClient}, service: ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: challanViaRcRateLimitResult.message,
      });
    }

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      vehicleServiceLogger.error(
        `Credit deduction failed for challan via rc for the client: ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedRc = encryptData(capitalRcNumber);

    const existingPanNumber = await challanViaRcModel.findOne({
      rcNumber: encryptedRc,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      vehicleServiceLogger.warn(
        `Analytics update failed for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    vehicleServiceLogger.debug(
      `Checked for existing PAN record in DB: ${existingPanNumber ? "Found" : "Not Found"}`,
    );
    if (existingPanNumber) {
      const decryptedPanNumber = decryptData(existingPanNumber?.rcNumber);
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
        vehicleServiceLogger.info(
          `Returning cached valid PAN response for client: ${storingClient}`,
        );
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
        vehicleServiceLogger.info(
          `Returning cached invalid PAN response for client: ${storingClient}`,
        );
        return res.json({
          message: "Invalid",
          data: resOfPan,
          success: false,
        });
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      vehicleServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    vehicleServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let challanViaRcResponse = await challanViaRcServiceResponse(
      rcNumber,
      service,
      0,
      storingClient
    );

    vehicleServiceLogger.info(
      `Response received from active service ${challanViaRcResponse?.service}: ${challanViaRcResponse?.message}`,
    );

    if (challanViaRcResponse?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(challanViaRcResponse?.result?.PAN);
      const encryptedResponse = {
        ...challanViaRcResponse?.result,
        PAN: encryptedPan,
      };

      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: challanViaRcResponse?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        panNumber: encryptedPan,
        userName: challanViaRcResponse?.result?.Name,
        response: encryptedResponse,
        serviceResponse: challanViaRcResponse?.responseOfService,
        status: 1,
        mobileNumber,
        serviceName: challanViaRcResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await challanViaRcModel.create(storingData);
      vehicleServiceLogger.info(
        `Valid PAN response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: { pan: panNumber, ...findingInValidResponses("panBasic") },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        userName: "",
        response: findingInValidResponses("panBasic"),
        serviceResponse: challanViaRcResponse?.responseOfService,
        status: 2,
        mobileNumber,
        serviceName: challanViaRcResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await challanViaRcModel.create(storingData);
      vehicleServiceLogger.info(
        `Invalid PAN response received and sent to client: ${storingClient}`,
      );
      return res
        .status(404)
        .json(
          createApiResponse(
            404,
            { rcNumber: rcNumber },
            "Invalid",
          ),
        );
    }
  } catch (error) {
    vehicleServiceLogger.error(
      `System error in Challan via Rc verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleDrivingLicenseVerification = async (req, res) => {
  const data = req.body;
  const {
    licenseNo,
    DateOfBirth,
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
  } = data;
  const capitalLicenseNumber = licenseNo?.toUpperCase();
  const storingClient = req.clientId || "CID-6140971541";

  const isLicenseNoValid = handleValidation(
    "license",
    capitalLicenseNumber,
    res,
    storingClient,
  );
  if (!isLicenseNoValid) return;

  const isDobValid = handleValidation(
    "StrictDateOfBirth",
    DateOfBirth,
    res,
    storingClient,
  );
  if (!isDobValid) return;

  vehicleServiceLogger.info(
    "All inputs in pan are valid, continue processing...",
  );

  try {
    vehicleServiceLogger.info(
      `Executing driving license verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Always generate txnId
    const tnId = genrateUniqueServiceId();
    vehicleServiceLogger.info(
      `Generated driving license txn Id: ${tnId} for the client: ${storingClient}`,
    );

    // const identifierHash = hashIdentifiers({
    //   licenseNo: capitalLicenseNumber,
    // });

    // const drivingLicenseLimitResult = await checkingRateLimit({
    //   identifiers: { identifierHash },
    //   serviceId,
    //   categoryId,
    //   clientId: storingClient,
    // });

    // if (!drivingLicenseLimitResult.allowed) {
    //   vehicleServiceLogger.warn(
    //     `Rate limit exceeded for driving license verification: client ${storingClient}, service: ${serviceId} category: ${categoryId}`,
    //   );
    //   return res.status(429).json({
    //     success: false,
    //     message: drivingLicenseLimitResult.message,
    //   });
    // }

    // const maintainanceResponse = await deductCredits(
    //   storingClient,
    //   serviceId,
    //   categoryId,
    //   tnId,
    //   req.environment || "test",
    // );

    // if (!maintainanceResponse?.result) {
    //   vehicleServiceLogger.error(
    //     `Credit deduction failed for driving license verification: client ${storingClient}, txnId ${tnId}`,
    //   );
    //   return res.status(500).json({
    //     success: false,
    //     message: maintainanceResponse?.message || "Invalid",
    //     response: {},
    //   });
    // }

    const encryptedLicenseNo = encryptData(capitalLicenseNumber);

    const existingLicenseNumber = await drivingLicenseModel.findOne({
      licenseNumber: encryptedLicenseNo,
      DateOfBirth: DateOfBirth,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      vehicleServiceLogger.warn(
        `Analytics update failed for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    vehicleServiceLogger.debug(
      `Checked for existing PAN record in DB: ${existingLicenseNumber ? "Found" : "Not Found"}`,
    );
    if (existingLicenseNumber) {
      const decryptedPanNumber = decryptData(
        existingLicenseNumber?.licenseNumber,
      );
      const resOfDl = existingLicenseNumber?.response;

      if (existingLicenseNumber?.status == 1) {
        const decryptedResponse = {
          ...existingLicenseNumber?.response,
          "Driving License Number": decryptedPanNumber,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: decryptedResponse,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        vehicleServiceLogger.info(
          `Returning cached valid PAN response for client: ${storingClient}`,
        );
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
          result: resOfDl,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        vehicleServiceLogger.info(
          `Returning cached invalid driving license response for client: ${storingClient}`,
        );
        return res.json({
          message: "Invalid",
          data: resOfDl,
          success: false,
        });
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      vehicleServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    vehicleServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let licenseNoResponse = await drivingLicenseServiceResponse(
      { capitalLicenseNumber, DateOfBirth },
      service,
      0,
      storingClient,
    );

    vehicleServiceLogger.info(
      `Response received from driving license verification active service ${licenseNoResponse?.service} with message: ${licenseNoResponse?.message} of data: ${JSON.stringify(licenseNoResponse?.result)}`,
    );

    if (licenseNoResponse?.message?.toLowerCase() === "all services failed") {
      throw new Error("All driving license services failed");
    }

    if (licenseNoResponse?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...licenseNoResponse?.result,
        "Driving License Number": encryptedLicenseNo,
      };

      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: licenseNoResponse?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        licenseNumber: encryptedLicenseNo,
        response: encryptedResponse,
        DateOfBirth: DateOfBirth,
        serviceResponse: licenseNoResponse?.responseOfService,
        status: 1,
        ...(mobileNumber && { mobileNumber }),
        serviceId: `${licenseNoResponse?.service}_drivingLicense`,
        serviceName: licenseNoResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await drivingLicenseModel.create(storingData);
      vehicleServiceLogger.info(
        `Valid PAN response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, licenseNoResponse?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: {
          licenseNumber: licenseNo,
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        licenseNumber: encryptedLicenseNo,
        response: {
          licenseNumber: licenseNo,
        },
        DateOfBirth: DateOfBirth,
        serviceResponse: licenseNoResponse?.responseOfService,
        status: 2,
        ...(mobileNumber && { mobileNumber }),
        serviceId: `${licenseNoResponse?.service}_drivingLicense`,
        serviceName: licenseNoResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await drivingLicenseModel.create(storingData);
      vehicleServiceLogger.info(
        `Invalid PAN response received and sent to client: ${storingClient}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { licenseNumber: licenseNo }, "Invalid"));
    }
  } catch (error) {
    vehicleServiceLogger.error(
      `System error in driving License verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
