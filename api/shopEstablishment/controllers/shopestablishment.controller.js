const shopestablishmentModel = require("../models/shopestablishment.model");
const axios = require("axios");
const INVINCIBLE_CLIENT_ID = process.env.INVINCIBLE_CLIENT_ID;
const INVINCIBLE_SECRET_KEY = process.env.INVINCIBLE_SECRET_KEY;
const checkingDetails = require("../../../utlis/authorization");
const loginAndSms = require("../../loginAndSms/model/loginAndSmsModel");
const { response } = require("express");
const zoop = require("../../service/provider.zoop");
const truthScreen = require("../../service/provider.truthscreen");
const Invincible = require("../../service/provider.invincible");
const { ERROR_CODES } = require('../../../utlis/errorCodes');
const { selectService } = require("../../service/serviceSelector");
const logger = require("../../Logger/logger");
const { shopActiveServiceResponse } = require("../../GlobalApiserviceResponse/ShopResponse");

exports.handleCreateShopEstablishment = async (req, res, next) => {
  const { registrationNumber, state } = req.body;
  const requestData = { registrationNumber, state };
  console.log("Shop Establishment Detiails ", registrationNumber, state, req.body);
  logger.info(`Shop Establishment Detiails ===>> registrationNumber: ${registrationNumber} --- state: ${state}`);
  try {
    if (!registrationNumber || !state) {
      return res.status(400).json(ERROR_CODES?.BAD_REQUEST)
    }
    const existingDetails = await shopestablishmentModel.findOne({
      registrationNumber: registrationNumber,
    });
    if (existingDetails) {
      return res.status(200).json({ message: "Valid", success: true, data: existingDetails?.response?.result });
    }
    const service = await selectService("SHOP");
    console.log("----active service for Shop Verify is ----", service);
    logger.info(`----active service for Shop Verify is ----, ${service}`);
    let response = shopActiveServiceResponse({ registrationNumber, state }, service, 0);
    console.log("Shop verify response ===>", response);
    logger.info(`Shop verify response ===> ${response}`)
    const savedData = await shopestablishmentModel.create(response);
    return res.status(200).json({ message: 'Success', data: response?.result, success: true });
  } catch (error) {
    console.error("Error performing Shop verification:", error);
    logger.error(`Error performing Shop verification:${error}`);
    return res.status(500).json(ERROR_CODES?.SERVER_ERROR);
  }
};