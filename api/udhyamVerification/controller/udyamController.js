const { encryptData } = require("../../../utlis/EncryptAndDecrypt");
const { ERROR_CODES, mapError } = require("../../../utlis/errorCodes");
const { checkingOfLength } = require("../../../utlis/lengthCheck");
const logger = require("../../Logger/logger");
const { verifyUdhyamInvincible } = require("../../service/provider.invincible");
const {
  verifyUdhyamTruthScreen,
} = require("../../service/provider.truthscreen");
const {
  selectService,
  updateFailure,
} = require("../../service/serviceSelector");
const udhyamVerify = require("../model/udyamModel");

const udyamNumberVerfication = async (req, res, next) => {
  const { udyamNumber } = req.body;
  const data = req.body;

  console.log("udyamNumber ==>", udyamNumber);
  logger.info("udyamNumber from request ===>", udyamNumber);

  const resOfObj = checkingOfLength(udyamNumber, 19);

  if (resOfObj) {
    return res.status(400).json(ERROR_CODES.BAD_REQUEST);
  }

  const encryptedUdhyam = encryptData(udyamNumber);

  const existingUdhyamNumber = await udhyamVerify.findOne({
    udyamNumber: encryptedUdhyam,
  });

  console.log("existingUdhyamNumber ====>>", existingUdhyamNumber);

  const service = await selectService("UDYAM");

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
        response = await verifyUdhyamInvincible(data);
        break;
      case "TRUTHSCREEN":
        console.log("Calling TRUTHSCREEN API...");
        response = await verifyUdhyamTruthScreen(data);
        break;
      default:
        throw new Error("Unsupported PAN service");
    }
    console.log(
      `response from active service for udhyam ${
        service.serviceFor
      } ${JSON.stringify(response)}`
    );
    logger.info(
      `response from active service for udhyam ${
        service.serviceFor
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

      return res.json({
        message: "Valid",
        data: response?.result,
        success: true,
      });
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
      return res.json({
        message: "InValid",
        data: invalidResponse,
        success: false,
      });
    }

    // await resetSuccess(service);  // if want to implement it when continue three time serr is show then Freez the service
  } catch (error) {
    console.log("error in verifyUdhyamNumber ===>>>", error);
    await updateFailure(service);
    const errorObj = mapError(error);
    return res.status(errorObj.httpCode).json(errorObj);
  }
};

module.exports = udyamNumberVerfication;
