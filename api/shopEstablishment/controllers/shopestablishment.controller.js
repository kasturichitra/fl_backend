const shopestablishmentModel = require("../models/shopestablishment.model");
const axios = require("axios");
const INVINCIBLE_CLIENT_ID = process.env.INVINCIBLE_CLIENT_ID;
const INVINCIBLE_SECRET_KEY = process.env.INVINCIBLE_SECRET_KEY;
const checkingDetails = require("../../../utils/authorization");
const loginAndSms = require("../../loginAndSms/model/loginAndSmsModel");
const { response } = require("express");
const zoop = require("../../service/provider.zoop");
const truthScreen = require("../../service/provider.truthscreen");
const Invincible = require("../../service/provider.invincible");
const { ERROR_CODES, mapError } = require('../../../utils/errorCodes');
const { selectService } = require("../../service/serviceSelector");
const { kycLogger } = require("../../Logger/logger");
const { shopActiveServiceResponse } = require("../../GlobalApiserviceResponse/ShopResponse");
const CreditService = require("../../../services/CreditService");
const { createApiResponse } = require("../../../utils/ApiResponseHandler");

exports.handleCreateShopEstablishment = async (req, res, next) => {
  const { registrationNumber, state } = req.body;
  const { clientId, environment } = req;

  // Use kycLogger for consistent logging
  kycLogger.info(`Shop Establishment Details ===>> registrationNumber: ${registrationNumber} --- state: ${state}`);

  if (!registrationNumber || !state) {
    kycLogger.warn("Missing registrationNumber or state");
    return res.status(ERROR_CODES?.BAD_REQUEST.httpCode).json(createApiResponse(ERROR_CODES?.BAD_REQUEST.code, [], 'Invalid request parameters'));
  }

  try {
    const existingDetails = await shopestablishmentModel.findOne({
      registrationNumber: registrationNumber,
    });
    if (existingDetails) {
      kycLogger.info("Shop Establishment details found in DB");
      return res.status(200).json(createApiResponse(200, existingDetails?.response?.result, 'Valid'));
    }

    // Check credits before proceeding
    const creditCheck = await CreditService.checkCredits(clientId, environment);
    if (!creditCheck.success) {
      kycLogger.warn("Insufficient credits for Shop Establishment verification");
      return res.status(ERROR_CODES.INSUFFICIENT_CREDITS.httpCode).json(createApiResponse(ERROR_CODES.INSUFFICIENT_CREDITS.code, {}, creditCheck.message));
    }

    const service = await selectService("SHOP");
    kycLogger.info(`----active service for Shop Verify is ----, ${service}`);

    let response = await shopActiveServiceResponse({ registrationNumber, state }, service, 0);
    kycLogger.info(`Shop verify response ===> ${JSON.stringify(response)}`);

    // Deduct credits if successful
    if (response?.result) {
      await CreditService.deductCredits(clientId, environment, "SHOP", response.transId || `SHOP-${Date.now()}`);
    }

    const savedData = await shopestablishmentModel.create(response);
    return res.status(200).json(createApiResponse(200, response?.result, 'Valid'));
  } catch (error) {
    kycLogger.error(`Error performing Shop verification: ${error.message}`);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(createApiResponse(errorObj.code, {}, errorObj.message));
  }
};
