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

const reusablePanNumberFieldVerification = (panNo, client, res) => {
  const capitalPanNumber = panNo?.toUpperCase();

  const isValid = handleValidation("pan", capitalPanNumber, res, client);
  if (!isValid) return false;

  panServiceLogger.info("All inputs in pan are valid, continue processing...");
  return capitalPanNumber;
};

async function handlePanService({
  req,
  res,
  serviceKey,
  model,
  activeServiceFn,
  invalidResponseFn
}) {
  const { panNumber, mobileNumber = "" } = req.body;
  const clientId = req.clientId;

  const validatedPan = reusablePanNumberFieldVerification(
    panNumber,
    clientId,
    res
  );
  if (!validatedPan) return;

  const { idOfCategory, idOfService } =
    getCategoryIdAndServiceId(serviceKey, clientId);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  const now = new Date();
  const createdTime = now.toLocaleTimeString();
  const createdDate = now.toLocaleDateString();

  try {
    const identifierHash = hashIdentifiers({ panNo: validatedPan });

    const rateLimit = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId
    });

    if (!rateLimit.allowed) {
      return res.status(429).json({ success: false, message: rateLimit.message });
    }

    const txnId = genrateUniqueServiceId();

    const credit = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      txnId,
      req.environment
    );

    if (!credit?.result) {
      return res.status(500).json({ success: false });
    }

    const encryptedPan = encryptData(validatedPan);

    const existing = await model.findOne({ panNumber: encryptedPan });

    // 🔁 CACHE HIT
    if (existing) {
      return handleCachedResponse(existing, res, serviceId, categoryId, clientId);
    }

    const service = await selectService(categoryId, serviceId);
    if (!service) return res.status(404).json(ERROR_CODES.NOT_FOUND);

    const response = await activeServiceFn(validatedPan, service, 0, clientId);

    if (response?.message?.toLowerCase() === "all services failed") {
      throw new Error("All services failed");
    }

    return handleNewResponse({
      response,
      model,
      res,
      clientId,
      serviceId,
      categoryId,
      mobileNumber,
      createdTime,
      createdDate,
      invalidResponseFn
    });

  } catch (err) {
    const errorObj = mapError(err);
    return res.status(errorObj.httpCode).json(errorObj);
  }
}

