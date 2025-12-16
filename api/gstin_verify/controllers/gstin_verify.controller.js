const gstin_verifyModel = require("../models/gstin_verify.model");
const { selectService } = require("../../service/serviceSelector");
const zoop = require("../../service/provider.zoop");
const invincible = require("../../service/provider.invincible");
const truthscreen = require("../../service/provider.truthscreen");
const { ERROR_CODES } = require("../../../utlis/errorCodes");
const { generateTransactionId } = require("../../../utlis/helper");
const logger = require("../../Logger/logger");
const { GSTActiveServiceResponse } = require("../../GlobalApiserviceResponse/GstServiceResponse");

exports.gstinverify = async (req, res, next) => {
  const { gstinNumber } = req.body;
  console.log(`gstinNumber Details ===>> gstinNumber: ${gstinNumber}`);
  logger.info(`gstinNumber Details ===>> gstinNumber: ${gstinNumber}`);

  try {
    if (!gstinNumber) {
      return res.status(400).json(ERROR_CODES?.BAD_REQUEST)
    }
    const existingGstin = await gstin_verifyModel.findOne({ gstinNumber });

    if (existingGstin) {
      const dataToShow = existingGstin?.result;
      return res.status(200).json({ message: 'Success', data: dataToShow, success: true });
    }

    const service = await selectService('GSTIN');
    console.log('gst inverify activer service', service);
    let response = await GSTActiveServiceResponse(gstinNumber, service, 0)

    console.log("gstin verify response ===>", JSON.stringify(response));
    logger.info(`gstin verify response: ${JSON.stringify(response)}`);
    const newGstinVerification = await gstin_verifyModel.create(response);
    res.status(200).json({ message: 'Valid', data: response?.result, success: true });

  } catch (error) {
    console.error("Error performing GSTIN verification:", error);
    logger.error(`Error performing GSTIN verification:${error}`);
    return res.status(500).json(ERROR_CODES?.SERVER_ERROR);
  }
};

