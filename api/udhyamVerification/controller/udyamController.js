const { createApiResponse } = require("../../../utlis/ApiResponseHandler");
const { encryptData } = require("../../../utlis/EncryptAndDecrypt");
const { ERROR_CODES, mapError } = require("../../../utlis/errorCodes");
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

  const existingUdhyamNumber = await udhyamVerify.findOne({
    udyamNumber: encryptedUdhyam,
  });

  console.log("existingUdhyamNumber ====>>", existingUdhyamNumber);

  if (existingUdhyamNumber) {
    return res.status(200)?.json(createApiResponse(200,existingUdhyamNumber?.response,'Valid'))
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
        udhyamNumber: encryptedUdhyam,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await udhyamVerify.create(storingData);
      return res.status(200).json(createApiResponse(200,response?.result,'Valid'))
    } else {
      const invalidResponse = {
        udyam: udyamNumber,
        "Date of Commencement of Production/Business": "",
        "Date of Incorporation": "",
        "Date of Udyam Registration": "",
        "MSME-DFO": "",
        "Major Activity": "",
        "Name of Enterprise": "",
        "Organisation Type": "",
        "Social Category": "",
        "Enterprise Type": [],
        "National Industry Classification Code(S)": [],
        "Official address of Enterprise": {},
      };
      return res.status(401).json(createApiResponse(401,invalidResponse,'InValid'))
    }

  } catch (error) {
    console.log("error in verifyUdhyamNumber ===>>>", error);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

module.exports = udyamNumberVerfication;
