const { createApiResponse } = require("../../../utlis/ApiResponseHandler");
const { encryptData } = require("../../../utlis/EncryptAndDecrypt");
const { ERROR_CODES, mapError } = require("../../../utlis/errorCodes");
const { findingInValidResponses } = require("../../../utlis/InvalidResponses");
const handleValidation = require("../../../utlis/lengthCheck");
const { udyamActiveServiceResponse } = require("../../GlobalApiserviceResponse/UdyamServiceResponse");
const {companyLogger} = require("../../Logger/logger");
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
  companyLogger.info("udyamNumber from request ===>", udyamNumber);

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
      return res.status(200).json(createApiResponse(200, existingUdhyamNumber?.response, 'Valid'))
    } else {
      return res.status(200).json(createApiResponse(200, {
        ...findingInValidResponses("udyam"),
        udyam: udyamNumber,
      }, 'InValid'))
    }
  }

  const service = await selectService("UDYAM");

  console.log("----active service for pan Verify is ----", service);

  try {
    let response = await udyamActiveServiceResponse(udyamNumber, service, 0);
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
      return res.status(200).json(createApiResponse(200,existingOrNew.response,'Valid'))
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

      // return res.status(404).json({
      //   message: "InValid",
        // data: {
        //   ...findingInValidResponses("udyam"),
        //   udyam: udyamNumber,
        // },
      //   success: false,
      // });

      return res.status(404).json(createApiResponse(404,{
          ...findingInValidResponses("udyam"),
          udyam: udyamNumber,
        },'InValid'))
    }

  } catch (error) {
    console.log("error in verifyUdhyamNumber ===>>>", error);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

module.exports = udyamNumberVerfication;
