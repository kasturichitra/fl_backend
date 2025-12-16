const IncorporationCertificateModel = require("../models/IncorporationCertificateModel");
const { verifyCinTruthScreen } = require("../../service/provider.truthscreen");
const { verifyCinInvincible } = require("../../service/provider.invincible");
const { selectService } = require("../../service/serviceSelector");
const { ERROR_CODES } = require("../../../utlis/errorCodes");
const logger = require("../../Logger/logger");
const handleValidation = require("../../../utlis/lengthCheck");
const { CinActiveServiceResponse } = require("../../GlobalApiserviceResponse/CinServiceResponse");

exports.handleCINVerification = async (req, res, next) => {
  const { CIN } = req.body;
  const data = req.body;
  const isCinValid = handleValidation("cin", CIN, res);
  if (!isCinValid) return;

  console.log("All inputs are valid, continue processing...");

  const cinDetails = await IncorporationCertificateModel.findOne({
    cinNumber: CIN,
  });

  if (cinDetails) {
    return res.status(200).json({
      data: cinDetails?.response?.data,
      message: "Valid",
      success: true,
    });
  }

  const service = await selectService("CIN");

  console.log("----active service for cin Verify is ----", service);
  logger.info("----active service for cin Verify is ----", service);
  if (!service) {
    return res.status(404).json(ERROR_CODES?.NOT_FOUND);
  }

  try {
    let response = await CinActiveServiceResponse(CIN,service,0)

    console.log("API Response:", response);
    logger.info(
      "----API Response from active service of cin is ----",
      response
    );

    if (response?.message?.toUpperCase() == "VALID") {
      const companyDetails = response;
      console.log("companyDetails===>", companyDetails);
      if (!companyDetails) {
        let errorMessage = {
          message: "Invalid response structure: Missing company details",
          statusCode: 400,
        };
        return next(errorMessage);
      }
      if (!companyDetails?.data) {
        let errorMessage = {
          message: "Cin not found in the response",
          statusCode: 400,
        };
        return next(errorMessage);
      }
      const newCinVerification = await IncorporationCertificateModel.create({
        response: companyDetails,
        cinNumber: CIN,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      });

      console.log("Data saved to MongoDB:", newCinVerification);
      res.status(200).json({ message: "Valid", data: response, success: true });
    } else {
    }
  } catch (error) {
    console.error("Error performing company verification:", error.message);

    let errorMessage = {
      message: "Failed to perform company verification",
      statusCode: 400,
    };
    return next(errorMessage);
  }
};
