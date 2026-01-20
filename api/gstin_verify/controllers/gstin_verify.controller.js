const gstin_verifyModel = require("../models/gstin_verify.model");
const { selectService } = require("../../service/serviceSelector");
const { ERROR_CODES } = require("../../../utlis/errorCodes");
const { gstLogger } = require("../../Logger/logger");
const { GSTActiveServiceResponse } = require("../../GlobalApiserviceResponse/GstServiceResponse");
const { createApiResponse } = require("../../../utlis/ApiResponseHandler");
const handleValidation = require("../../../utlis/lengthCheck");
const checkingRateLimit = require("../../../utlis/checkingRateLimit");

exports.gstinverify = async (req, res, next) => {
  const { gstinNumber } = req.body;
  console.log(`gstinNumber Details ===>> gstinNumber: ${gstinNumber}`);
  gstLogger.info(`gstinNumber Details ===>> gstinNumber: ${gstinNumber}`);

  const capitalNumber = gstinNumber?.toUpperCase();
  const isValid = handleValidation("gstin", capitalNumber, res);
  if (!isValid) return;

  try {
    if (!gstinNumber) {
      return res.status(400).json(ERROR_CODES?.BAD_REQUEST)
    }
    const existingGstin = await gstin_verifyModel.findOne({ gstinNumber });

    if (existingGstin) {
      const dataToShow = existingGstin?.result;
      return res.status(200).json(createApiResponse(200, dataToShow, 'Valid'));
    }

    const service = await selectService('GSTIN');
    console.log('gst inverify activer service', service);
    let response = await GSTActiveServiceResponse(gstinNumber, service, 0)

    if (response?.message?.toUpperCase() == "VALID") {

      const encryptedGst = encryptData(response?.result?.gstinNumber);
      const encryptedResponse = { ...response?.result, gstinNumber: encryptedGst };
      const storingData = {
        status: 1,
        gstinNumber: encryptedPan,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await gstin_verifyModel.create(storingData);
      return res.status(200).json(createApiResponse(200, response?.result, 'Success'));
    } else {
      return res.satus(404).json(createApiResponse(404, { gstinNumber }, 'Failed'));
    }
  } catch (error) {
    console.error("Error performing GSTIN verification:", error);
    gstLogger.error(`Error performing GSTIN verification:${error}`);
    return res.status(500).json(ERROR_CODES?.SERVER_ERROR);
  }
};

