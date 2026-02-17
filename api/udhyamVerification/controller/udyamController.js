const { createApiResponse } = require("../../../utlis/ApiResponseHandler");
const chargesToBeDebited = require("../../../utlis/chargesMaintainance");
const creditsToBeDebited = require("../../../utlis/creditsMaintainance");
const { encryptData } = require("../../../utlis/EncryptAndDecrypt");
const { ERROR_CODES, mapError } = require("../../../utlis/errorCodes");
const { findingInValidResponses } = require("../../../utlis/InvalidResponses");
const handleValidation = require("../../../utlis/lengthCheck");
const {
  udyamActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/UdyamServiceResponse");
const { companyLogger } = require("../../Logger/logger");
const { selectService } = require("../../service/serviceSelector");
const udhyamVerify = require("../model/udyamModel");

const udyamNumberVerfication = async (req, res, next) => {
  const {
    udyamNumber,
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
  } = req.body;

  console.log("udyamNumber ==>", udyamNumber);
  companyLogger.info("udyamNumber from request ===>", udyamNumber);

  const capitalUdyamNumber = panNumber?.toUpperCase();
  const isValid = handleValidation("udyam", capitalUdyamNumber, res);
  if (!isValid) return;

  console.log("All inputs in pan are valid, continue processing...");
  kycLogger.info("All inputs in pan are valid, continue processing...");

  const identifierHash = hashIdentifiers({
    udyamNo: capitalUdyamNumber,
  });

  const udyamRateLimitResult = await checkingRateLimit({
    identifiers: { identifierHash },
    serviceId,
    categoryId,
    clientId: req.clientId,
  });

  if (!udyamRateLimitResult.allowed) {
    return res.status(429).json({
      success: false,
      message: udyamRateLimitResult.message,
    });
  }

  const tnId = genrateUniqueServiceId();
  companyLogger.info(`udyam txn Id ===>> ${tnId}`);
  let maintainanceResponse;

  if (req.environment?.toLowercase() == "test") {
    maintainanceResponse = await creditsToBeDebited(
      req.clientId,
      serviceId,
      categoryId,
      tnId,
    );
  } else {
    maintainanceResponse = await chargesToBeDebited(
      req.clientId,
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

  const encryptedUdhyam = encryptData(capitalUdyamNumber);
  console.log("encryptedUdhyam ====>>>", encryptedUdhyam);

  const existingUdhyamNumber = await udhyamVerify.findOne({
    udyamNumber: encryptedUdhyam,
  });

  console.log("existingUdhyamNumber ====>>", existingUdhyamNumber);

  if (existingUdhyamNumber) {
    if (existingUdhyamNumber?.status == 1) {
      return res
        .status(200)
        .json(createApiResponse(200, existingUdhyamNumber?.response, "Valid"));
    } else {
      return res.status(200).json(
        createApiResponse(
          200,
          {
            ...findingInValidResponses("udyam"),
            udyam: udyamNumber,
          },
          "InValid",
        ),
      );
    }
  }

  const service = await selectService(categoryId, serviceId);
  console.log("----active service for udyam Verify is ----", service);
  console.log(
    "----active service for udyam Verify is ----",
    JSON.stringify(service),
  );

  try {
    let response = await udyamActiveServiceResponse(udyamNumber, service);
    console.log(
      `response from active service for udhyam ${JSON.stringify(response)}`,
    );
    companyLogger.info(
      `response from active service for udhyam ${service.serviceFor
      } ${JSON.stringify(response)}`
    );
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        udyam: encryptedUdhyam,
      };

      const storingData = {
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        status: 1,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      const existingOrNew = await udhyamVerify.findOneAndUpdate(
        { udyamNumber: encryptedUdhyam },
        { $setOnInsert: storingData },
        { upsert: true, new: true },
      );
      return res
        .status(200)
        .json(createApiResponse(200, existingOrNew.response, "Valid"));
    } else {
      const InValidData = {
        response: {},
        serviceResponse: {},
        status: 2,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await udhyamVerify.findOneAndUpdate(
        { udyamNumber: encryptedUdhyam },
        { $setOnInsert: InValidData },
        { upsert: true, new: true },
      );

      return res.status(404).json(
        createApiResponse(
          404,
          {
            ...findingInValidResponses("udyam"),
            udyam: udyamNumber,
          },
          "InValid",
        ),
      );
    }
  } catch (error) {
    console.log("error in verifyUdhyamNumber ===>>>", error);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

module.exports = udyamNumberVerfication;
