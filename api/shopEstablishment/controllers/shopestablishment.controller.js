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

exports.handleCreateShopEstablishment = async (req, res, next) => {
  const { registrationNumber, state } = req.body;
  console.log("registrationNumber===>", registrationNumber);
  const requestData = {
    registrationNumber,
    state,
  };
  try {
    const existingDetails = await shopestablishmentModel.findOne({
      registrationNumber: registrationNumber,
    });

    if (existingDetails) {
      return res.status(200).json({ message: "Valid", success: true, response: existingDetails?.response });
    } else {
      console.log('Handle Create ShopEstablishment in else block')
      const service = await selectService("SHOP");
      let result;
      switch (service.serviceFor) {
        case "INVINCIBLE":
          result = await Invincible.shopEstablishment(requestData);
        case "TRUTHSCREEN":
          result = await truthScreen.shopEstablishment(requestData);
      }
      console.log("responseData in shop verification===>", result);
      const shopName = result?.result?.result?.nameOfTheShop;
      const shopAddress = result?.result?.result?.address;

      if (!shopName || !shopAddress) {
        throw new Error(
          "Invalid response structure: Missing shopName or shopAddress"
        );
      }
      const shopest = {
        registrationNumber,
        state,
        serviceRes: service.serviceFor, // service Name
        response: result, // service responce
        shopName,
        shopAddress,
        MerchantId: MerchantId,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString()
      };
      const savedData = await shopestablishmentModel.create(shopest);
      console.log("Data saved to MongoDB:", savedData);
      return res.status(200).send({ success: true, shopest });
    }
  } catch (error) {
    console.error("Error performing shopest verification:", error, error?.response?.data);
    return res.status(500).json(ERROR_CODES?.SERVER_ERROR);
  }
};