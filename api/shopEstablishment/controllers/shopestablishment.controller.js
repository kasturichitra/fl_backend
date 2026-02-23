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
const { ERROR_CODES } = require("../../../utlis/errorCodes");
const { selectService } = require("../../service/serviceSelector");
const { companyLogger } = require("../../Logger/logger");
const {
  shopActiveServiceResponse,
} = require("../../GlobalApiserviceResponse/ShopResponse");
const chargesToBeDebited = require("../../../utlis/chargesMaintainance");
const creditsToBeDebited = require("../../../utlis/creditsMaintainance");
const genrateUniqueServiceId = require("../../../utlis/genrateUniqueId");

exports.handleCreateShopEstablishment = async (req, res, next) => {
    const {
    registrationNumber,
    state,
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
    clientId = "",
  } = req.body;
  console.log(
    "Shop Establishment Detiails ",
    registrationNumber,
    state,
    req.body,
  );
  companyLogger.info(
    `Shop Establishment Detiails ===>> registrationNumber: ${registrationNumber} --- state: ${state}`,
  );
  if (!registrationNumber || !state) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }

  const tnId = genrateUniqueServiceId();
  companyLogger.info("SHOP txn Id ===>>", tnId);
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
  const existingDetails = await shopestablishmentModel.findOne({
    registrationNumber: registrationNumber,
  });
  if (existingDetails) {
    return res
      .status(200)
      .json({
        message: "Valid",
        success: true,
        data: existingDetails?.response?.result,
      });
  }
  try {
    const service = await selectService();
    console.log("----active service for Shop Verify is ----", service);
    companyLogger.info(
      `----active service for Shop Verify is ----, ${service}`,
    );
    let response = shopActiveServiceResponse(
      { registrationNumber, state },
      service,
      0,
    );
    console.log("Shop verify response ===>", response);
    companyLogger.info(`Shop verify response ===> ${response}`);
    const savedData = await shopestablishmentModel.create(response);
    return res
      .status(200)
      .json({ message: "Valid", data: response?.result, success: true });
  } catch (error) {
    console.error("Error performing Shop verification:", error);
    companyLogger.error(`Error performing Shop verification:${error}`);
    return res.status(500).json(ERROR_CODES?.SERVER_ERROR);
  }
};
