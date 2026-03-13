const panverificationModel = require("../models/panBasic.model");
const panToAadhaarModel = require("../models/panToAadhaarModel");
const axios = require("axios");
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
const {
  PanActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/PanBasicResponse");
const {
  PantoAadhaarActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/PantoAadhaarRes");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const { deductCredits } = require("../../../services/CreditService");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const panNameMatch = require("../models/panNameMatch");
const panNameDob = require("../models/panNameDob");
const chargesToBeDebited = require("../../../utils/chargesMaintainance");
const { PANNameMatchActiveServiceResponse, PANDobActiveServiceResponse, PANtoGSTActiveServiceResponse } = require("../../GlobalApiserviceResponse/panServicesResp");

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
  console.log("req coming in pan ===>>", req?.baseUrl);

  const isValid = handleValidation("pan", capitalPanNumber, res);
  if (!isValid) return;

  panServiceLogger.info("All inputs in pan are valid, continue processing...");

  const storingClient = req.clientId || clientId;

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
    //       storingClient,
    //       serviceId,
    //       categoryId,
    //       tnId,
    //       req.environment,
    //     );

    // if (!maintainanceResponse?.result) {
    //   panServiceLogger.error(
    //     `Credit deduction failed for PAN verification: client ${storingClient}, txnId ${tnId}`,
    //   );
    //   return res.status(500).json({
    //     success: false,
    //     message: maintainanceResponse?.message || "InValid",
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
        panServiceLogger.info(
          `Returning cached invalid PAN response for client: ${storingClient}`,
        );
        return res.json({
          message: "InValid",
          data: resOfPan,
          success: false,
        });
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      panServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    panServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let panNumberResponse = await PanActiveServiceResponse(
      panNumber,
      service,
      0,
    );

    panServiceLogger.info(
      `Response received from active service ${service.serviceFor}: ${panNumberResponse?.message}`,
    );

    if (panNumberResponse?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(panNumberResponse?.result?.PAN);
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
        mobileNumber,
        serviceId: `${panNumberResponse?.service}_panBasic`,
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
        serviceResponse: panNumberResponse?.responseOfService,
        status: 2,
        mobileNumber,
        serviceId: `${panNumberResponse?.service}_panBasic`,
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
        .json(
          createApiResponse(
            404,
            { pan: panNumber, ...findingInValidResponses("panBasic") },
            "Failed",
          ),
        );
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

  panServiceLogger.info("All inputs in pan are valid, continue processing...");

  const storingClient = req.clientId || clientId;

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
        message: maintainanceResponse?.message || "InValid",
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
            pan: panNumber,
            ...findingInValidResponses("panToAadhaar"),
          },
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        panServiceLogger.info(
          `Returning cached invalid PAN to Aadhaar response for client: ${storingClient}`,
        );
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
          ...findingInValidResponses("panToAadhaar"),
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
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
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
    clientId = "",
  } = data;
  const capitalNumber = panNumber?.toUpperCase();
  const isValid = handleValidation("pan", capitalNumber, res);
  if (!isValid) return;

  const storingClient = req.clientId || clientId;

  panServiceLogger.info("All inputs in pan are valid, continue processing...");

  try {
    panServiceLogger.info(
      `Executing PAN to GST verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

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
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const encryptedPan = encryptData(capitalNumber);

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
        panServiceLogger.info(
          `Returning cached invalid PAN to GST response for client: ${storingClient}`,
        );
        return res.json({
          message: "InValid",
          data: resOfPan,
          success: false,
        });
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
    let response = await PANtoGSTActiveServiceResponse(panNumber, service, 0);

    panServiceLogger.info(
      `Response received from active service ${service.serviceFor} for PAN to GST: ${response?.message}`,
    );

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
        userName: response?.result?.Name,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        status: 1,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panverificationModel.create(storingData);
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
        result: { pan: panNumber, ...findingInValidResponses("panToGst") },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        panNumber: encryptedPan,
        userName: "",
        response: null,
        status: 2,
        serviceResponse: {
          pan: panNumber,
          ...findingInValidResponses("panToGst"),
        },
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panverificationModel.create(storingData);
      panServiceLogger.info(
        `Invalid PAN to GST response stored and sent to client: ${storingClient}`,
      );
      return res
        .status(404)
        .json(
          createApiResponse(
            404,
            { pan: panNumber, ...findingInValidResponses("panToGst") },
            "Failed",
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
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
    clientId = "",
  } = data;

  const capitalPanNumber = panNumber?.toUpperCase();
  const isValid = handleValidation("pan", capitalPanNumber, res);
  if (!isValid) return;

  panServiceLogger.info("All inputs in pan are valid, continue processing...");

  const storingClient = req.clientId || clientId;
  try {
    panServiceLogger.info(
      `Executing PAN to NameMatch verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
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
        `Rate limit exceeded for PAN NameMatch verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: panRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    panServiceLogger.info(`Generated PAN to Namematch txn Id: ${tnId}`);

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      panServiceLogger.error(
        `Credit deduction failed for PAN NameMatch verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }
    const encryptedPan = encryptData(capitalPanNumber);

    const existingPanNumber = await panNameMatch.findOne({
      panNumber: encryptedPan,
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
            ...findingInValidResponses("panToAadhaar"),
          },
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        panServiceLogger.info(
          `Returning cached invalid PAN NameMatch response for client: ${storingClient}`,
        );
        return res.json({
          message: "InValid",
          success: false,
          data: {
            pan: panNumber,
            ...findingInValidResponses("panNameMatch"),
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
      panNumber,
      service,
      0,
    );

    panServiceLogger.info(
      `Response received from active service ${service.serviceFor} for PAN NameMatch: ${response?.message}`,
    );

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
          ...findingInValidResponses("panToAadhaar"),
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      panServiceLogger.info(
        `Invalid PAN NameMatch response received and sent to client: ${storingClient}`,
      );
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
    nameToMatch,
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
    clientId = "",
  } = data;
  const capitalPanNumber = panNumber?.toUpperCase();
  const isValid = handleValidation("pan", capitalPanNumber, res);
  if (!isValid) return;

  panServiceLogger.info("All inputs in pan are valid, continue processing...");

  const storingClient = req.clientId || clientId;

  try {
    panServiceLogger.info(
      `Executing PAN NameDob verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
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
        `Rate limit exceeded for PAN NameDob verification: client ${storingClient}, service ${serviceId}`,
      );
      return res.status(429).json({
        success: false,
        message: panRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    panServiceLogger.info(`Generated PAN NameDob txn Id: ${tnId}`);

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
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }
    const encryptedPan = encryptData(capitalPanNumber);

    const existingPanNumber = await panNameDob.findOne({
      panNumber: encryptedPan,
    });

    panServiceLogger.debug(
      `Checked for existing PAN NameDob record in DB: ${existingPanNumber ? "Found" : "Not Found"}`,
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
            ...findingInValidResponses("panNameDob"),
          },
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        panServiceLogger.info(
          `Returning cached invalid PAN NameDob response for client: ${storingClient}`,
        );
        return res.json({
          message: "InValid",
          success: false,
          data: {
            pan: panNumber,
            ...findingInValidResponses("panNameDob"),
          },
        });
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
      panNumber,
      service,
      0,
    );

    panServiceLogger.info(
      `Response received from active service ${service.serviceFor} for PAN NameDob: ${response?.message}`,
    );

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
          ...findingInValidResponses("panNameDob"),
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      panServiceLogger.info(
        `Invalid PAN NameDob response received and sent to client: ${storingClient}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            panNumber: panNumber,
            ...findingInValidResponses("panNameDob"),
          },
          "InValid",
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
