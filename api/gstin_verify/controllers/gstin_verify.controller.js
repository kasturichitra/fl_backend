const gstin_verifyModel = require("../models/gstin_verify.model");
const { selectService, updateFailure } = require("../../service/serviceSelector");
const zoop = require("../../service/provider.zoop");
const invincible = require("../../service/provider.invincible");
const truthscreen = require("../../service/provider.truthscreen");
const { ERROR_CODES } = require("../../../utlis/errorCodes");
const { generateTransactionId } = require("../../../utlis/helper");
const logger = require("../../Logger/logger");

exports.gstinverify = async (req, res, next) => {
  const { gstinNumber } = req.body;
  const TXNID = generateTransactionId();
  console.log("GStIn verify txn id", TXNID);
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

    const zoopData = {
      mode: "sync",
      data: {
        business_gstin_number: gstinNumber,
        consent: "Y",
        consent_text:
          "I hereby declare my consent agreement for fetching my information via ZOOP API",
      },
    };
    const Invincibledata = JSON.stringify({
      gstin: gstinNumber
    });
    const truthscreendata = {
      "transID": TXNID,
      "docType": "23",
      "docNumber": gstinNumber
    };
    const service = await selectService('GSTIN');
    console.log("----active service for GSTIN Verify is ----", service);
    logger.info(`----active service for GSTIN Verify is ----, ${service}`);
    if (!service || service === undefined) {
      return res.status(503).json({ error: "No service available" });
    }
    console.log('gst inverify activer service', service?.serviceFor);
    let response;
    switch (service?.serviceFor) {
      case 'ZOOP':
        response = await zoop.verifyGstin(zoopData, service);
        break;
      case 'INVINCIBLE':
        response = await invincible.verifyGstin(Invincibledata, service);
        break;
      case 'TRUTHSCREEN':
        response = await truthscreen.verifyGstin(truthscreendata, service);
        break;
      default:
        throw new Error(`Unsupported GSTIN service`);
    }
    console.log(
      "gstin verify response ===>",JSON.stringify(response) );
    logger.info(`gstin verify response: ${JSON.stringify(response)}`);
    const newGstinVerification = await gstin_verifyModel.create(response);
    return res.status(200).json({ message: 'Success', data: response?.result, success: true });
  } catch (error) {
    // updateFailure()
    console.error("Error performing GSTIN verification:", error);
    logger.error(`Error performing GSTIN verification:${error}`);
    return res.status(500).json(ERROR_CODES?.SERVER_ERROR);
  }
};
