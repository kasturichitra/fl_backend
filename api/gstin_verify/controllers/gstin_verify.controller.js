const gstin_verifyModel = require("../models/gstin_verify.model");
const { selectService } = require("../../service/serviceSelector");
const zoop = require("../../service/provider.zoop");
const invincible = require("../../service/provider.invincible");
const truthscreen = require("../../service/provider.truthscreen");
const { ERROR_CODES } = require("../../../utlis/errorCodes");
const { generateTransactionId } = require("../../../utlis/helper");

exports.gstinverify = async (req, res, next) => {
  console.log("gstin verify is called")
  const TXNID = generateTransactionId();
  console.log('GStIn verify txn id', TXNID)
  try {
    const { gstinNumber } = req.body;
    if (!gstinNumber) {
      return res.status(404).json(ERROR_CODES?.NOT_FOUND)
    }
    const existingGstin = await gstin_verifyModel.findOne({ gstinNumber });
    console.log("legalName=== companyName=== in already exist gst>", existingGstin);
    if (existingGstin) {
      const dataToShow = {
        gstin: existingGstin?.gstinNumber,
        companyName: existingGstin?.companyName
      }
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
      "docType": 23,
      "docNumber": gstinNumber
    };
    const service = await selectService('GSTIN');

    if (!service || service === undefined) {
      return res.status(503).json({ error: "No service available" });
    }
    console.log('gst inverify activer service', service?.serviceFor);
    let result;
    switch (service?.serviceFor) {
      case 'ZOOP':
        result = await zoop.verifyGstin(zoopData);
        break;
      case 'INVINCIBLE':
        result = await invincible.verifyGstin(Invincibledata);
        break;
      case 'TRUTHSCREEN':
        result = await truthscreen.verifyGstin(truthscreendata);
        break;
    }
    console.log('gstin verify response', result);
    const newGstinVerification = await gstin_verifyModel.create(result);
    const dataToShow = {
      gstin: result?.gstinNumber,
      companyName: result?.companyName
    }
    return res.status(200).json({ message: 'Success', data: dataToShow, success: true });
  } catch (error) {
    console.error("Error performing GSTIN verification:", error);
    return res.status(500).json(ERROR_CODES?.SERVER_ERROR);
  }
};
