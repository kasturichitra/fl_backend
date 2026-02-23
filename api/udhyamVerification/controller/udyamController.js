const { createApiResponse } = require("../../../utils/ApiResponseHandler");
const { deductCredits } = require("../../../services/CreditService");
const { encryptData } = require("../../../utils/EncryptAndDecrypt");
const { ERROR_CODES, mapError } = require("../../../utils/errorCodes");
const { findingInValidResponses } = require("../../../utils/InvalidResponses");
const handleValidation = require("../../../utils/lengthCheck");
const {
  udyamActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/UdyamServiceResponse");
const { companyLogger, kycLogger } = require("../../Logger/logger");
const { selectService } = require("../../service/serviceSelector");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const udhyamVerify = require("../model/udyamModel");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");

const udyamNumberVerfication = async (req, res, next) => {
  const {
    udyamNumber,
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
    clientId = "",
  } = req.body;

  companyLogger.debug(`udyamNumber ==>> ${udyamNumber}`);
  companyLogger.info(`udyamNumber from request ===> ${udyamNumber}`);

  const capitalUdyamNumber = udyamNumber?.toUpperCase();
  const isValid = handleValidation("udyam", capitalUdyamNumber, res);
  if (!isValid) return;

  kycLogger.info("All inputs in udyam are valid, continue processing...");

  const storingClient = req.clientId || clientId;

  try {
    companyLogger.info(`Executing Udyam verification for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`);

    const identifierHash = hashIdentifiers({
      udyamNo: capitalUdyamNumber,
    });

    const udyamRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!udyamRateLimitResult.allowed) {
      companyLogger.warn(`Rate limit exceeded for Udyam verification: client ${storingClient}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: udyamRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    companyLogger.info(`Generated Udyam txn Id: ${tnId}`);

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment
    );

    if (!maintainanceResponse?.result) {
      companyLogger.error(`Credit deduction failed for Udyam verification: client ${storingClient}, txnId ${tnId}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const encryptedUdhyam = encryptData(capitalUdyamNumber);
    companyLogger.debug(`Encrypted Udyam number for DB lookup`);

    const existingUdhyamNumber = await udhyamVerify.findOne({
      udyamNumber: encryptedUdhyam,
    });

    // Note: AnalyticsDataUpdate was missing in this controller, adding it for consistency
    const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
    const analyticsResult = await AnalyticsDataUpdate(storingClient, serviceId, categoryId);
    if (!analyticsResult.success) {
      companyLogger.warn(`Analytics update failed for Udyam verification: client ${storingClient}, service ${serviceId}`);
    }

    companyLogger.debug(`Checked for existing Udyam record in DB: ${existingUdhyamNumber ? "Found" : "Not Found"}`);

    if (existingUdhyamNumber) {
      if (existingUdhyamNumber?.status == 1) {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: existingUdhyamNumber?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        companyLogger.info(`Returning cached valid Udyam response for client: ${storingClient}`);
        return res
          .status(200)
          .json(createApiResponse(200, existingUdhyamNumber?.response, "Valid"));
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: {
            ...findingInValidResponses("udyam"),
            udyam: udyamNumber,
          },
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        companyLogger.info(`Returning cached invalid Udyam response for client: ${storingClient}`);
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
    if (!service) {
      companyLogger.warn(`Active service not found for Udyam category ${categoryId}, service ${serviceId}`);
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    companyLogger.info(`Active service selected for Udyam verification: ${service.serviceFor}`);
    let response = await udyamActiveServiceResponse(udyamNumber, service);

    companyLogger.info(
      `Response received from active service ${service.serviceFor}: ${response?.message}`,
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
      companyLogger.info(`Valid Udyam response stored and sent to client: ${storingClient}`);
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

      companyLogger.info(`Invalid Udyam response received and sent to client: ${storingClient}`);
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
    companyLogger.error(`System error in Udyam verification for client ${storingClient}: ${error.message}`, error);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

module.exports = udyamNumberVerfication;

