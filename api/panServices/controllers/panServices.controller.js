const panverificationModel = require("../models/panBasic.model");
const panToAadhaarModel = require("../models/panToAadhaarModel");
require("dotenv").config();
const { panServiceLogger } = require("../../Logger/logger");
const {
  encryptData,
  decryptData,
} = require("../../../utils/EncryptAndDecrypt");
const { selectService } = require("../../service/serviceSelector");
const { ERROR_CODES, mapError } = require("../../../utils/errorCodes");
const handleValidation = require("../../../utils/lengthCheck");
const { findingInValidResponses } = require("../../../utils/InvalidResponses");
const { PanActiveServiceResponse } = require("../service/PanBasicResponse");
const {
  PantoAadhaarActiveServiceResponse,
} = require("../service/PantoAadhaarRes");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const { deductCredits } = require("../../../services/CreditService");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const panNameMatch = require("../models/panNameMatch");
const {
  PANNameMatchActiveServiceResponse,
  PANDobActiveServiceResponse,
  PANtoGSTActiveServiceResponse,
  PANDirectorActiveServiceResponse,
  PANToFatherNameActiveServiceResponse,
  panTanActiveServiceResponse,
  PANtoGST_InActiveServiceResponse,
} = require("../service/panServicesResp");
const panNameDob = require("../models/panNameDob");
const panToGstModel = require("../models/panToGstModel");
const panDirectorModel = require("../models/panDirectorModel");
const panFatherNameModel = require("../models/panFatherNameModel");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds");
const panTanModel = require("../models/panTanModel");
const panTogst_inModel = require("../models/panTogst_inModel");
const { SERVICE_TYPES, handlePanVerification, reusablePanNumberFieldVerification, buildInvalidResponse } = require("../reuse/panReusable");

exports.verifyPanBasic = (req, res) =>
  handlePanVerification({
    req,
    res,
    serviceType: SERVICE_TYPES.PAN_BASIC,
    model: panverificationModel,
    activeServiceFn: PanActiveServiceResponse,
    transformValidResponse: (result, encryptedPan) => ({
      ...result,
      PAN: encryptedPan,
    }),
    transformInvalidResponse: (pan) => buildInvalidResponse(pan),
  });

exports.verifyPanToAadhaar = (req, res) =>
  handlePanVerification({
    req,
    res,
    serviceType: SERVICE_TYPES.PAN_TO_AADHAAR,
    model: panToAadhaarModel,
    activeServiceFn: PantoAadhaarActiveServiceResponse,
    transformValidResponse: (result, encryptedPan) => ({
      ...result,
      panNumber: encryptedPan,
    }),
    transformInvalidResponse: (pan) => ({
      panNumber: pan,
    }),
  });

exports.verifyPanToGst = (req, res) =>
  handlePanVerification({
    req,
    res,
    serviceType: SERVICE_TYPES.PAN_TO_GST,
    model: panToGstModel,
    activeServiceFn: PANtoGSTActiveServiceResponse,
    transformValidResponse: (result, encryptedPan) => ({
      ...result,
      PAN: encryptedPan,
    }),
    transformInvalidResponse: (pan) => ({
      pan
    }),
  });

exports.verifyPanToGstIn = (req, res) =>
  handlePanVerification({
    req,
    res,
    serviceType: SERVICE_TYPES.PAN_TO_GST_IN,
    model: panTogst_inModel,
    activeServiceFn: PANtoGST_InActiveServiceResponse,
    transformValidResponse: (result, encryptedPan) => ({
      ...result,
      PAN: encryptedPan,
    }),
    transformInvalidResponse: (pan) => ({ pan }),
  });

exports.verifyPanToDirector = (req, res) =>
  handlePanVerification({
    req,
    res,
    serviceType: SERVICE_TYPES.PAN_TO_GST_IN,
    model: panDirectorModel,
    activeServiceFn: PANDirectorActiveServiceResponse,
    transformValidResponse: (result, encryptedPan) => ({
      ...result,
      PAN: encryptedPan,
    }),
    transformInvalidResponse: (pan) => ({ pan }),
  });

exports.verifyPanToFatherName = (req, res) =>
  handlePanVerification({
    req,
    res,
    serviceType: SERVICE_TYPES.PAN_TO_FATHER_NAME,
    model: panFatherNameModel,
    activeServiceFn: PANToFatherNameActiveServiceResponse,
    transformValidResponse: (result, encryptedPan) => ({
      ...result,
      PAN: encryptedPan,
    }),
    transformInvalidResponse: (pan) => ({ pan }),
  });

