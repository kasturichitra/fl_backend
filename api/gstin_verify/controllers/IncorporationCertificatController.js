const IncorporationCertificateModel = require("../models/IncorporationCertificateModel");
const { selectService } = require("../../service/serviceSelector");
const { ERROR_CODES } = require("../../../utlis/errorCodes");
const logger = require("../../Logger/logger");
const handleValidation = require("../../../utlis/lengthCheck");
const { findingInValidResponses } = require("../../../utlis/InvalidResponses");
const { CinActiveServiceResponse } = require("../../GlobalApiserviceResponse/CinServiceResponse");
const { createApiResponse } = require("../../../utlis/ApiResponseHandler");

exports.handleCINVerification = async (req, res, next) => {
    const {
    CIN,
    mobileNumber = "",
    serviceId = "",
    categoryId = "",
  } = req.body;
  const isCinValid = handleValidation("cin", CIN, res);
  if (!isCinValid) return;

  console.log("All inputs are valid, continue processing...");

    const identifierHash = hashIdentifiers({
      panNo: capitalPanNumber,
    });
  
    const panRateLimitResult = await checkingRateLimit({
      identifiers: { identifierHash },
      serviceId,
      categoryId,
      clientId: req.clientId,
    });
  
    if (!panRateLimitResult.allowed) {
      return res.status(429).json({
        success: false,
        message: panRateLimitResult.message,
      });
    }
  
    const tnId = genrateUniqueServiceId();
    kycLogger.info(`pan txn Id ===>> ${tnId}`);
    let maintainanceResponse;
    if (req.environment?.toLowercase() == "test") {
      maintainanceResponse = await creditsToBeDebited(
        req.clientId,
        serviceId,
        categoryId,
        tnId,
      );
    } else {
      maintainanceResponse = await chargesToBeDebited(
        req.clientId,
        serviceId,
        categoryId,
        tnId,
      );
    }
  
    if (!maintainanceResponse?.result) {
      return res.status(500).json({
        success: false,
        message: "InValid",
        response: {},
      });
    }

  const cinDetails = await IncorporationCertificateModel.findOne({
    cinNumber: CIN,
  }); 
  console.log ('is cin details is present',cinDetails)

  if (cinDetails) {
    return res.status(200).json(createApiResponse(200,cinDetails?.response?.result,'Valid'));
  }

  const service = await selectService(categoryId, serviceId);

  logger.info("----active service for cin Verify is ----", service);

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
      const newCinVerification = await IncorporationCertificateModel.create({
        response: companyDetails,
        status: 1,
        cinNumber: CIN,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      });

      console.log("Data saved to MongoDB:", newCinVerification);
      res.status(200).json({ message: "Valid", data: response?.result, success: true });
    } else {
      const newCinVerification = await IncorporationCertificateModel.create({
        response: {},
        status: 2,
        cinNumber: CIN,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      });

      console.log("Data saved to MongoDB:", newCinVerification);
      res.status(200).json({
        message: "InValid",
        data: {
          CinNUmber: CIN,
          ...findingInValidResponses("cin"),
        },
        success: false,
      });
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
