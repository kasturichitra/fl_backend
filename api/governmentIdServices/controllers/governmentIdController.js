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
} = require("../../GlobalApiserviceResponse/governmentServicesResp");
const { governmentServiceLogger } = require("../../Logger/logger");
const { selectService } = require("../../service/serviceSelector");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const passportVerifyModel = require("../models/passportVerifyModel");
const voterIdVerifyModel = require("../models/voterIdVerifyModel");

exports.handleVoterIdVerify = async (req, res) => {
  const data = req.body;
  const { voterId, mobileNumber = "", serviceId = "", categoryId = "" } = data;
  const capitalVoterId = voterId?.toUpperCase();
  const storingClient = req.clientId || "CID-6140971541";

  const isValid = handleValidation(
    "voterId",
    capitalVoterId,
    res,
    storingClient,
  );
  if (!isValid) return;

  governmentServiceLogger.info(
    "All inputs in voter id verification are valid, continue processing...",
  );

  try {
    governmentServiceLogger.info(
      `Executing driving license verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // Always generate txnId
    const tnId = genrateUniqueServiceId();
    governmentServiceLogger.info(
      `Generated voter id txn Id: ${tnId} for the client: ${storingClient}`,
    );

    // const identifierHash = hashIdentifiers({
    //   voter: capitalVoterId,
    // });

    // const voterIdLimitResult = await checkingRateLimit({
    //   identifiers: { identifierHash },
    //   serviceId,
    //   categoryId,
    //   clientId: storingClient,
    // });

    // if (!voterIdLimitResult.allowed) {
    //   governmentServiceLogger.warn(
    //     `Rate limit exceeded for driving license verification: client ${storingClient}, service: ${serviceId} category: ${categoryId}`,
    //   );
    //   return res.status(429).json({
    //     success: false,
    //     message: voterIdLimitResult.message,
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
    //   governmentServiceLogger.error(
    //     `Credit deduction failed for driving license verification: client ${storingClient}, txnId ${tnId}`,
    //   );
    //   return res.status(500).json({
    //     success: false,
    //     message: maintainanceResponse?.message || "InValid",
    //     response: {},
    //   });
    // }

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

    governmentServiceLogger.debug(
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
          message: "InValid",
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
          ...findingInValidResponses("voterId"),
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        voterId: encryptedVoterId,
        response: { voterId: voterId, ...findingInValidResponses("voterId") },
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
        .json(
          createApiResponse(
            404,
            { voterId: voterId, ...findingInValidResponses("voterId") },
            "InValid",
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
    DateOfBirth,
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
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
      req.environment || "test",
    );

    if (!maintainanceResponse?.result) {
      governmentServiceLogger.info(
        `Credit deduction failed for driving license verification: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
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

    governmentServiceLogger.debug(
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
          message: "InValid",
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
        serviceId: `${FileNoResponse?.service}_passport`,
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
          ...findingInValidResponses("passport"),
        },
        createdTime: new Date().toLocaleTimeString(),
        createdDate: new Date().toLocaleDateString(),
      });
      const storingData = {
        passportFileNo: encryptedFileNo,
        dateOfBirth: DateOfBirth,
        response: findingInValidResponses("passport"),
        serviceResponse: {},
        status: 2,
        ...(mobileNumber && { mobileNumber }),
        serviceId: `${FileNoResponse?.service}_passport`,
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
            licenseNumber: licenseNo,
            ...findingInValidResponses("passport"),
          },
          "Failed",
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
