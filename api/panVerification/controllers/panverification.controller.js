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
  selectService,
} = require("../../service/serviceSelector");
const { ERROR_CODES, mapError } = require("../../../utlis/errorCodes");
const { verifyPanInvincible } = require("../../service/provider.invincible");
const { verifyPanTruthScreen } = require("../../service/provider.truthscreen");
const { verifyPanZoop } = require("../../service/provider.zoop");
const handleValidation = require("../../../utlis/lengthCheck");
const { GetPanResponse } = require("../../../utlis/helper");
const { PanActiveServiceResponse } = require("../../GlobalApiserviceResponse/PanServiceResponse");
const { PantoAadhaarActiveServiceResponse } = require("../../GlobalApiserviceResponse/PantoAadhaarRes");

exports.verifyPanNumber = async (req, res) => {
  const data = req.body;
  const { panNumber } = data;
  // await handleValidation("pan", panNumber, res);

  console.log("All inputs are valid, continue processing...");

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
        data: decryptedResponse,
        success: true,
      });
    } else {
      return res.json({
        message: "InValid",
        data: resOfPan,
        success: false,
      });
    }
  }

  const service = await selectService("PAN");

  console.log("----active service for pan Verify is ----", service);
  if (!service) {
    return res.status(404).json(ERROR_CODES?.NOT_FOUND);
  }

  try {
    let response = await PanActiveServiceResponse(panNumber, service, 0);
    console.log('VerifyPanNumber Response ===>', response)
    console.log(
      `response from active service for pan: ${response?.service} ===> ${JSON.stringify(response)}`
    );
    logger.info(
      `response from active service for pan ${service.serviceFor
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
        serviceResponse:response?.responseOfService,
        // serviceResponse:{ ...response?.responseOfService,pan_number:decryptData(response?.responseOfService?.pan_number)}  ,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panverificationModel.create(storingData);

      return res.json({
        message: "Valid",
        data: response?.result,
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
        data: invalidResponse,
        success: false,
      });
    }

  } catch (error) {
    console.log("error in verifyPanNumber ===>>>", error);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

exports.verifyPanToAadhaar = async (req, res) => {
  const data = req.body;
  const { panNumber } = data;

  console.log("All inputs are valid, continue processing...");

  const encryptedPan = encryptData(panNumber);

  const existingPanNumber = await panToAadhaarModel.findOne({
    panNumber: encryptedPan,
  });
  console.log("existingPanNumber===>", existingPanNumber);
  if (existingPanNumber?.response?.code == 200) {
    return res.json({
      message: "Valid",
      success: true,
      data: existingPanNumber?.response,
    });
  }

  const service = await selectService("PAN");

  try {

    const response = await PantoAadhaarActiveServiceResponse(panNumber, service, 0);
    console.log('Verify panto aadhaar number is response', JSON.stringify(response));

    await panToAadhaarModel.create(response);

    return res.status(200).json({
      message: "Valid",
      success: true,
      data: response?.responseOfService
    });
  } catch (error) {
    console.log("error in verifyPanNumber ===>>>", error);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};
