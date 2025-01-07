const gstin_verifyModel = require("../models/gstin_verify.model");
const request = require("request");
const checkingDetails = require("../../../middleware/authorization");
const loginAndSms = require("../../loginAndSms/model/loginAndSmsModel");

exports.gstinverify = async (req, res, next) => {
  try {
    const { gstinNumber } = req.body;
    const authHeader = req.headers.authorization;

    const check = await checkingDetails(authHeader, next);

    const user = await loginAndSms.findOne({ token: check });

    const existingGstin = await gstin_verifyModel.findOne({ gstinNumber });
    console.log(
      "legalName === companyName=== in already exist gst>",
      existingGstin?.companyName
    );

    if (existingGstin) {
      return res.status(200).json({
        message: existingGstin?.response,
        success: true,
      });
    }

    const gstinOption = {
      method: "POST",
      url: "https://live.zoop.one/api/v1/in/merchant/gstin/lite",
      headers: {
        "app-id": "621cbd236fed98001d14a0fc",
        "api-key": "711GWK9-9374RRM-QTBNYFT-CACRKFW",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "sync",
        data: {
          business_gstin_number: gstinNumber,
          consent: "Y",
          consent_text:
            "I hereby declare my consent agreement for fetching my information via ZOOP API",
        },
      }),
    };

    request(gstinOption, async (error, response, body) => {
      if (error) {
        console.error("Error performing GSTIN verification:", error);
        let errorMessage = {
          message: "Failed to perform GSTIN verification Try Again Latter",
          statusCode: 500,
        };
        return next(errorMessage);
      }

      try {
        const obj = JSON.parse(body);
        console.log("==========>>>>>obj" , obj)
        const legalName = obj?.result?.legal_name;
        const gstinData = {
          gstinNumber,
          response: obj,
          MerchantId: user.merchantId,
          companyName: legalName,
          createdDate:new Date().toLocaleDateString(),
          createdTime:new Date().toLocaleTimeString()
        };
        const newGstinVerification = await gstin_verifyModel.create(gstinData);
        console.log(
          "legalName === companyName=== in gst>",
          legalName,
          newGstinVerification
        );
        res.status(200).json({
          message: newGstinVerification?.response,
          success: true,
        });
      } catch (error) {
        console.error("Error saving GSTIN verification data:", error);
        let errorMessage = {
          message:
            "Failed to save GSTIN verification data Try again after some time",
          statusCode: 500,
        };
        return next(errorMessage);
      }
    });
  } catch (error) {
    console.error("Error performing GSTIN verification:", error);
    let errorMessage = {
      message: "Failed to perform GSTIN verification Try Again Latter",
      statusCode: 500,
    };
    return next(errorMessage);
  }
};
