const { encryptData } = require("../../../utlis/EncryptAndDecrypt");
const { ERROR_CODES, mapError } = require("../../../utlis/errorCodes");
const { findingInValidResponses } = require("../../../utlis/InvalidResponses");
const handleValidation = require("../../../utlis/lengthCheck");
const { shopActiveServiceResponse } = require("../../GlobalApiserviceResponse/UdyamServiceResponse");
const logger = require("../../Logger/logger");
const { verifyUdhyamInvincible } = require("../../service/provider.invincible");
const {
  verifyUdhyamTruthScreen,
} = require("../../service/provider.truthscreen");
const {
  selectService
} = require("../../service/serviceSelector");
const udhyamVerify = require("../model/udyamModel");

const udyamNumberVerfication = async (req, res, next) => {
  const { udyamNumber } = req.body;
  const data = req.body;

  console.log("udyamNumber ==>", udyamNumber);
  logger.info("udyamNumber from request ===>", udyamNumber);

  // const isValid = handleValidation("udyam", udyamNumber, res);
  // if (!isValid) return;

  const encryptedUdhyam = encryptData(udyamNumber);
  console.log("encryptedUdhyam ====>>>", encryptedUdhyam);

  const existingUdhyamNumber = await udhyamVerify.findOne({
    udyamNumber: encryptedUdhyam,
  });

  console.log("existingUdhyamNumber ====>>", existingUdhyamNumber);

  if (existingUdhyamNumber) {
    if (existingUdhyamNumber?.status == 1) {
      return res.status(200).json({
        message: "Valid",
        data: existingUdhyamNumber?.response,
        success: true,
      });
    } else {
      return res.status(200).json({
        message: "InValid",
        data: {
          ...findingInValidResponses("udyam"),
          udyam: udyamNumber,
        },
        success: false,
      });
    }
  }

  const service = await selectService("UDYAM");

  console.log("----active service for pan Verify is ----", service);

  try {
    let response = await shopActiveServiceResponse(udyamNumber,service,0);
    // switch (service.serviceFor) {
    //   case "INVINCIBLE":
    //     console.log("Calling INVINCIBLE API...");
    //     response = await verifyUdhyamInvincible(data);
    //     break;
    //   case "TRUTHSCREEN":
    //     console.log("Calling TRUTHSCREEN API...");
    //     response = await verifyUdhyamTruthScreen(data);
    //     break;
    //   default:
    //     throw new Error("Unsupported PAN service");
    // }
    console.log(
      `response from active service for udhyam ${JSON.stringify(response)}`
    );
    logger.info(
      `response from active service for udhyam ${service.serviceFor
      } ${JSON.stringify(response)}`
    );
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedResponse = {
        ...response?.result,
        udyam: encryptedUdhyam,
      };

      const storingData = {
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        status: 1,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      const existingOrNew = await udhyamVerify.findOneAndUpdate(
        { udyamNumber: encryptedUdhyam },
        { $setOnInsert: storingData },
        { upsert: true, new: true }
      );

      return res.status(200).json({
        message: "Valid",
        data: existingOrNew.response,
        success: true,
      });
    } else {
      const InValidData = {
        response: {},
        serviceResponse: {},
        status: 2,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await udhyamVerify.findOneAndUpdate(
        { udyamNumber: encryptedUdhyam },
        { $setOnInsert: InValidData },
        { upsert: true, new: true }
      );

      return res.status(404).json({
        message: "InValid",
        data: {
          ...findingInValidResponses("udyam"),
          udyam: udyamNumber,
        },
        success: false,
      });
    }

  } catch (error) {
    console.log("error in verifyUdhyamNumber ===>>>", error);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

module.exports = udyamNumberVerfication;
