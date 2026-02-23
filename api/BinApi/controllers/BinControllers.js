const axios = require("axios");
require("dotenv").config();
const RapidApiModel = require("../models/BinApiModels");
const RapidApiBankModel = require("../models/BinApiBankModel");
const handleValidation = require("../../../utils/lengthCheck");
const genrateUniqueServiceId = require("../../../utils/genrateUniqueId");
const { cardLogger, accountLogger } = require("../../Logger/logger");
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

let RapidApiKey = process.env.RAPIDAPI_KEY;
let RapidApiHost = process.env.RAPIDAPI_BIN_HOST;
let RapidApiBankHost = process.env.RAPIDAPI_IFSC_HOST;

exports.getCardDetailsByNumber = async (req, res) => {
  const { bin, serviceId = "", categoryId = "", mobileNumber = "" } = req.body;
  const data = req.body;

  cardLogger.debug(`bin detailes=---> ${bin}`);
  cardLogger.debug(`RAOPID_API KEY=---> ${RapidApiKey}`);
  cardLogger.debug(`RAPID Bin API HOST =---> ${RapidApiHost}`);
  cardLogger.debug(`RAPID Bank  API HOST =---> ${RapidApiBankHost}`);

  const isValid = handleValidation("bin", bin, res);
  if (!isValid) return;

  try {
    const storingClient = req.clientId || req.userClientId;
    cardLogger.info(`Executing Card BIN check for client: ${storingClient}, service: ${serviceId}, category: ${categoryId}`);

    const identifierHash = hashIdentifiers({
      binNumber: bin,
    });

    const binRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: storingClient,
    });

    if (!binRateLimitResult.allowed) {
      cardLogger.warn(`Rate limit exceeded for Card BIN check: client ${storingClient}, service ${serviceId}`);
      return res.status(429).json({
        success: false,
        message: binRateLimitResult.message,
      });
    }

    const tnId = genrateUniqueServiceId();
    cardLogger.info(`Generated Card BIN txn Id: ${tnId}`);

    const maintainanceResponse = await deductCredits(
      storingClient,
      serviceId,
      categoryId,
      tnId,
      req.environment
    );

    if (!maintainanceResponse?.result) {
      cardLogger.error(`Credit deduction failed for Card BIN check: client ${storingClient}, txnId ${tnId}`);
      return res.status(500).json({
        success: false,
        message: maintainanceResponse?.message || "InValid",
        response: {},
      });
    }

    const encryptedBin = encryptData(bin);

    const existingBinNumber = await RapidApiModel.findOne({
      bin: encryptedBin,
    });

    const analyticsResult = await AnalyticsDataUpdate(storingClient, serviceId, categoryId);
    if (!analyticsResult.success) {
      cardLogger.warn(`Analytics update failed for Card BIN check: client ${storingClient}, service ${serviceId}`);
    }

    cardLogger.debug(`Checked for existing Card BIN record in DB: ${existingBinNumber ? "Found" : "Not Found"}`);
    if (existingBinNumber) {
      cardLogger.info(`Returning cached Card BIN response for client: ${storingClient}`);
      if (existingBinNumber?.status == 1) {
        return res.status(200).json({
          message: "valid",
          success: true,
          response: existingBinNumber?.response,
        });
      } else {
        return res.status(404).json({
          message: "InValid",
          success: false,
          response: existingBinNumber?.response,
        });
      }
    }

    const service = await selectService(categoryId, serviceId);

    if (!service) {
      cardLogger.warn(`Active service not found for Card BIN category ${categoryId}, service ${serviceId}`);
      return res.status(404).json(ERROR_CODES?.NOT_FOUND);
    }

    cardLogger.info(`Active service selected for Card BIN check: ${service.serviceFor}`);
    let response = await BinActiveServiceResponse(bin, service, 0);

    if (response) {
      cardLogger.info(`Response received from active service ${service.serviceFor}`);
      let saveData = await RapidApiModel({
        bin: encryptData(bin),
        response: response,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      });
      await saveData.save();
      cardLogger.info(`Valid Card BIN response stored and sent to client: ${storingClient}`);
    }

    return res.status(200).json({
      message: "valid",
      success: true,
      response: response,
    });
  } catch (error) {
    cardLogger.error(`System error in Card BIN check for client ${req.clientId}: ${error.message}`, error);
    return res.status(500).json({ error: "Failed to fetch BIN information" });
  }
};

exports.getBankDetailsByIfsc = async (req, res) => {
  const { ifsc, serviceId = "", categoryId = "", mobileNumber = "" } = req.body;
  const data = req.body;
  accountLogger.info(`IFSC Code: ${ifsc}`);

  const storingClient = req.clientId; // Need to ensure this is defined.

  const tnId = genrateUniqueServiceId();
  accountLogger.info(`IFSC txn Id ===>> ${tnId}`);
  let maintainanceResponse;
  maintainanceResponse = await deductCredits(
    req.clientId,
    serviceId,
    categoryId,
    tnId,
    req.environment
  );

  if (!maintainanceResponse?.result) {
    return res.status(500).json({
      success: false,
      message: "InValid",
      response: {},
    });
  }

  const existingBankDetails = await RapidApiBankModel.findOne({ Ifsc: ifsc });

  const analyticsRes = await AnalyticsDataUpdate(storingClient, serviceId, categoryId);
  if (!analyticsRes?.success) {
    return res.status(400).json({
      response: `clientId or serviceId or categoryId is Missing or Invalid 🤦‍♂️`,
      ...ERROR_CODES?.BAD_REQUEST,
    })
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
    accountLogger.info(`Bank details fetched successfully: ${JSON.stringify(response)}`);
    if (response) {
      let saveData = await RapidApiBankModel({
        Ifsc: ifsc,
        response: response,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      });
      let done = await saveData.save();
      if (done) {
        accountLogger.info("Bank Data save to db successfully ");
      }
    }
    return res.status(200).json({
      message: "Valid",
      success: true,
      response: response,
    });
  } catch (error) {
    accountLogger.error(`Error fetching Bank info: ${error.message}`);
    res.status(500).json({ error: "Failed to fetch Bank information" });
  }
};