exports.verifyPanNumber = async (req, res) => {
  const data = req.body;
  const { panNumber, mobileNumber = "" } = data;
  const storingClient = req.clientId || "CID-6140971541";

  const capitalPanNumber = reusablePanNumberFieldVerification(
    panNumber,
    storingClient,
    res,
  );

  if (!capitalPanNumber) return;
  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "PAN_BASIC",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;
  try {
    panServiceLogger.info(
      `Executing PAN verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Always generate txnId
    const tnId = genrateUniqueServiceId();
    panServiceLogger.info(
      `Generated PAN txn Id: ${tnId} for the client: ${storingClient}`,
    );

    // Common: hash identifier
    // const identifierHash = hashIdentifiers({
    //   panNo: capitalPanNumber,
    // });

    // const panRateLimitResult = await checkingRateLimit({
    //   identifiers: { identifierHash },
    //   serviceId,
    //   categoryId,
    //   clientId: storingClient,
    // });

    // if (!panRateLimitResult.allowed) {
    //   panServiceLogger.warn(
    //     `Rate limit exceeded for PAN verification: client ${storingClient}, service ${serviceId}`,
    //   );
    //   return res.status(429).json({
    //     success: false,
    //     message: panRateLimitResult.message,
    //   });
    // }

    // const maintainanceResponse = await deductCredits(
    //   storingClient,
    //   serviceId,
    //   categoryId,
    //   tnId,
    //   req.environment,
    // );

    // if (!maintainanceResponse?.result) {
    //   panServiceLogger.error(
    //     `Credit deduction failed for PAN verification: client ${storingClient}, txnId ${tnId}`,
    //   );
    //   return res.status(500).json({
    //     success: false,
    //     message: maintainanceResponse?.message || "Invalid",
    //     response: {},
    //   });
    // }

    const encryptedPan = encryptData(capitalPanNumber);

    const existingPanNumber = await panverificationModel.findOne({
      panNumber: encryptedPan,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      panServiceLogger.warn(
        `Analytics update failed for PAN verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    panServiceLogger.debug(
      `Checked for existing PAN record in DB: ${existingPanNumber ? "Found" : "Not Found"}`,
    );
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
        panServiceLogger.info(
          `Returning cached valid PAN response for client: ${storingClient}`,
        );
        return res
          .status(200)
          .json(createApiResponse(200, decryptedResponse, "Valid"));
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: resOfPan,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        panServiceLogger.info(
          `Returning cached invalid PAN response for client: ${storingClient}`,
        );
        return res
          .status(404)
          .json(createApiResponse(404, resOfPan, "Invalid"));
      }
    }

    const service = await selectService(categoryId, serviceId,storingClient,req);

    if (!service?.length) {
      panServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(500).json(ERROR_CODES?.SERVICE_UNAVAILABLE);
    }

    let panNumberResponse = await PanActiveServiceResponse(
      panNumber,
      service,
      0,
      storingClient,
    );

    panServiceLogger.info(
      `Response received from pan verification active service ${panNumberResponse?.service} with message: ${panNumberResponse?.message}`,
    );

    if (panNumberResponse?.message?.toLowerCase() === "all services failed") {
      throw new Error("All pan to gst services failed");
    }

    if (panNumberResponse?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...panNumberResponse?.result,
        PAN: encryptedPan,
      };

      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: panNumberResponse?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        panNumber: encryptedPan,
        userName: panNumberResponse?.result?.Name,
        response: encryptedResponse,
        serviceResponse: panNumberResponse?.responseOfService,
        status: 1,
        ...(mobileNumber && { mobileNumber }),
        serviceName: panNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panverificationModel.create(storingData);
      panServiceLogger.info(
        `Valid PAN response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, panNumberResponse?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: { pan: panNumber },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        panNumber: encryptedPan,
        userName: "",
        response: { pan: panNumber },
        serviceResponse: panNumberResponse?.responseOfService,
        status: 2,
        ...(mobileNumber && { mobileNumber }),
        serviceName: panNumberResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panverificationModel.create(storingData);
      panServiceLogger.info(
        `Invalid PAN response received and sent to client: ${storingClient}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { pan: panNumber }, "Invalid"));
    }
  } catch (error) {
    panServiceLogger.error(
      `System error in PAN verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.verifyPanToAadhaar = async (req, res) => {
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
    "PAN_TO_AADHAAR",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;
  try {
    panServiceLogger.info(
      `Executing PAN to Aadhaar verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

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
      panServiceLogger.warn(
        `Rate limit exceeded for PAN to Aadhaar verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: panRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    panServiceLogger.info(`Generated PAN to Aadhaar txn Id: ${tnId}`);

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      panServiceLogger.error(
        `Credit deduction failed for PAN to Aadhaar verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedPan = encryptData(capitalPanNumber);

    const existingPanNumber = await panToAadhaarModel.findOne({
      panNumber: encryptedPan,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      panServiceLogger.warn(
        `Analytics update failed for PAN to Aadhaar verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    panServiceLogger.debug(
      `Checked for existing PAN to Aadhaar record in DB: ${existingPanNumber ? "Found" : "Not Found"}`,
    );
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
          `Returning cached valid PAN to Aadhaar response for client: ${storingClient}`,
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
            pan: panNumber
          },
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        panServiceLogger.info(
          `Returning cached invalid PAN to Aadhaar response for client: ${storingClient}`,
        );
        return res.status(404).json(
          createApiResponse(
            404,
            {
              pan: panNumber,
            },
            "Invalid",
          ),
        );
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      panServiceLogger.warn(
        `Active service not found for PAN to Aadhaar category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    panServiceLogger.info(
      `Active service selected for PAN to Aadhaar verification: ${service.serviceFor}`,
    );
    const response = await PantoAadhaarActiveServiceResponse(
      panNumber,
      service,
      0,
    );

    panServiceLogger.info(
      `Response received from active service ${service.serviceFor} for PAN to Aadhaar: ${response?.message}`,
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
      await panToAadhaarModel.create(storingData);
      panServiceLogger.info(
        `Valid PAN to Aadhaar response stored and sent to client: ${storingClient}`,
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
        },
        aadhaarNumber: response?.result?.aadhaarNumber,
        serviceResponse: {},
        ...(mobileNumber && { mobileNumber }),
        status: 2,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panToAadhaarModel.create(storingData);
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
      `System error in PAN to Aadhaar verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.verifyPantoGst_InNumber = async (req, res) => {
  const data = req.body;
  const {
    panNumber,
    mobileNumber = ""
  } = data;
  const storingClient = req.clientId || "CID-6140971541";

  const capitalPanNumber = reusablePanNumberFieldVerification(
    panNumber,
    storingClient,
    res,
  );

  if (!capitalPanNumber) return;

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "PAN_TO_GST_IN_NUBER",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    panServiceLogger.info(
      `Executing PAN to GST verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

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
      panServiceLogger.warn(
        `Rate limit exceeded for PAN to GST verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: panRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    panServiceLogger.info(`Generated PAN to GST txn Id: ${tnId}`);

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      panServiceLogger.error(
        `Credit deduction failed for PAN to GST verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedPan = encryptData(capitalPanNumber);

    const existingPanNumber = await panTogst_inModel.findOne({
      panNumber: encryptedPan,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      panServiceLogger.warn(
        `Analytics update failed for PAN to GST verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    panServiceLogger.info(
      `Checked for existing PAN to GST record in DB: ${existingPanNumber ? "Found" : "Not Found"}`,
    );
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
        panServiceLogger.info(
          `Returning cached valid PAN to GST response for client: ${storingClient}`,
        );
        return res
          .status(200)
          .json(createApiResponse(200, decryptedResponse, "Valid"));
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
        panServiceLogger.info(
          `Returning cached invalid PAN to GST response for client: ${storingClient}`,
        );
        return res
          .status(404)
          .json(createApiResponse(404, resOfPan, "Invalid"));
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      panServiceLogger.warn(
        `Active service not found for PAN to GST category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    panServiceLogger.info(
      `Active service selected for PAN to GST verification: ${service.serviceFor}`,
    );
    let response = await PANtoGST_InActiveServiceResponse(
      panNumber,
      service,
      0,
      storingClient,
    );

    panServiceLogger.info(
      `Response received from Pan to Gst for active service ${response?.service} with message: ${response?.message} for the client: ${storingClient} :: ${JSON.stringify(response)}`,
    );

    if (response?.message?.toLowerCase() === "all services failed") {
      throw new Error("All pan to gst services failed");
    }

    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(response?.result?.PAN);
      const encryptedResponse = { ...response?.result, PAN: encryptedPan };

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

      await panTogst_inModel.create(storingData);
      panServiceLogger.info(
        `Valid PAN to GST response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: { pan: panNumber },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        panNumber: encryptedPan,
        response: {
          pan: panNumber,
        },
        status: 2,
        serviceResponse: {},
        ...(mobileNumber && { mobileNumber }),
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panTogst_inModel.create(storingData);
      panServiceLogger.info(
        `Invalid PAN to GST response stored and sent to client: ${storingClient}`,
      );
      return res
        .status(404)
        .json(
          createApiResponse(
            404,
            { pan: panNumber },
            "Invalid",
          ),
        );
    }
  } catch (error) {
    panServiceLogger.error(
      `System error in PAN to GST verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.verifyPantoGst = async (req, res) => {
  const data = req.body;
  const {
    panNumber,
    mobileNumber = ""
  } = data;
  const storingClient = req.clientId || "CID-6140971541";

  const capitalPanNumber = reusablePanNumberFieldVerification(
    panNumber,
    storingClient,
    res,
  );

  if (!capitalPanNumber) return;
  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "PAN_TO_GST",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;
  try {
    panServiceLogger.info(
      `Executing PAN to GST verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

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
      panServiceLogger.warn(
        `Rate limit exceeded for PAN to GST verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: panRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    panServiceLogger.info(`Generated PAN to GST txn Id: ${tnId}`);

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      panServiceLogger.error(
        `Credit deduction failed for PAN to GST verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedPan = encryptData(capitalPanNumber);

    const existingPanNumber = await panToGstModel.findOne({
      panNumber: encryptedPan,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      panServiceLogger.warn(
        `Analytics update failed for PAN to GST verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    panServiceLogger.debug(
      `Checked for existing PAN to GST record in DB: ${existingPanNumber ? "Found" : "Not Found"}`,
    );
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
        panServiceLogger.info(
          `Returning cached valid PAN to GST response for client: ${storingClient}`,
        );
        return res
          .status(200)
          .json(createApiResponse(200, decryptedResponse, "Valid"));
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
        panServiceLogger.info(
          `Returning cached invalid PAN to GST response for client: ${storingClient}`,
        );
        return res
          .status(404)
          .json(createApiResponse(404, resOfPan, "Invalid"));
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      panServiceLogger.warn(
        `Active service not found for PAN to GST category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    panServiceLogger.info(
      `Active service selected for PAN to GST verification: ${service.serviceFor}`,
    );
    let response = await PANtoGSTActiveServiceResponse(
      panNumber,
      service,
      0,
      storingClient,
    );

    panServiceLogger.info(
      `Response received from Pan to Gst for active service ${response?.service} with message: ${response?.message} for the client: ${storingClient} :: ${JSON.stringify(response)}`,
    );

    if (response?.message?.toLowerCase() === "all services failed") {
      throw new Error("All pan to gst services failed");
    }

    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(response?.result?.PAN);
      const encryptedResponse = { ...response?.result, PAN: encryptedPan };

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

      await panToGstModel.create(storingData);
      panServiceLogger.info(
        `Valid PAN to GST response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: { pan: panNumber },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        panNumber: encryptedPan,
        response: {
          pan: panNumber,
          ...findingInValidResponses("panToGst"),
        },
        status: 2,
        serviceResponse: {},
        ...(mobileNumber && { mobileNumber }),
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panToGstModel.create(storingData);
      panServiceLogger.info(
        `Invalid PAN to GST response stored and sent to client: ${storingClient}`,
      );
      return res
        .status(404)
        .json(
          createApiResponse(
            404,
            { pan: panNumber, ...findingInValidResponses("panToGst") },
            "Invalid",
          ),
        );
    }
  } catch (error) {
    panServiceLogger.error(
      `System error in PAN to GST verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.verifyPanNameMatch = async (req, res) => {
  const data = req.body;
  const {
    panNumber,
    nameToMatch,
    mobileNumber = ""
  } = data;

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
  const {
    panNumber,
    fullName,
    dateOfBirth,
    mobileNumber = ""
  } = data;
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

exports.panDirector = async (req, res) => {
  const data = req.body;
  const {
    panNumber,
    mobileNumber = ""
  } = data;
  const storingClient = req.clientId;

  const capitalPanNumber = reusablePanNumberFieldVerification(
    panNumber,
    storingClient,
    res,
  );

  if (!capitalPanNumber) return;
  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "PAN_DIRECTOR",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;
  try {
    panServiceLogger.info(
      `Executing PAN NameDob verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // const identifierHash = hashIdentifiers({
    //   panNo: capitalPanNumber,
    // });

    // const panRateLimitResult = await checkingRateLimit({
    //   identifiers: { identifierHash },
    //   serviceId,
    //   categoryId,
    //   clientId: storingClient,
    // });

    // if (!panRateLimitResult.allowed) {
    //   panServiceLogger.warn(
    //     `Rate limit exceeded for PAN NameDob verification: client ${storingClient}, service ${serviceId}`,
    //   );
    //   return res.status(429).json({
    //     success: false,
    //     message: panRateLimitResult.message,
    //   });
    // }

    // const tnId = genrateUniqueServiceId();
    // panServiceLogger.info(`Generated PAN NameDob txn Id: ${tnId}`);

    // const maintainanceResponse = await deductCredits(
    //   storingClient,
    //   serviceId,
    //   categoryId,
    //   tnId,
    //   req.environment,
    // );

    // if (!maintainanceResponse?.result) {
    //   panServiceLogger.error(
    //     `Credit deduction failed for PAN NameDob verification: client ${storingClient}, txnId ${tnId}`,
    //   );
    //   return res.status(500).json({
    //     success: false,
    //     message: maintainanceResponse?.message || "Invalid",
    //     response: {},
    //   });
    // }
    const encryptedPan = encryptData(capitalPanNumber);

    const existingPanNumber = await panDirectorModel.findOne({
      panNumber: encryptedPan,
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
      panServiceLogger.warn(
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
    const response = await PANDirectorActiveServiceResponse(
      panNumber,
      service,
      0,
      storingClient,
    );

    panServiceLogger.info(
      `Response received from active service ${response?.service} for PAN NameDob: ${response?.message}`,
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
      await panDirectorModel.create(storingData);
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
          ...findingInValidResponses("panDirector"),
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
      await panDirectorModel.create(storingData);
      panServiceLogger.info(
        `Invalid PAN NameDob response received and sent to client: ${storingClient}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            panNumber: panNumber,
            ...findingInValidResponses("panDirector"),
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

exports.panToFatherName = async (req, res) => {
  const data = req.body;
  const {
    panNumber,
    mobileNumber = ""
  } = data;
  const storingClient = req.clientId || "CID-6140971541";

  const capitalPanNumber = reusablePanNumberFieldVerification(
    panNumber,
    storingClient,
    res,
  );

  if (!capitalPanNumber) return;
  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "PAN_TO_FATHER_NAME",
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

    const existingPanNumber = await panFatherNameModel.findOne({
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
    const response = await PANToFatherNameActiveServiceResponse(
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
      await panToAadhaarModel.create(storingData);
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
        aadhaarNumber: response?.result?.aadhaarNumber,
        serviceResponse: response?.responseOfService,
        ...(mobileNumber && { mobileNumber }),
        status: 2,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await panFatherNameModel.create(storingData);
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
  const {
    panNumber,
    mobileNumber = ""
  } = data;
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
            panNumber: panNumber,
            ...findingInValidResponses("panToFather"),
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
  const {
    panNumber,
    mobileNumber = ""
  } = data;
  const storingClient = req.clientId;

  const capitalPanNumber = reusablePanNumberFieldVerification(
    panNumber,
    storingClient,
    res,
  );

  if (!capitalPanNumber) return;
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
          panNumber: panNumber,
          ...findingInValidResponses("panToFather"),
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
            panNumber: panNumber,
            ...findingInValidResponses("panToFather"),
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
