const panverificationModel = require("../models/panverification.model");
const panToAadhaarModel = require("../models/panToAadhaarModel");
const axios = require("axios");
require("dotenv").config();
const { kycLogger } = require("../../Logger/logger");
const {
  encryptData,
  decryptData,
} = require("../../../utlis/EncryptAndDecrypt");
const { selectService } = require("../../service/serviceSelector");
const { ERROR_CODES, mapError } = require("../../../utlis/errorCodes");
const handleValidation = require("../../../utlis/lengthCheck");
const { findingInValidResponses } = require("../../../utlis/InvalidResponses");
const {
  PanActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/PanServiceResponse");
const {
  PantoAadhaarActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/PantoAadhaarRes");
const chargesToBeDebited = require("../../../utlis/chargesMaintainance");
const genrateUniqueServiceId = require("../../../utlis/genrateUniqueId");
const checkingRateLimit = require("../../../utlis/checkingRateLimit");
const { hashIdentifiers } = require("../../../utlis/hashIdentifier");
const { createApiResponse } = require("../../../utlis/ApiResponseHandler");
const {
  PANtoGSTActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/PANtoGSTActiveServiceResponse");
const creditsToBeDebited = require("../../../utlis/creditsMaintainance");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const AnalyticsDataUpdate = require("../../../utlis/analyticsStoring");

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

  console.log("All inputs in pan are valid, continue processing...");
  kycLogger.info("All inputs in pan are valid, continue processing...");

  const storingClient = req.clientId || clientId;

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
  //   return res.status(429).json({
  //     success: false,
  //     message: panRateLimitResult.message,
  //   });
  // }

  // const tnId = genrateUniqueServiceId();
  // kycLogger.info(`pan txn Id ===>> ${tnId}`);
  // let maintainanceResponse;
  // if (req.environment?.toLowercase() == "test") {
  //   maintainanceResponse = await creditsToBeDebited(
  //     storingClient,
  //     serviceId,
  //     categoryId,
  //     tnId,
  //   );
  // } else {
  //   maintainanceResponse = await chargesToBeDebited(
  //     storingClient,
  //     serviceId,
  //     categoryId,
  //     tnId,
  //   );
  // }

  // if (!maintainanceResponse?.result) {
  //   return res.status(500).json({
  //     success: false,
  //     message: "InValid",
  //     response: {},
  //   });
  // }

  const encryptedPan = encryptData(capitalPanNumber);

  const existingPanNumber = await panverificationModel.findOne({
    panNumber: encryptedPan,
  });

  await AnalyticsDataUpdate(storingClient, serviceId, categoryId);

  console.log("existingPanNumber===>", existingPanNumber);
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
      return res.json({
        message: "InValid",
        data: resOfPan,
        success: false,
      });
    }
  }

  const service = await selectService(categoryId, serviceId);

  console.log("----active service for pan Verify is ----", service);
  if (!service) {
    return res.status(404).json(ERROR_CODES?.NOT_FOUND);
  }

  try {
    let response = await PanActiveServiceResponse(panNumber, service, 0);
    console.log("VerifyPanNumber Response ===>", response);
    console.log(
      `response from active service for pan: ${response?.service} ===> ${JSON.stringify(response)}`,
    );
    kycLogger.info(
      `response from active service for pan ${service.serviceFor} ${JSON.stringify(response)}`,
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
        // serviceResponse:{ ...response?.responseOfService,pan_number:decryptData(response?.responseOfService?.pan_number)}  ,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panverificationModel.create(storingData);
      kycLogger.info("Valid response stored successfully and sent to client");

      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
      // const storingData = {
      //   panNumber: encryptedPan,
      //   userName: "",
      //   response: null,
      //   status: 2,
      //   serviceResponse: {},
      //   serviceName: response?.service,
      //   createdDate: new Date().toLocaleDateString(),
      //   createdTime: new Date().toLocaleTimeString(),
      // };

      // await panverificationModel.create(storingData);
      // kycLogger.info("InValid response stored successfully and sent to client");

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
    console.log("error in verifyPanNumber ===>>>", error);
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

  console.log("All inputs in pan are valid, continue processing...");
  kycLogger.info("All inputs in pan are valid, continue processing...");

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
    return res.status(429).json({
      success: false,
      message: panRateLimitResult.message,
    });
  }

  const tnId = genrateUniqueServiceId();
  kycLogger.info("pan txn Id ===>>", tnId);
  let maintainanceResponse;
  if (req.environment?.toLowercase() == "test") {
    maintainanceResponse = await creditsToBeDebited(
      storingClient,
      serviceId,
      categoryId,
      tnId,
    );
  } else {
    maintainanceResponse = await chargesToBeDebited(
      storingClient,
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
  const encryptedPan = encryptData(capitalNumber);

  const existingPanNumber = await panverificationModel.findOne({
    panNumber: encryptedPan,
  });

  await AnalyticsDataUpdate(storingClient, serviceId, categoryId);

  console.log("existingPanNumber===>", existingPanNumber);
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
      return res.json({
        message: "InValid",
        data: resOfPan,
        success: false,
      });
    }
  }

  const service = await selectService(categoryId, serviceId);

  console.log("----active service for pan Verify is ----", service);
  if (!service) {
    return res.status(404).json(ERROR_CODES?.NOT_FOUND);
  }

  try {
    let response = await PANtoGSTActiveServiceResponse(panNumber, service, 0);
    console.log("VerifyPanNumber Response ===>", response);
    console.log(
      `response from active service for pan: ${response?.service} ===> ${JSON.stringify(response)}`,
    );
    kycLogger.info(
      `response from active service for pan ${service.serviceFor} ${JSON.stringify(response)}`,
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
        // serviceResponse:{ ...response?.responseOfService,pan_number:decryptData(response?.responseOfService?.pan_number)}  ,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panverificationModel.create(storingData);
      kycLogger.info("InValid response stored successfully and sent to client");

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
      kycLogger.info("InValid response stored successfully and sent to client");

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
    console.log("error in verifyPanNumber ===>>>", error);
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

  console.log("All inputs in pan are valid, continue processing...");
  kycLogger.info("All inputs in pan are valid, continue processing...");

  const storingClient = req.clientId || clientId;

  // const identifierHash = hashIdentifiers({
  //   panNo: capitalPanNumber,
  // });

  // const panRateLimitResult = await checkingRateLimit({
  //   identifiers: { identifierHash },
  //   serviceId,
  //   categoryId,
  //   clientId: req.clientId,
  // });

  // if (!panRateLimitResult.allowed) {
  //   return res.status(429).json({
  //     success: false,
  //     message: panRateLimitResult.message,
  //   });
  // }

  // const tnId = genrateUniqueServiceId();
  // kycLogger.info(`pan txn Id ===>> ${tnId}`);
  // let maintainanceResponse;
  // if (req.environment?.toLowercase() == "test") {
  //   maintainanceResponse = await creditsToBeDebited(
  //     req.clientId,
  //     serviceId,
  //     categoryId,
  //     tnId,
  //   );
  // } else {
  //   maintainanceResponse = await chargesToBeDebited(
  //     req.clientId,
  //     serviceId,
  //     categoryId,
  //     tnId,
  //   );
  // }

  // if (!maintainanceResponse?.result) {
  //   return res.status(500).json({
  //     success: false,
  //     message: "InValid",
  //     response: {},
  //   });
  // }
  const encryptedPan = encryptData(capitalPanNumber);

  const existingPanNumber = await panToAadhaarModel.findOne({
    panNumber: encryptedPan,
  });
  console.log("existingPanNumber===>", existingPanNumber);
  console.log("req.clientId ===>>", storingClient);

  await AnalyticsDataUpdate(storingClient, serviceId, categoryId);
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

  try {
    const response = await PantoAadhaarActiveServiceResponse(
      panNumber,
      service,
      0,
    );
    console.log(
      "Verify panto aadhaar number is response",
      JSON.stringify(response),
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
      kycLogger.info("Valid response stored successfully and sent to client");
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Valid"));
    } else {
       await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result:    {
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
    console.log("error in verifyPanNumber ===>>>", error);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
