const shopestablishmentModel = require("../models/shopestablishment.model");
const axios = require("axios");
const INVINCIBLE_CLIENT_ID = process.env.INVINCIBLE_CLIENT_ID;
const INVINCIBLE_SECRET_KEY = process.env.INVINCIBLE_SECRET_KEY;
const checkingDetails = require("../../../utlis/authorization");
const loginAndSms = require("../../loginAndSms/model/loginAndSmsModel");
const { response } = require("express");

exports.handleCreateShopEstablishment = async (req, res, next) => {
  const { registrationNumber, state } = req.body;
  console.log("registrationNumber===>", registrationNumber);
  const authHeader = req.headers.authorization;

  const check = await checkingDetails(authHeader, next);

  try {
    const existingDetails = await shopestablishmentModel.findOne({
      registrationNumber: registrationNumber,
    });

    if (existingDetails) {
      return res.status(200).json ({ message: "Valid", success: true , response : existingDetails?.response });
    } else {
      const requestData = {
        registrationNumber,
        state,
      };
      console.log("INVINCIBLE_CLIENT_ID===>", INVINCIBLE_CLIENT_ID);
      console.log("INVINCIBLE_SECRET_KEY===>", INVINCIBLE_SECRET_KEY);
      const headers = {
        accept: "application/json",
        clientId: INVINCIBLE_CLIENT_ID,
        "content-type": "application/json",
        secretKey: INVINCIBLE_SECRET_KEY,
      };
      console.log("requestData===>", requestData);
      const details = await axios.post(
        "https://api.invincibleocean.com/invincible/shopEstablishment",
        requestData,
        { headers }
      );

      // Log the full response data
      console.log("Full response data:", details.data);
      if (details.data?.code === 400) {
        let errorMessage = {
          message: "InvalidCredentials",
          statusCode: 500,
        };
        return next(errorMessage);
      }
      const responseData = details.data;
      console.log("responseData in shop verification===>", responseData);
      const shopName = responseData?.result?.result?.nameOfTheShop;
      const shopAddress = responseData?.result?.result?.address;

      if (!shopName || !shopAddress) {
        throw new Error(
          "Invalid response structure: Missing shopName or shopAddress"
        );
      }
      const merchant = await loginAndSms.findOne({ token: check });
      console.log(
        "merchant==============================>",
        merchant?.merchantId
      );
      const shopest = {
        registrationNumber,
        state,
        response: responseData,
        token,
        shopName,
        shopAddress,
        MerchantId: merchant?.merchantId,
        createdDate:new Date().toLocaleDateString(),
        createdTime:new Date().toLocaleTimeString()
      };

      const existingDetails = await shopestablishmentModel.findOne({
        registrationNumber: registrationNumber,
      });
      console.log("existingDetails====>", existingDetails);

      const savedData = await shopestablishmentModel.create(shopest);
      console.log("Data saved to MongoDB:", savedData);
      res.status(200).send({ success: true, shopest });
    }
  } catch (error) {
    console.error(
      "Error performing shopest verification:",
      error?.response?.data
    );
    console.error("Error performing shopest verification:", error);
    if (error?.response?.data?.code === 400) {
      let errorMessage = {
        message: "Invalid Credentials",
        statusCode: 400,
      };
      return next(errorMessage);
    }
    if (error?.response?.data?.code === 404) {
      let errorMessage = {
        message: "Detials Not Found",
        statusCode: 404,
      };
      return next(errorMessage);
    }
    let errorMessage = {
      message: "Failed to perform shopest verification",
      statusCode: 500,
    };
    return next(errorMessage);
  }
};
