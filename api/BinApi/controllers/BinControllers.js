const axios = require("axios");
require("dotenv").config();
const RapidApiModel = require("../models/BinApiModels");
const RapidApiBankModel = require("../models/BinApiBankModel");
const handleValidation = require("../../../utils/lengthCheck");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const { bankServiceLogger } = require("../../Logger/logger");
const { BinActiveServiceResponse } = require("../service/BinServiceResponse");
const {
  IfscActiveServiceResponse,
} = require("../service/IfscActiveServiceResponse");
const { deductCredits } = require("../../../services/CreditService");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const { ERROR_CODES } = require("../../../utils/errorCodes");
const { encryptData } = require("../../../utils/EncryptAndDecrypt");
const { selectService } = require("../../service/serviceSelector");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");

exports.getCardDetailsByNumber = async (req, res) => {
  const {
    bin,
    serviceId = "",
    categoryId = "",
    mobileNumber = "",
    clientId = "",
  } = req.body;

  console.log("bin detailes=---> ", bin);
  bankServiceLogger.info("bin data to be verified ====>", bin);

  const storingClient = req.clientId || clientId;

  const isValid = handleValidation("bin", bin, res);
  if (!isValid) return;

  const encryptedBinNumber = encryptData(bin);
  bankServiceLogger.info(
    `encryptedBinNumber: ${encryptedBinNumber} for this client: ${storingClient} ====>>`,
  );
  bankServiceLogger.info(
    `encryptedBinNumber: ${encryptedBinNumber} for this client: ${storingClient} ====>>`,
  );

  try {
    bankServiceLogger.info(
      `Executing Card BIN check for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    const identifierHash = hashIdentifiers({
      binNumber: bin,
    });

    const binRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
      req,
    });

    if (!binRateLimitResult.allowed) {
      bankServiceLogger.info(
        `[Bin validation] Rate limit exceed for this client: ${storingClient}`,
      );
      console.log(
        `[Bin validation] Rate limit exceed for this client: ${storingClient}`,
      );
      return res.status(429).json({
        success: false,
        message: binRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    console.log(`bin txn Id: ${tnId} for this client: ${storingClient}`);
    bankServiceLogger.info(
      `bin txn Id: ${tnId} for this client: ${storingClient}`,
    );
    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment,
    );

    if (!maintainanceResponse?.result) {
      bankServiceLogger.error(
        `Credit deduction failed for Card BIN check: client ${storingClient}, txnId ${tnId}`,
      );
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "Invalid",
        response: {},
      });
    }

    const existingBinNumber = await RapidApiModel.findOne({
      bin: encryptedBinNumber,
    });

    const analyticsRes = await AnalyticsDataUpdate(
      storingClient,
      serviceId,
      categoryId,
    );
    if (!analyticsRes?.success) {
      bankServiceLogger.info("analytics failed ====>>", analyticsRes?.success);
      return res.status(400).json({
        response: `clientId or serviceId or categoryId is Missing or Invalid 🤦‍♂️`,
        ...ERROR_CODES?.BAD_REQUEST,
      });
    }

    if (existingBinNumber) {
      if (existingBinNumber?.status == 1) {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: existingBinNumber?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        return res.status(200).json({
          message: "valid",
          success: true,
          response: existingBinNumber?.response,
        });
      } else {
        await responseModel.create({
          serviceId,
          categoryId,
          clientId: storingClient,
          result: existingBinNumber?.response,
          createdTime: new Date().toLocaleTimeString(),
          createdDate: new Date().toLocaleDateString(),
        });
        return res.status(404).json({
          message: "Invalid",
          success: false,
          response: existingBinNumber.response,
        });
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      bankServiceLogger.info(
        `Active service not found for Card BIN category ${categoryId} and service ${serviceId} for this client: ${storingClient}`,
      );
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    bankServiceLogger.info(
      `Active service selected for Card BIN check: ${service.serviceFor} for this client ${storingClient}`,
    );
    let response = await BinActiveServiceResponse(
      bin,
      service,
      0,
      storingClient,
    );

    bankServiceLogger.info(
      `[Bin Verification] Response from active provider: ${response} for this client: ${storingClient}`,
    );

    if (response) {
      if (response?.message?.toLowerCase() == "valid") {
        bankServiceLogger.info(
          `Response received from active service ${service.serviceFor}`,
        );
        let saveData = await RapidApiModel({
          bin: encryptedBinNumber,
          response: response?.result,
          serviceResponse: response?.responseOfService,
          staus: 1,
          serviceId: `${response?.service}_bin`,
          serviceName: response?.service,
          createdDate: new Date().toLocaleDateString(),
          createdTime: new Date().toLocaleTimeString(),
        });
        await saveData.save();
        bankServiceLogger.info(
          `Valid Card BIN response stored and sent to client: ${storingClient}`,
        );

        return res.status(200).json({
          message: "valid",
          success: true,
          response: response?.result,
        });
      } else {
        bankServiceLogger.info(
          `Response received from active service ${service.serviceFor}`,
        );
        let saveData = await RapidApiModel({
          bin: encryptedBinNumber,
          response: response?.result,
          serviceResponse: response?.responseOfService,
          staus: 2,
          serviceId: `${response?.service}_bin`,
          serviceName: response?.service,
          createdDate: new Date().toLocaleDateString(),
          createdTime: new Date().toLocaleTimeString(),
        });
        await saveData.save();
        bankServiceLogger.info(
          `Valid Card BIN response stored and sent to client: ${storingClient}`,
        );

        return res.status(404).json({
          message: "Invalid",
          success: false,
          response: response?.result,
        });
      }
    }
  } catch (error) {
    bankServiceLogger.info(
      `System error in Card BIN check for client ${storingClient}: ${error.message}`,
    );
    bankServiceLogger.info(
      `System error in Card BIN check for client ${storingClient}: ${error} ${JSON.stringify(error)}`,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.getBankDetailsByIfsc = async (req, res) => {
  const { ifsc, mobileNumber = "" } = req.body;
  const data = req.body;
  bankServiceLogger.info(`IFSC Code: ${ifsc}`);
  const storingClient = req.clientId;
  const tnId = genrateUniqueServiceId();
  bankServiceLogger.info(
    `IFSC search txn Id ===>> ${tnId} for the client: ${storingClient}`,
  );

  const isValid = await handleValidation(
    "ifsc",
    ifsc,
    res,
    tnId,
    bankServiceLogger,
  );

  if (!isValid) return;

  const { idOfCategory, idOfService } = getCategoryIdAndServiceId(
    "IFSC_SEARCH",
    tnId,
    bankServiceLogger,
  );
  console.log("idOfService and idOfCategory ====>>", idOfService, idOfCategory);

  const categoryId = idOfCategory;
  const serviceId = idOfService;

  // Common: hash identifier
  const identifierHash = hashIdentifiers(
    {
      ifsc: ifsc,
    },
    bankServiceLogger,
  );

  const ifscRateLimitResult = await checkingRateLimit({
    identifiers: { identifierHash },
    serviceId,
    categoryId,
    clientId: storingClient,
    req,
    TxnID: tnId,
    logger: bankServiceLogger,
  });

  if (!ifscRateLimitResult.allowed) {
    bankServiceLogger.warn(
      `Rate limit exceeded for ifsc search for this client: ${storingClient} with service: ${serviceId} and category: ${categoryId}`,
    );
    return res.status(429).json({
      success: false,
      message: ifscRateLimitResult.message,
    });
  }

  let maintainanceResponse;
  maintainanceResponse = await deductCredits(
    storingClient,
    serviceId,
    categoryId,
    tnId,
    req,
    bankServiceLogger,
  );

  if (!maintainanceResponse?.result) {
    return res.status(500).json({
      success: false,
      message: "Invalid",
      response: {},
    });
  }

  const existingBankDetails = await RapidApiBankModel.findOne({ Ifsc: ifsc });

  const analyticsRes = await AnalyticsDataUpdate(
    storingClient,
    serviceId,
    categoryId,
    "success",
    tnId,
    bankServiceLogger,
  );
  if (!analyticsRes?.success) {
    return res.status(400).json({
      response: `clientId or serviceId or categoryId is Missing or Invalid 🤦‍♂️`,
      ...ERROR_CODES?.BAD_REQUEST,
    });
  }

  if (existingBankDetails) {
    const statusOne = existingBankDetails?.status == 1;
    await responseModel.create({
      serviceId,
      categoryId,
      clientId: storingClient,
      result: statusOne ? existingBankDetails?.response : { ifsc },
      createdTime: new Date().toLocaleTimeString(),
      createdDate: new Date().toLocaleDateString(),
    });
    return res
      .status(statusOne ? 200 : 404)
      .json(
        createApiResponse(
          statusOne ? 200 : 404,
          statusOne ? existingBankDetails?.response : { ifsc },
          statusOne ? "Valid" : "Invalid",
        ),
      );
  }
  const service = await selectService(
    categoryId,
    serviceId,
    tnId,
    req,
    bankServiceLogger,
  );

  try {
    const ifscResponse = await IfscActiveServiceResponse(
      data,
      service,
      0,
      storingClient,
    );
    bankServiceLogger.info(
      `Response received from active service: ${ifscResponse?.service} with message: ${ifscResponse?.message} of response: ${JSON.stringify(ifscResponse)}`,
    );
    const isValid = aadhaarResponse?.message?.toUpperCase() === "VALID";
    const noRecord =
      aadhaarResponse?.message?.toUpperCase() === "NO RECORD FOUND";
    let done = await RapidApiBankModel.findOneAndUpdate(
      { Ifsc: ifsc }, // search condition
      {
        $set: {
          Ifsc: ifsc,
          status: 1,
          response: ifscResponse?.result,
          serviceName: ifscResponse?.service,
          createdDate: new Date().toLocaleDateString(),
          createdTime: new Date().toLocaleTimeString(),
        },
      },
      {
        new: true, // return updated document
        upsert: true, // create if not exists
      },
    );

    if (done) {
      bankServiceLogger.info(
        `${isValid ? "Valid" : "Invalid"} Bank Data save to db successfully for this client: ${storingClient} with this txnId: ${tnId}`,
      );
    }
    return res
      .status(isValid ? 200 : 404)
      .json(
        createApiResponse(
          isValid ? 200 : 404,
          isValid ? ifscResponse?.result : { ifsc },
          isValid ? "Valid" : "Invalid",
        ),
      );
  } catch (error) {
    bankServiceLogger.error(
      `Error fetching Bank info through ifsc for this client: ${storingClient}: ${error.message}`,
    );
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
