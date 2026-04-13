const { error } = require("winston");
const { deductCredits } = require("../../../services/CreditService");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");
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
  passportVerifyServiceResponse,
  voterIdVerifyServiceResponse,
  electricityBillServiceResponse,
} = require("../service/governmentServicesResp");
const { governmentServiceLogger } = require("../../Logger/logger");
const { selectService } = require("../../service/serviceSelector");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const passportVerifyModel = require("../models/passportFileNoVerifyModel");
const voterIdVerifyModel = require("../models/voterIdVerifyModel");
const getCategoryIdAndServiceId = require("../../../utils/categoryAndServiceIds");
const passportFileNoVerifyModel = require("../models/passportFileNoVerifyModel");

exports.handleVoterIdVerify = async (req, res) => {
  const data = req.body;
  const { voterId, mobileNumber = "" } = data;
  const capitalVoterId = voterId?.toUpperCase();
  const storingClient = req.clientId || "CID-6140971541";
  // Always generate txnId
  const tnId = genrateUniqueServiceId();
  governmentServiceLogger.info(
    `Generated voter id txn Id: ${tnId} for the client: ${storingClient}`,
  );

  const isValid = handleValidation(
    "voterId",
    capitalVoterId,
    res,
    tnId,
    governmentServiceLogger
  );
  if (!isValid) return;

  governmentServiceLogger.info(
    "All inputs in voter id verification are valid, continue processing...",
  );

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "VOTER_ID",
    tnId,
    governmentServiceLogger
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    governmentServiceLogger.info(
      `Executing driving license verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    const identifierHash = hashIdentifiers({
      voter: capitalVoterId,
    });

    const voterIdLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!voterIdLimitResult.allowed) {
      governmentServiceLogger.warn(
        `Rate limit exceeded for driving license verification: client ${storingClient}, service: ${serviceId} category: ${categoryId}`,
      );
      return res.status(429).json({
        success: false,
        message: voterIdLimitResult.message,
      });
    }

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req || "test",
      governmentServiceLogger,
    );

    if (!maintainanceResponse?.result) {
      governmentServiceLogger.error(
        `Credit deduction failed for driving license verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedVoterId = encryptData(capitalVoterId);

    const existingVoterId = await voterIdVerifyModel.findOne({
      voterId: encryptedVoterId,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      governmentServiceLogger.warn(
        `Analytics update failed for voter id verfication for this client ${storingClient} with service ${serviceId}`,
      );
    }

    governmentServiceLogger.info(
      `Checked for existing voter id verfication record in DB: ${existingVoterId ? "Found" : "Not Found"}`,
    );
    if (existingVoterId) {
      const decryptedVoterId = decryptData(existingVoterId?.voterId);
      const resOfvoter = existingVoterId?.response;

      if (existingVoterId?.status == 1) {
        const decryptedResponse = {
          ...existingVoterId?.response,
          "Voter Id": decryptedVoterId,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: decryptedResponse,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        governmentServiceLogger.info(
          `Returning cached valid voter id verfication response for client: ${storingClient}`,
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
          result: resOfvoter,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        governmentServiceLogger.info(
          `Returning cached invalid driving license response for client: ${storingClient}`,
        );
        return res.json({
          message: "Invalid",
          data: resOfvoter,
          success: false,
        });
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      governmentServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId} for this client: ${storingClient}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    governmentServiceLogger.info(
      `Active service selected for voter id verfication: ${service.serviceFor}`,
    );
    let voterIdResponse = await voterIdVerifyServiceResponse(
      capitalVoterId,
      service,
      0,
      storingClient,
    );

    governmentServiceLogger.info(
      `Response received in voterId verification from active service ${voterIdResponse?.service} with message: ${voterIdResponse?.message} of data: ${JSON.stringify(voterIdResponse?.result)}`,
    );

    if (voterIdResponse?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...voterIdResponse?.result,
        "Voter Id": encryptedVoterId,
      };

      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: voterIdResponse?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        voterId: encryptedVoterId,
        response: encryptedResponse,
        serviceResponse: voterIdResponse?.responseOfService,
        status: 1,
        ...(mobileNumber && { mobileNumber }),
        serviceId: `${voterIdResponse?.service}_voterId`,
        serviceName: voterIdResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await voterIdVerifyModel.create(storingData);
      governmentServiceLogger.info(
        `Valid voter id response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, voterIdResponse?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: {
          voterId: voterId,
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        voterId: encryptedVoterId,
        response: { voterId: voterId },
        serviceResponse: {},
        status: 2,
        ...(mobileNumber && { mobileNumber }),
        serviceId: `${voterIdResponse?.service}_voterId`,
        serviceName: voterIdResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await voterIdVerifyModel.create(storingData);
      governmentServiceLogger.info(
        `Invalid voter id response received and sent to client: ${storingClient}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { voterId: voterId }, "Invalid"));
    }
  } catch (error) {
    governmentServiceLogger.error(
      `System error in driving License verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handlePassportFileNoVerify = async (req, res) => {
  const data = req.body;
  const { passportFileNo, DateOfBirth, mobileNumber = "" } = data;
  const capitalFileNo = passportFileNo?.toUpperCase();
  const storingClient = req.clientId || "CID-6140971541";
      // Always generate txnId
    const tnId = genrateUniqueServiceId();
    governmentServiceLogger.info(
      `Generated driving license txn Id: ${tnId} for the client: ${storingClient}`,
    );

  const isFileNoValid = handleValidation(
    "passportFileNo",
    capitalFileNo,
    res,
    tnId,
    governmentServiceLogger
  );
  if (!isFileNoValid) return;

  const isDobValid = handleValidation(
    "DateOfBirth",
    DateOfBirth,
    res,
    tnId,
    governmentServiceLogger
  );
  if (!isDobValid) return;

  governmentServiceLogger.info(
    "All inputs in pan are valid, continue processing...",
  );

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "PASSPORT_WITH_FILE_NO",
    tnId,
    governmentServiceLogger
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    governmentServiceLogger.info(
      `Executing driving license verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    const identifierHash = hashIdentifiers({
      fileNo: capitalFileNo,
    }, governmentServiceLogger);

    const passportLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
      req,
      TxnID: tnId,
      logger: governmentServiceLogger
    });

    if (!passportLimitResult.allowed) {
      governmentServiceLogger.info(
        `Rate limit exceeded for driving license verification: client ${storingClient}, service: ${serviceId} category: ${categoryId}`,
      );
      return res.status(429).json({
        success: false,
        message: passportLimitResult.message,
      });
    }

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req || "test",
      governmentServiceLogger,
    );

    if (!maintainanceResponse?.result) {
      governmentServiceLogger.info(
        `Credit deduction failed for driving license verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedFileNo = encryptData(capitalFileNo);

    const existingPassport = await passportFileNoVerifyModel.findOne({
      passportFileNo: encryptedFileNo,
      dateOfBirth: DateOfBirth,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      governmentServiceLogger.warn(
        `Analytics update failed for passport verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    governmentServiceLogger.info(
      `Checked for existing passport verification record in DB: ${existingPassport ? "Found" : "Not Found"}`,
    );
    if (existingPassport) {
      const decryptedPanNumber = decryptData(existingPassport?.licenseNumber);
      const resOfDl = existingPassport?.response;

      if (existingPassport?.status == 1) {
        const decryptedResponse = {
          ...existingPassport?.response,
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
        governmentServiceLogger.info(
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
        governmentServiceLogger.info(
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
      governmentServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    governmentServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let FileNoResponse = await passportVerifyServiceResponse(
      { passportFileNo, DateOfBirth },
      service,
      0,
      storingClient,
    );

    governmentServiceLogger.info(
      `Response received from active service ${FileNoResponse?.service} with message: ${FileNoResponse?.message} of data: ${JSON.stringify(FileNoResponse?.result)}`,
    );

    if (FileNoResponse?.message?.toLowerCase() === "all services failed") {
      throw new Error("All passport verification services failed");
    }

    if (FileNoResponse?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...FileNoResponse?.result,
        "Driving License Number": encryptedFileNo,
      };

      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: FileNoResponse?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        passportFileNo: encryptedFileNo,
        dateOfBirth: DateOfBirth,
        response: encryptedResponse,
        serviceResponse: FileNoResponse?.responseOfService,
        status: 1,
        ...(mobileNumber && { mobileNumber }),
        serviceName: FileNoResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await passportFileNoVerifyModel.create(storingData);
      governmentServiceLogger.info(
        `Valid PAN response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, FileNoResponse?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: {
          passportFileNo: passportFileNo,
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        passportFileNo: encryptedFileNo,
        dateOfBirth: DateOfBirth,
        response: {
          passportFileNo: passportFileNo,
        },
        serviceResponse: {},
        status: 2,
        ...(mobileNumber && { mobileNumber }),
        serviceName: FileNoResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await passportFileNoVerifyModel.create(storingData);
      governmentServiceLogger.info(
        `Invalid PAN response received and sent to client: ${storingClient}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            passportFileNo: passportFileNo,
          },
          "Invalid",
        ),
      );
    }
  } catch (error) {
    governmentServiceLogger.error(
      `System error in driving License verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handleElectricityBill = async (req, res) => {
  const data = req.body;
  const { passportFileNo, DateOfBirth, mobileNumber = "" } = data;
  const capitalFileNo = passportFileNo?.toUpperCase();
  const storingClient = req.clientId || "CID-6140971541";

  const isFileNoValid = handleValidation(
    "passportFileNo",
    capitalFileNo,
    res,
    storingClient,
  );
  if (!isFileNoValid) return;

  const isDobValid = handleValidation(
    "DateOfBirth",
    DateOfBirth,
    res,
    storingClient,
  );
  if (!isDobValid) return;

  governmentServiceLogger.info(
    "All inputs in pan are valid, continue processing...",
  );

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "ELECTRICITY_BILL",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    governmentServiceLogger.info(
      `Executing driving license verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Always generate txnId
    const tnId = genrateUniqueServiceId();
    governmentServiceLogger.info(
      `Generated driving license txn Id: ${tnId} for the client: ${storingClient}`,
    );

    const identifierHash = hashIdentifiers({
      fileNo: capitalFileNo,
    });

    const passportLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!passportLimitResult.allowed) {
      governmentServiceLogger.info(
        `Rate limit exceeded for driving license verification: client ${storingClient}, service: ${serviceId} category: ${categoryId}`,
      );
      return res.status(429).json({
        success: false,
        message: passportLimitResult.message,
      });
    }

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req || "test",
      governmentServiceLogger,
    );

    if (!maintainanceResponse?.result) {
      governmentServiceLogger.info(
        `Credit deduction failed for driving license verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedFileNo = encryptData(capitalFileNo);

    const existingPassport = await passportVerifyModel.findOne({
      passportFileNo: encryptedFileNo,
      dateOfBirth: DateOfBirth,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      governmentServiceLogger.warn(
        `Analytics update failed for passport verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    governmentServiceLogger.info(
      `Checked for existing passport verification record in DB: ${existingPassport ? "Found" : "Not Found"}`,
    );
    if (existingPassport) {
      const decryptedPanNumber = decryptData(existingPassport?.licenseNumber);
      const resOfDl = existingPassport?.response;

      if (existingPassport?.status == 1) {
        const decryptedResponse = {
          ...existingPassport?.response,
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
        governmentServiceLogger.info(
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
        governmentServiceLogger.info(
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
      governmentServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    governmentServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let FileNoResponse = await electricityBillServiceResponse(
      { serviceNo, state },
      service,
      0,
      storingClient,
    );

    governmentServiceLogger.info(
      `Response received from active service ${FileNoResponse?.service} with message: ${FileNoResponse?.message} of data: ${JSON.stringify(FileNoResponse?.result)}`,
    );

    if (FileNoResponse?.message?.toLowerCase() === "all services failed") {
      throw new Error("All passport verification services failed");
    }

    if (FileNoResponse?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...FileNoResponse?.result,
        "Driving License Number": encryptedFileNo,
      };

      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: FileNoResponse?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        passportFileNo: encryptedFileNo,
        dateOfBirth: DateOfBirth,
        response: encryptedResponse,
        serviceResponse: FileNoResponse?.responseOfService,
        status: 1,
        ...(mobileNumber && { mobileNumber }),
        serviceName: FileNoResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await passportVerifyModel.create(storingData);
      governmentServiceLogger.info(
        `Valid PAN response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, FileNoResponse?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: {
          passportFileNo: passportFileNo,
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        passportFileNo: encryptedFileNo,
        dateOfBirth: DateOfBirth,
        response: {
          passportFileNo: passportFileNo,
        },
        serviceResponse: {},
        status: 2,
        ...(mobileNumber && { mobileNumber }),
        serviceName: FileNoResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await passportVerifyModel.create(storingData);
      governmentServiceLogger.info(
        `Invalid PAN response received and sent to client: ${storingClient}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            passportFileNo: passportFileNo,
          },
          "Invalid",
        ),
      );
    }
  } catch (error) {
    governmentServiceLogger.error(
      `System error in driving License verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handlePassportVerify = async (req, res) => {
  const data = req.body;
  const {
    passportFileNo,
    surname,
    firstName,
    gender,
    countryCode,
    dateOfBirth,
    passportType,
    dateOfExpiry,
    mrz1,
    mrz2,
    mobileNumber = "",
  } = data;
  const capitalFileNo = passportFileNo?.toUpperCase();
  const storingClient = req.clientId || "CID-6140971541";

  const isFileNoValid = handleValidation(
    "passportFileNo",
    capitalFileNo,
    res,
    storingClient,
  );
  if (!isFileNoValid) return;

  const isDobValid = handleValidation(
    "DateOfBirth",
    DateOfBirth,
    res,
    storingClient,
  );
  if (!isDobValid) return;

  governmentServiceLogger.info(
    "All inputs in pan are valid, continue processing...",
  );

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "PASSPORT_VERIFY",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    governmentServiceLogger.info(
      `Executing driving license verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Always generate txnId
    const tnId = genrateUniqueServiceId();
    governmentServiceLogger.info(
      `Generated driving license txn Id: ${tnId} for the client: ${storingClient}`,
    );

    const identifierHash = hashIdentifiers({
      fileNo: capitalFileNo,
    });

    const passportLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!passportLimitResult.allowed) {
      governmentServiceLogger.info(
        `Rate limit exceeded for driving license verification: client ${storingClient}, service: ${serviceId} category: ${categoryId}`,
      );
      return res.status(429).json({
        success: false,
        message: passportLimitResult.message,
      });
    }

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req || "test",
      governmentServiceLogger,
    );

    if (!maintainanceResponse?.result) {
      governmentServiceLogger.info(
        `Credit deduction failed for driving license verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedFileNo = encryptData(capitalFileNo);

    const existingPassport = await passportVerifyModel.findOne({
      passportFileNo: encryptedFileNo,
      dateOfBirth: DateOfBirth,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      governmentServiceLogger.warn(
        `Analytics update failed for passport verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    governmentServiceLogger.info(
      `Checked for existing passport verification record in DB: ${existingPassport ? "Found" : "Not Found"}`,
    );
    if (existingPassport) {
      const decryptedPanNumber = decryptData(existingPassport?.licenseNumber);
      const resOfDl = existingPassport?.response;

      if (existingPassport?.status == 1) {
        const decryptedResponse = {
          ...existingPassport?.response,
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
        governmentServiceLogger.info(
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
        governmentServiceLogger.info(
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
      governmentServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    governmentServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let FileNoResponse = await passportVerifyServiceResponse(
      { passportFileNo, DateOfBirth },
      service,
      0,
      storingClient,
    );

    governmentServiceLogger.info(
      `Response received from active service ${FileNoResponse?.service} with message: ${FileNoResponse?.message} of data: ${JSON.stringify(FileNoResponse?.result)}`,
    );

    if (FileNoResponse?.message?.toLowerCase() === "all services failed") {
      throw new Error("All passport verification services failed");
    }

    if (FileNoResponse?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...FileNoResponse?.result,
        "Driving License Number": encryptedFileNo,
      };

      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: FileNoResponse?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        passportFileNo: encryptedFileNo,
        dateOfBirth: DateOfBirth,
        response: encryptedResponse,
        serviceResponse: FileNoResponse?.responseOfService,
        status: 1,
        ...(mobileNumber && { mobileNumber }),
        serviceName: FileNoResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await passportVerifyModel.create(storingData);
      governmentServiceLogger.info(
        `Valid PAN response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, FileNoResponse?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: {
          passportFileNo: passportFileNo,
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        passportFileNo: encryptedFileNo,
        dateOfBirth: DateOfBirth,
        response: {
          passportFileNo: passportFileNo,
        },
        serviceResponse: {},
        status: 2,
        ...(mobileNumber && { mobileNumber }),
        serviceName: FileNoResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await passportVerifyModel.create(storingData);
      governmentServiceLogger.info(
        `Invalid PAN response received and sent to client: ${storingClient}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            passportFileNo: passportFileNo,
          },
          "Invalid",
        ),
      );
    }
  } catch (error) {
    governmentServiceLogger.error(
      `System error in driving License verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.handlePassportOcrVerify = async (req, res) => {
  const data = req.body;
  const {
    passportFileNo,
    surname,
    firstName,
    gender,
    dateOfBirth,
    dateOfIssue,
    dateOfExpiry,
    mrz1,
    mrz2,
    mobileNumber = "",
  } = data;
  const capitalFileNo = passportFileNo?.toUpperCase();
  const storingClient = req.clientId || "CID-6140971541";

  const isFileNoValid = handleValidation(
    "passportFileNo",
    capitalFileNo,
    res,
    storingClient,
  );
  if (!isFileNoValid) return;

  const isDobValid = handleValidation(
    "DateOfBirth",
    DateOfBirth,
    res,
    storingClient,
  );
  if (!isDobValid) return;

  governmentServiceLogger.info(
    "All inputs in pan are valid, continue processing...",
  );

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "PASSPORT_VERIFY",
    storingClient,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  try {
    governmentServiceLogger.info(
      `Executing driving license verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Always generate txnId
    const tnId = genrateUniqueServiceId();
    governmentServiceLogger.info(
      `Generated driving license txn Id: ${tnId} for the client: ${storingClient}`,
    );

    const identifierHash = hashIdentifiers({
      fileNo: capitalFileNo,
    });

    const passportLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!passportLimitResult.allowed) {
      governmentServiceLogger.info(
        `Rate limit exceeded for driving license verification: client ${storingClient}, service: ${serviceId} category: ${categoryId}`,
      );
      return res.status(429).json({
        success: false,
        message: passportLimitResult.message,
      });
    }

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req || "test",
      governmentServiceLogger,
    );

    if (!maintainanceResponse?.result) {
      governmentServiceLogger.info(
        `Credit deduction failed for driving license verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const encryptedFileNo = encryptData(capitalFileNo);

    const existingPassport = await passportVerifyModel.findOne({
      passportFileNo: encryptedFileNo,
      dateOfBirth: DateOfBirth,
    });

    const analyticsResult = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsResult.success) {
      governmentServiceLogger.warn(
        `Analytics update failed for passport verification: client ${storingClient}, service ${serviceId}`,
      );
    }

    governmentServiceLogger.info(
      `Checked for existing passport verification record in DB: ${existingPassport ? "Found" : "Not Found"}`,
    );
    if (existingPassport) {
      const decryptedPanNumber = decryptData(existingPassport?.licenseNumber);
      const resOfDl = existingPassport?.response;

      if (existingPassport?.status == 1) {
        const decryptedResponse = {
          ...existingPassport?.response,
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
        governmentServiceLogger.info(
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
        governmentServiceLogger.info(
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
      governmentServiceLogger.warn(
        `Active service not found for category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    governmentServiceLogger.info(
      `Active service selected for PAN verification: ${service.serviceFor}`,
    );
    let FileNoResponse = await passportVerifyServiceResponse(
      { passportFileNo, DateOfBirth },
      service,
      0,
      storingClient,
    );

    governmentServiceLogger.info(
      `Response received from active service ${FileNoResponse?.service} with message: ${FileNoResponse?.message} of data: ${JSON.stringify(FileNoResponse?.result)}`,
    );

    if (FileNoResponse?.message?.toLowerCase() === "all services failed") {
      throw new Error("All passport verification services failed");
    }

    if (FileNoResponse?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...FileNoResponse?.result,
        "Driving License Number": encryptedFileNo,
      };

      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: FileNoResponse?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });

      const storingData = {
        passportFileNo: encryptedFileNo,
        dateOfBirth: DateOfBirth,
        response: encryptedResponse,
        serviceResponse: FileNoResponse?.responseOfService,
        status: 1,
        ...(mobileNumber && { mobileNumber }),
        serviceName: FileNoResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await passportVerifyModel.create(storingData);
      governmentServiceLogger.info(
        `Valid PAN response stored and sent to client: ${storingClient}`,
      );

      return res
        .status(200)
        .json(createApiResponse(200, FileNoResponse?.result, "Valid"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        clientId: storingClient,
        result: {
          passportFileNo: passportFileNo,
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        passportFileNo: encryptedFileNo,
        dateOfBirth: DateOfBirth,
        response: {
          passportFileNo: passportFileNo,
        },
        serviceResponse: {},
        status: 2,
        ...(mobileNumber && { mobileNumber }),
        serviceName: FileNoResponse?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };
      await passportVerifyModel.create(storingData);
      governmentServiceLogger.info(
        `Invalid PAN response received and sent to client: ${storingClient}`,
      );
      return res.status(404).json(
        createApiResponse(
          404,
          {
            passportFileNo: passportFileNo,
          },
          "Invalid",
        ),
      );
    }
  } catch (error) {
    governmentServiceLogger.error(
      `System error in driving License verification for client ${storingClient}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};


// TIN VERIFICATION (TRUTHSCREEN:Service has been deprecated) 
exports.handleTINVerification = async (req, res) => {
  const { TIN, mobileNumber = "" } = req.body;
  const clientId = req.clientId;
  const TxnID = await generateTransactionId(12);

  if (!TIN) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }

  businessServiceLogger.info(`TxnID:${TxnID}, TIN Number Details: ${TIN}`);
  try {
    const { idOfCategory: categoryId, idOfService: serviceId } = await getCategoryIdAndServiceId('TIN', TxnID, businessServiceLogger);

    businessServiceLogger.info(
      `TxnID:${TxnID}, Executing TIN verification for client: ${clientId}, service: ${serviceId}, category: ${categoryId}`,
    );

    //1. HASH TIN NUMBER
    const identifierHash = hashIdentifiers({
      TIN
    }, businessServiceLogger);

    //2. CHECK THE RATE LIMIT AND IS PRODUCT IS SUBSCRIBE
    const tinRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId,
      req,
      TxnID,
      logger: businessServiceLogger
    });

    if (!tinRateLimitResult.allowed) {
      businessServiceLogger.warn(`Rate limit exceeded for TIN verification TxnID:${TxnID}, client ${clientId}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: tinRateLimitResult.message,
      });
    };

    businessServiceLogger.info(`Generated TIN txn Id: ${TxnID}`);

    // 3. DEBIT THE WALLET AMOUNT BASED ON USEAGE
    const maintainanceResponse = await deductCredits(
      clientId,
      serviceId,
      categoryId,
      TxnID,
      req,
      businessServiceLogger
    );

    if (!maintainanceResponse?.result) {
      businessServiceLogger.error(`TxnID:${TxnID}, Credit deduction failed for TIN verification: client ${clientId}, txnId ${TxnID}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    // 4. CHECK IN THE DB IS DATA PRESENT 
    const encryptedtTIN = encryptData(TIN);

    const existingTin = await tin_verifyModel.findOne({ tinNumber: encryptedtTIN })

    // 5. UPDATE TO THE ANALYTICS COLLECTION
    const analyticsResult = await AnalyticsDataUpdate(
      clientId,
      serviceId,
      categoryId,
      'success',
      businessServiceLogger
    );
    if (!analyticsResult.success) {
      businessServiceLogger.warn(
        `TxnID:${TxnID}, Analytics update failed for TIN verification: client ${clientId}, service ${serviceId}`,
      );
    }

    businessServiceLogger.info(
      `txnId: ${TxnID}, Checked for existing TIN record in DB: ${existingTin ? "Found" : "Not Found"}`,
    );

    // 6. IF DATA IS PRESENT THEN RETURN THE RESPONSE
    if (existingTin) {
      if (existingTin?.status == 1) {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached TIN response for client: ${clientId}`,
        );

        const decrypted = {
          ...existingTin?.response,
          tinNumber: TIN,
        };
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingTin?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = decrypted;
        return res
          .status(200)
          .json(createApiResponse(200, dataToShow, "Valid"));
      } else {
        businessServiceLogger.info(
          `txnId: ${TxnID}, Returning cached TIN response for client: ${clientId}`,
        );
        await responseModel.create({
          serviceId,
          categoryId,
          TxnID,
          clientId,
          result: existingTin?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        const dataToShow = existingTin?.response;
        return res
          .status(404)
          .json(createApiResponse(404, dataToShow, "inValid"));
      }
    };

    //7. IF NOT DATA FOUND THEN CALL TO SERVICE PROVIDERS
    const service = await selectService(categoryId, serviceId, clientId, req, businessServiceLogger);
    if (!service.length) {
      businessServiceLogger.warn(
        `TxnID:${TxnID}, Active service not found for TIN category ${categoryId}, service ${serviceId}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    businessServiceLogger.info(
      `txnId: ${TxnID}, Active service selected for TIN verification: ${service}`
    );

    // 8. CALL TO SERVICE PROVIDERS AND GET RESPONSE 
    let response = await TinActiveServiceResponse(TIN, service, 0, TxnID);
    businessServiceLogger.info(
      `txnId: ${TxnID}, Response received TIN from active service ${response?.service}: ${response?.message}`,
    );

    // 9. IF RESPONSE IS VALID THEN UPDATE TO THE DB AND SEND RESPONSE
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        tinNumber: encryptedtTIN,
      };
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: response?.result,
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 1,
        tinNumber: encryptedtTIN,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        message: response?.message,
        mobileNumber,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await tin_verifyModel.findOneAndUpdate(
        { TIN: encryptedtTIN },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );
      businessServiceLogger.info(
        `txnId: ${TxnID}, Valid TIN response stored and sent to client: ${clientId}`,
      );
      return res
        .status(200)
        .json(createApiResponse(200, response?.result, "Success"));
    } else {
      await responseModel.create({
        serviceId,
        categoryId,
        TxnID,
        clientId,
        result: {
          tinNumber: TIN
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        status: 2,
        tinNumber: encryptedtTIN,
        response: {
          tinNumber: TIN
        },
        serviceResponse: {},
        serviceName: response?.service,
        mobileNumber,
        message: response?.message,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await tin_verifyModel.findOneAndUpdate(
        { TIN: encryptedtTIN },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );
      businessServiceLogger.info(
        `txnId: ${TxnID}, Invalid TIN response received and sent to client: ${clientId}`,
      );
      return res
        .status(404)
        .json(createApiResponse(404, { tinNumber: TIN }, "Failed"));
    }

  } catch (error) {
    businessServiceLogger.error(
      `txnId: ${TxnID}, System error in TIN verification for client ${clientId}: ${error.message}`,
      error,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};