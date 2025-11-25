const panverificationModel = require("../models/panverification.model");
const panToAadhaarModel = require("../models/panToAadhaarModel");
const axios = require("axios");
require("dotenv").config();
const logger = require("../../Logger/logger");
const {
  encryptData,
  decryptData,
} = require("../../../utlis/EncryptAndDecrypt");
const {
  updateFailure,
  selectService,
} = require("../../service/serviceSelector");
const { ERROR_CODES, mapError } = require("../../../utlis/errorCodes");
const { verifyPanInvincible } = require("../../service/provider.invincible");
const { verifyPanTruthScreen } = require("../../service/provider.truthscreen");
const { verifyPanZoop } = require("../../service/provider.zoop");
const { checkingOfLength } = require("../../../utlis/lengthCheck");

exports.verifyPanNumber = async (req, res) => {
  const data = req.body;
  const { panNumber } = data;
  const resOfLenth = checkingOfLength(panNumber, 10);
  if (
    resOfLenth ||
    !panNumber?.match(
      /^[A-Za-z]{3}[PCHABGJLFTpchabgjlft][A-Za-z][0-9]{4}[A-Za-z]$/
    )
  ) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }
  const encryptedPan = encryptData(panNumber);

  const existingPanNumber = await panverificationModel.findOne({
    panNumber: encryptedPan,
  });
  console.log("existingPanNumber===>", existingPanNumber);
  if (existingPanNumber) {
    const decryptedPanNumber = decryptData(existingPanNumber?.panNumber);
    const resOfPan = existingPanNumber?.response;
    const panUser = existingPanNumber?.userName;

    if (panUser) {
      const decryptedResponse = {
        ...existingPanNumber?.response,
        PAN: decryptedPanNumber,
      };
      return res.json({
        message: "Valid",
        response: decryptedResponse,
        success: true,
      });
    } else {
      return res.json({
        message: "InValid",
        response: resOfPan,
        success: false,
      });
    }
  }

  const service = await selectService("PAN");

  console.log("----active service for pan Verify is ----", service);
  if (!service) {
    return res.status(404).json(ERROR_CODES?.NOT_FOUND);
  }

  console.log("----active service name for pan ---", service.serviceFor);

  try {
    let response;
    switch (service.serviceFor) {
      case "INVINCIBLE":
        console.log("Calling INVINCIBLE API...");
        response = await verifyPanInvincible(data);
        break;
      case "TRUTHSCREEN":
        console.log("Calling TRUTHSCREEN API...");
        response = await verifyPanTruthScreen(data);
        break;
      case "ZOOP":
        console.log("Calling ZOOP API...");
        response = await verifyPanZoop(data);
        break;
      default:
        throw new Error("Unsupported PAN service");
    }
    console.log(
      `response from active service for pan ${
        service.serviceFor
      } ${JSON.stringify(response)}`
    );
    logger.info(
      `response from active service for pan ${
        service.serviceFor
      } ${JSON.stringify(response)}`
    );
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(response?.result?.PAN);
      const encryptedResponse = {
        ...response?.result,
        PAN: encryptedPan,
      };
      const storingData = {
        panNumber: encryptedPan,
        userName: response?.result?.Name,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panverificationModel.create(storingData);

      return res.json({
        message: "Valid",
        response: response?.result,
        success: true,
      });
    } else {
      const storingData = {
        panNumber: encryptedPan,
        userName: "",
        response: null,
        serviceResponse: {},
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panverificationModel.create(storingData);
      const invalidResponse = {
        PAN: panNumber,
        Name: "",
        PAN_Status: "",
        PAN_Holder_Type: "",
      };
      return res.json({
        message: "InValid",
        response: invalidResponse,
        success: false,
      });
    }

    // await resetSuccess(service);  // if want to implement it when continue three time serr is show then Freez the service
  } catch (error) {
    console.log("error in verifyPanNumber ===>>>", error);
    await updateFailure(service);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
exports.verifyPanToAadhaar = async (req, res) => {
  const data = req.body;
  const { panNumber } = data;

  const resOfLenth = checkingOfLength(panNumber, 10);
  if (
    resOfLenth ||
    !panNumber?.match(
      /^[A-Za-z]{3}[PCHABGJLFTpchabgjlft][A-Za-z][0-9]{4}[A-Za-z]$/
    )
  ) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }

  const encryptedPan = encryptData(panNumber);

  const existingPanNumber = await panToAadhaarModel.findOne({
    panNumber: encryptedPan,
  });
  console.log("existingPanNumber===>", existingPanNumber);
  if (existingPanNumber?.response?.code == 200) {
    return res.json({
      message: "Valid",
      success: true,
      response: existingPanNumber?.response,
    });
  }

  if (existingPanNumber?.response?.code == 404) {
    return res.json({
      message: "InValid",
      success: false,
      response: existingPanNumber?.response,
    });
  }

  try {
    const clientId = process.env.INVINCIBLE_CLIENT_ID;
    const secretKey = process.env.INVINCIBLE_SECRET_KEY;
    const url =
      "https://api.invincibleocean.com/invincible/panToMaskAadhaarLite";
    const headers = {
      clientId: clientId,
      secretKey: secretKey,
      "Content-Type": "application/json",
    };
    const panToAadhaarResponse = await axios.post(url, data, { headers });
    console.log("panToAadhaarResponse ===>>>", panToAadhaarResponse?.data);
    console.log(
      `response from service for pan to aadhaar ${JSON.stringify(
        panToAadhaarResponse?.data
      )}`
    );
    logger.info(
      `response from service for pan to aadhaar ${JSON.stringify(
        panToAadhaarResponse?.data
      )}`
    );

    if (panToAadhaarResponse?.data?.code == 404) {
      const objectToStore = {
        panNumber: encryptedPan,
        aadhaarNumber: panToAadhaarResponse?.data?.result?.aadhaar,
        response: panToAadhaarResponse?.data,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panToAadhaarModel.create(objectToStore);
      return res.status(404).json({
        message: "InValid",
        success: false,
        response: panToAadhaarResponse?.data,
      });
    }

    if (panToAadhaarResponse?.data?.code == 200) {
      const objectToStore = {
        panNumber: encryptedPan,
        aadhaarNumber: panToAadhaarResponse?.data?.result?.aadhaar,
        response: panToAadhaarResponse?.data,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panToAadhaarModel.create(objectToStore);

      return res.status(200).json({
        message: "Valid",
        success: true,
        response: panToAadhaarResponse?.data,
      });
    }
  } catch (error) {
    console.log("error in verifyPanNumber ===>>>", error);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
