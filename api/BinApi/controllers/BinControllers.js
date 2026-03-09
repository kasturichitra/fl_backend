const axios = require("axios");
require("dotenv").config();
const RapidApiModel = require("../models/BinApiModels");
const RapidApiBankModel = require("../models/BinApiBankModel");
const handleValidation = require("../../../utils/lengthCheck");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const { bankServiceLogger } = require("../../Logger/logger");
const {
  BinActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/BinServiceResponse");
const {
  IfscActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/IfscActiveServiceResponse");
const { deductCredits } = require("../../../services/CreditService");
const responseModel = require("../../serviceResponses/model/serviceResponseModel");
const AnalyticsDataUpdate = require("../../../utils/analyticsStoring");
const checkingRateLimit = require("../../../utils/checkingRateLimit");
const { hashIdentifiers } = require("../../../utils/hashIdentifier");
const { ERROR_CODES } = require("../../../utils/errorCodes");
const { encryptData } = require("../../../utils/EncryptAndDecrypt");
const { selectService } = require("../../service/serviceSelector");

let RapidApiKey = process.env.RAPIDAPI_KEY;
let RapidApiHost = process.env.RAPIDAPI_BIN_HOST;
let RapidApiBankHost = process.env.RAPIDAPI_IFSC_HOST;

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
  bankServiceLogger.debug(
    `encryptedBinNumber: ${encryptedBinNumber} for this client: ${storingClient} ====>>`,
  );
  bankServiceLogger.info(
    `encryptedBinNumber: ${encryptedBinNumber} for this client: ${storingClient} ====>>`,
  );

  try {
    bankServiceLogger.info(
      `Executing Card BIN check for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`,
    );

    // const identifierHash = hashIdentifiers({
    //   binNumber: bin,
    // });

    // const binRateLimitResult = await checkingRateLimit({
    //   identifiers: { identifierHash },
    //   serviceId,
    //   categoryId,
    //   clientId: storingClient,
    // });

    // if (!binRateLimitResult.allowed) {
    //   bankServiceLogger.info(
    //     `[Bin validation] Rate limit exceed for this client: ${storingClient}`,
    //   );
    //   console.log(
    //     `[Bin validation] Rate limit exceed for this client: ${storingClient}`,
    //   );
    //   return res.status(429).json({
    //     success: false,
    //     message: binRateLimitResult.message,
    //   });
    // }

    // const tnId = genrateUniqueServiceId();
    // console.log(`bin txn Id: ${tnId} for this client: ${storingClient}`);
    // bankServiceLogger.info(`bin txn Id: ${tnId} for this client: ${storingClient}`);
    // const maintainanceResponse = await deductCredits(
    //   storingClient,
    //   serviceId,
    //   categoryId,
    //   tnId,
    //   req.environment,
    // );

    // if (!maintainanceResponse?.result) {
    //   bankServiceLogger.error(
    //     `Credit deduction failed for Card BIN check: client ${storingClient}, txnId ${tnId}`,
    //   );
    //   return res.status(500).json({
    //     success: false,
    //     message: maintainanceResponse?.message || "InValid",
    //     response: {},
    //   });
    // }

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
          message: "InValid",
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
          message: "InValid",
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
  const {
    ifsc,
    serviceId = "",
    categoryId = "",
    mobileNumber = "",
    clientId = "",
  } = req.body;
  const data = req.body;
  bankServiceLogger.info(`IFSC Code: ${ifsc}`);

  const storingClient = req.clientId || clientId;

  const tnId = genrateUniqueServiceId();
  bankServiceLogger.info(`IFSC txn Id ===>> ${tnId}`);
  let maintainanceResponse;
  maintainanceResponse = await deductCredits(
    storingClient,
    serviceId,
    categoryId,
    tnId,
    req.environment,
  );

  if (!maintainanceResponse?.result) {
    return res.status(500).json({
      success: false,
      message: "InValid",
      response: {},
    });
  }

  const existingBankDetails = await RapidApiBankModel.findOne({ Ifsc: ifsc });

  const analyticsRes = await AnalyticsDataUpdate(
    storingClient,
    serviceId,
    categoryId,
  );
  if (!analyticsRes?.success) {
    return res.status(400).json({
      response: `clientId or serviceId or categoryId is Missing or Invalid 🤦‍♂️`,
      ...ERROR_CODES?.BAD_REQUEST,
    });
  }

  if (existingBankDetails) {
    await responseModel.create({
      serviceId,
      categoryId,
      clientId: storingClient,
      result: existingBankDetails?.response,
      createdTime: new Date().toLocaleTimeString(),
      createdDate: new Date().toLocaleDateString(),
    });
    return res.status(200).json({
      message: "valid",
      success: true,
      response: existingBankDetails?.response,
    });
  }
  const service = await selectService(categoryId, serviceId);

  try {
    const response = await IfscActiveServiceResponse(data, service, 0);
    bankServiceLogger.info(
      `Bank details fetched successfully: ${JSON.stringify(response)}`,
    );
    if (response) {
      let saveData = await RapidApiBankModel({
        Ifsc: ifsc,
        response: response,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      });
      let done = await saveData.save();
      if (done) {
        bankServiceLogger.info("Bank Data save to db successfully ");
      }
    }
    return res.status(200).json({
      message: "Valid",
      success: true,
      response: response,
    });
  } catch (error) {
    bankServiceLogger.error(`Error fetching Bank info: ${error.message}`);
    res.status(500).json({ error: "Failed to fetch Bank information" });
  }
};