exports.verifyPanNameMatch = async (req, res) => {
  const data = req.body;
  const { panNumber, nameToMatch, mobileNumber = "" } = data;

  const storingClient = req.clientId || "CID-6140971541";
  const capitalPanNumber = reusablePanNumberFieldVerification(
    panNumber,
    storingClient,
    res,
  );

  if (!capitalPanNumber) return;

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "PAN_NAME_MATCH",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    panServiceLogger.info(
      `Executing PAN to NameMatch verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // const identifierHash = hashIdentifiers({
    //   panNo: capitalPanNumber,
    //   name: nameToMatch,
    // });

    // const panRateLimitResult = await checkingRateLimit({
    //   identifiers: { identifierHash },
    //   serviceId,
    //   categoryId,
    //   clientId: storingClient,
    //   req
    // });

    // if (!panRateLimitResult.allowed) {
    //   panServiceLogger.warn(
    //     `Rate limit exceeded for PAN NameMatch verification: client ${storingClient}, service ${serviceId}`,
    //   );
    //   return res.status(429).json({
    //     success: false,
    //     message: panRateLimitResult.message,
    //   });
    // }

    // const tnId = genrateUniqueServiceId();
    // panServiceLogger.info(`Generated PAN to Namematch txn Id: ${tnId}`);

    // const maintainanceResponse = await deductCredits(
    //   storingClient,
    //   serviceId,
    //   categoryId,
    //   tnId,
    //   req.environment,
    // );

    // if (!maintainanceResponse?.result) {
    //   panServiceLogger.error(
    //     `Credit deduction failed for PAN NameMatch verification: client ${storingClient}, txnId ${tnId}`,
    //   );
    //   return res.status(500).json({
    //     success: false,
    //     message: maintainanceResponse?.message || "Invalid",
    //     response: {},
    //   });
    // }
    const encryptedPan = encryptData(capitalPanNumber);

    const existingPanNumber = await panNameMatch.findOne({
      panNumber: encryptedPan,
      nameToMatch: nameToMatch,
    });

    panServiceLogger.debug(
      `Checked for existing PAN NameMatch record in DB: ${existingPanNumber ? "Found" : "Not Found"}`,
    );

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      panServiceLogger.warn(
        `Analytics update failed for PAN NameMatch verification: client ${storingClient}, service ${serviceId}`,
      );
    }

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
        panServiceLogger.info(
          `Returning cached valid PAN NameMatch response for client: ${storingClient}`,
        );
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
          },
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        panServiceLogger.info(
          `Returning cached invalid PAN NameMatch response for client: ${storingClient}`,
        );
        return res.json({
          message: "Invalid",
          success: false,
          data: {
            pan: panNumber,
          },
        });
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      panServiceLogger.warn(
        `Active service not found for PAN NameMatch category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    panServiceLogger.info(
      `Active service selected for PAN NameMatch verification: ${service.serviceFor}`,
    );
    const response = await PANNameMatchActiveServiceResponse(
      { panNumber, nameToMatch },
      service,
      0,
      storingClient,
    );

    panServiceLogger.info(
      `Response received from PAN Name Match active service ${response?.service} with message ${response?.message} for the client: ${storingClient} :: ${JSON.stringify(response)}`,
    );

    if (response?.message?.toLowerCase() === "all services failed") {
      throw new Error("All Pan name match services failed");
    }

    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(response?.result?.panNumber);
      const encryptedResponse = {
        ...response?.result,
        panNumber: encryptedPan,
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
        panNumber: encryptedPan,
        response: encryptedResponse,
        nameToMatch,
        serviceResponse: response?.responseOfService,
        ...(mobileNumber && { mobileNumber }),
        status: 1,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panNameMatch.create(storingData);
      panServiceLogger.info(
        `Valid PAN NameMatch response stored and sent to client: ${storingClient}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: {
          panNumber: panNumber,
          nameToMatch,
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        response: {
          panNumber: panNumber,
          nameToMatch,
        },
        ...(mobileNumber && { mobileNumber }),
        nameToMatch,
        serviceResponse: {},
        status: 2,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panNameMatch.create(storingData);
      panServiceLogger.info(
        `Invalid PAN NameMatch response received and sent to client: ${storingClient}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            panNumber: panNumber,
            nameToMatch,
          },
          "Invalid",
        ),
      );
    }
  } catch (error) {
    panServiceLogger.error(
      `System error in PAN NameMatch verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.verifyPanNameDob = async (req, res) => {
  const data = req.body;
  const { panNumber, fullName, dateOfBirth, mobileNumber = "" } = data;
  const storingClient = req.clientId || "CID-6140971541";
  const isDobValid = await handleValidation(
    "DateOfBirth",
    dateOfBirth,
    res,
    storingClient,
  );
  if (!isDobValid) return;
  const capitalPanNumber = reusablePanNumberFieldVerification(
    panNumber,
    storingClient,
    res,
  );

  if (!capitalPanNumber) return;

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "PAN_TO_AADHAAR",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    panServiceLogger.info(
      `Executing PAN NameDob verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    const identifierHash = hashIdentifiers({
      panNo: capitalPanNumber,
      name: fullName,
      dob: dateOfBirth,
    });

    const panRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
      req
    });

    if (!panRateLimitResult.allowed) {
      panServiceLogger.info(
        `Rate limit exceeded for PAN NameDob verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: panRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    panServiceLogger.info(
      `Generated PAN NameDob txn Id: ${tnId} for this client: ${storingClient}`,
    );

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      panServiceLogger.error(
        `Credit deduction failed for PAN NameDob verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedPan = encryptData(capitalPanNumber);

    const existingPanNumber = await panNameDob.findOne({
      panNumber: encryptedPan,
      fullName: fullName,
      dateOfBirth: dateOfBirth,
    });

    panServiceLogger.debug(
      `Checked for existing PAN NameDob record in DB: ${existingPanNumber ? "Found" : "Not Found"} for this client: ${storingClient}`,
    );

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      panServiceLogger.info(
        `Analytics update failed for PAN NameDob verification: client ${storingClient}, service ${serviceId}`,
      );
    }

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
        panServiceLogger.info(
          `Returning cached valid PAN NameDob response for client: ${storingClient}`,
        );
        return res
          .status(200)
          .json(createApiResponse(200, existingPanNumber?.response, "Valid"));
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: {
            pan: panNumber,
          },
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        panServiceLogger.info(
          `Returning cached invalid PAN NameDob response for client: ${storingClient}`,
        );
        return res
          .status(404)
          .json(createApiResponse(404, existingPanNumber?.response, "Valid"));
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      panServiceLogger.warn(
        `Active service not found for PAN NameDob category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    panServiceLogger.info(
      `Active service selected for PAN NameDob verification: ${service.serviceFor}`,
    );
    const response = await PANDobActiveServiceResponse(
      { panNumber, dateOfBirth, fullName },
      service,
      0,
      storingClient,
    );

    panServiceLogger.info(
      `Response received for panNameMatch from active service ${service.serviceFor} for PAN NameDob: ${response?.message}`,
    );

    if (response?.message?.toLowerCase() === "all services failed") {
      throw new Error("All pan to gst services failed");
    }

    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(response?.result?.panNumber);
      const encryptedResponse = {
        ...response?.result,
        panNumber: encryptedPan,
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
        panNumber: encryptedPan,
        response: encryptedResponse,
        fullName,
        dateOfBirth,
        ...(mobileNumber && { mobileNumber }),
        serviceResponse: response?.responseOfService,
        status: 1,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panNameDob.create(storingData);
      panServiceLogger.info(
        `Valid PAN NameDob response stored and sent to client: ${storingClient}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: {
          panNumber: panNumber,
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        fullName,
        dateOfBirth,
        response: {
          panNumber: panNumber,
        },
        ...(mobileNumber && { mobileNumber }),
        serviceResponse: {},
        status: 2,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panNameDob.create(storingData);
      panServiceLogger.info(
        `Invalid PAN NameDob response received and sent to client: ${storingClient}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            panNumber: panNumber,
          },
          "Invalid",
        ),
      );
    }
  } catch (error) {
    panServiceLogger.info(
      `System error in PAN NameDob verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handlePanTanVerification = async (req, res) => {
  const data = req.body;
  const { panNumber, tanNumber, mobileNumber = "" } = data;
  const storingClient = req.clientId;

  const isTanValid = await handleValidation(
    "tan",
    tanNumber,
    res,
    storingClient,
  );
  if (!isTanValid) return;

  const capitalPanNumber = reusablePanNumberFieldVerification(
    panNumber,
    storingClient,
    res,
  );

  if (!capitalPanNumber) return;
  const capitalTanNumber = tanNumber?.toUpperCase();

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "PAN_TAN_VERIFY",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;
  try {
    panServiceLogger.info(
      `Executing PAN To Father name for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    const identifierHash = hashIdentifiers({
      panNo: capitalPanNumber,
      tanNo: capitalTanNumber,
    });

    const panTanRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
      req
    });

    if (!panTanRateLimitResult.allowed) {
      panServiceLogger.warn(
        `Rate limit exceeded for PAN Tan verify for this client: ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: panTanRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    panServiceLogger.info(
      `Generated PAN Tan verify txn Id: ${tnId} for this client: ${storingClient}`,
    );

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      panServiceLogger.error(
        `Credit deduction failed for PAN NameDob verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }
    const encryptedPan = encryptData(capitalPanNumber);
    const encryptedTan = encryptData(capitalTanNumber);

    const existingPanTanResponse = await panTanModel.findOne({
      panNumber: encryptedPan,
      tanNumber: encryptedTan,
    });

    panServiceLogger.debug(
      `Checked for existing PAN To Father name record in DB: ${existingPanTanResponse ? "Found" : "Not Found"} for this client: ${storingClient}`,
    );

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      panServiceLogger.warn(
        `Analytics update failed for PAN To Father name: client ${storingClient}, service ${serviceId}`,
      );
    }

    if (existingPanTanResponse) {
      if (existingPanTanResponse?.status == 1) {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: existingPanTanResponse?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        panServiceLogger.info(
          `Returning cached valid PAN NameDob response for client: ${storingClient}`,
        );
        return res
          .status(200)
          .json(
            createApiResponse(200, existingPanTanResponse?.response, "Valid"),
          );
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: existingPanTanResponse?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        panServiceLogger.info(
          `Returning cached invalid PAN NameDob response for client: ${storingClient}`,
        );

        return res
          .status(404)
          .json(
            createApiResponse(404, existingPanTanResponse?.response, "Invalid"),
          );
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      panServiceLogger.warn(
        `Active service not found for PAN NameDob category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    panServiceLogger.info(
      `Active service selected for PAN NameDob verification: ${service.serviceFor}`,
    );
    const response = await panTanActiveServiceResponse(
      panNumber,
      service,
      0,
      storingClient,
    );

    panServiceLogger.info(
      `Response received from active service ${service.serviceFor} for PAN NameDob: ${response?.message}`,
    );

    if (response?.message?.toLowerCase() === "all services failed") {
      throw new Error("All pan to gst services failed");
    }

    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(response?.result?.panNumber);
      const encryptedResponse = {
        ...response?.result,
        panNumber: encryptedPan,
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
        panNumber: encryptedPan,
        response: encryptedResponse,
        aadhaarNumber: response?.result?.aadhaarNumber,
        serviceResponse: response?.responseOfService,
        ...(mobileNumber && { mobileNumber }),
        status: 1,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panTanModel.create(storingData);
      panServiceLogger.info(
        `Valid PAN NameDob response stored and sent to client: ${storingClient}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: {
          panNumber: panNumber,
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        response: {
          panNumber: panNumber,
          tanNumber: tanNumber,
        },
        aadhaarNumber: response?.result?.aadhaarNumber,
        serviceResponse: response?.responseOfService,
        ...(mobileNumber && { mobileNumber }),
        status: 2,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panTanModel.create(storingData);
      panServiceLogger.info(
        `Invalid PAN NameDob response received and sent to client: ${storingClient}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            panNumber: panNumber,
          },
          "Invalid",
        ),
      );
    }
  } catch (error) {
    panServiceLogger.error(
      `System error in PAN NameDob verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.panItdStatusOtpGeneration = async (req, res) => {
  const data = req.body;
  const { panNumber, mobileNumber = "" } = data;
  const storingClient = req.clientId;

  const capitalPanNumber = reusablePanNumberFieldVerification(
    panNumber,
    storingClient,
    res,
  );

  if (!capitalPanNumber) return;
  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "PAN_ITD_OTP_GENRATE",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;
  try {
    panServiceLogger.info(
      `Executing PAN To Father name for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    const identifierHash = hashIdentifiers({
      panNo: capitalPanNumber,
    });

    const panRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
      req
    });

    if (!panRateLimitResult.allowed) {
      panServiceLogger.warn(
        `Rate limit exceeded for PAN To Father name: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: panRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    panServiceLogger.info(
      `Generated PAN To Father name txn Id: ${tnId} for this client: ${storingClient}`,
    );

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req,
    );

    if (!maintainanceResponse?.result) {
      panServiceLogger.error(
        `Credit deduction failed for PAN NameDob verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }
    const encryptedPan = encryptData(capitalPanNumber);

    const existingPanNumber = await panNameDob.findOne({
      panNumber: encryptedPan,
    });

    panServiceLogger.debug(
      `Checked for existing PAN To Father name record in DB: ${existingPanNumber ? "Found" : "Not Found"} for this client: ${storingClient}`,
    );

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      panServiceLogger.warn(
        `Analytics update failed for PAN To Father name: client ${storingClient}, service ${serviceId}`,
      );
    }

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
        panServiceLogger.info(
          `Returning cached valid PAN NameDob response for client: ${storingClient}`,
        );
        return res
          .status(200)
          .json(createApiResponse(200, existingPanNumber?.response, "Valid"));
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: {
            pan: panNumber,
          },
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        panServiceLogger.info(
          `Returning cached invalid PAN NameDob response for client: ${storingClient}`,
        );

        return res
          .status(404)
          .json(createApiResponse(404, existingPanNumber?.response, "Invalid"));
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      panServiceLogger.warn(
        `Active service not found for PAN NameDob category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    panServiceLogger.info(
      `Active service selected for PAN NameDob verification: ${service.serviceFor}`,
    );
    const response = await PANItdStatusOtpGenerateActiveServiceResponse(
      panNumber,
      service,
      0,
      storingClient,
    );

    panServiceLogger.info(
      `Response received from active service ${service.serviceFor} for PAN NameDob: ${response?.message}`,
    );

    if (response?.message?.toLowerCase() === "all services failed") {
      throw new Error("All pan to gst services failed");
    }

    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(response?.result?.panNumber);
      const encryptedResponse = {
        ...response?.result,
        panNumber: encryptedPan,
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
        panNumber: encryptedPan,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        ...(mobileNumber && { mobileNumber }),
        status: 1,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panFatherNameModel.create(storingData);
      panServiceLogger.info(
        `Valid PAN NameDob response stored and sent to client: ${storingClient}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: {
          panNumber: panNumber,
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        ...(mobileNumber && { mobileNumber }),
        status: 2,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panTanModel.create(storingData);
      panServiceLogger.info(
        `Invalid PAN NameDob response received and sent to client: ${storingClient}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            panNumber: panNumber
          },
          "Invalid",
        ),
      );
    }
  } catch (error) {
    panServiceLogger.error(
      `System error in PAN NameDob verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.panItdStatusOtpVerification = async (req, res) => {
  const data = req.body;
  const { otp } = data;
  const storingClient = req.clientId;
  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "PAN_ITD_OTP_VERIFY",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;
  try {
    panServiceLogger.info(
      `Executing PAN To Father name for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      panServiceLogger.warn(
        `Analytics update failed for PAN To Father name: client ${storingClient}, service ${serviceId}`,
      );
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      panServiceLogger.warn(
        `Active service not found for PAN NameDob category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    panServiceLogger.info(
      `Active service selected for PAN NameDob verification: ${service.serviceFor}`,
    );
    const response = await PANItdStatusOtpValidateActiveServiceResponse(
      panNumber,
      service,
      0,
      storingClient,
    );

    panServiceLogger.info(
      `Response received from active service ${service.serviceFor} for PAN NameDob: ${response?.message}`,
    );

    if (response?.message?.toLowerCase() === "all services failed") {
      throw new Error("All pan to gst services failed");
    }

    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(response?.result?.panNumber);
      const encryptedResponse = {
        ...response?.result,
        panNumber: encryptedPan,
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
        panNumber: encryptedPan,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        ...(mobileNumber && { mobileNumber }),
        status: 1,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panTanModel.create(storingData);
      panServiceLogger.info(
        `Valid PAN NameDob response stored and sent to client: ${storingClient}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: {
          panNumber: panNumber
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        ...(mobileNumber && { mobileNumber }),
        status: 2,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panToAadhaarModel.create(storingData);
      panServiceLogger.info(
        `Invalid PAN NameDob response received and sent to client: ${storingClient}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            panNumber: panNumber
          },
          "Invalid",
        ),
      );
    }
  } catch (error) {
    panServiceLogger.error(
      `System error in PAN NameDob verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
