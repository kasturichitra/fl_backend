
const IncorporationCertificateModel = require("../models/IncorporationCertificateModel")
const { verifyCinTruthScreen } = require("../../service/provider.truthscreen");
const { verifyCinInvincible } = require("../../service/provider.invincible");
const { selectService } = require("../../service/serviceSelector");
const { ERROR_CODES } = require("../../../utlis/errorCodes");
const logger = require("../../Logger/logger");

exports.handleCINVerification = async (req, res , next) => {
  const { CIN } = req.body;
  const data = req.body;

  if (!CIN) {
    logger.info("cin number is not defined ===>>")
    return res.status(404).json(ERROR_CODES?.BAD_REQUEST);
  }

  const cinDetails = await IncorporationCertificateModel.findOne({ cinNumber : CIN })

  if(cinDetails){
    return res.status(200).json({ message : cinDetails?.response?.data})
  }

   const service = await selectService("CIN");

  console.log("----active service for pan Verify is ----", service);
  if (!service) {
    return res.status(404).json(ERROR_CODES?.NOT_FOUND);
  }

  try {
       let response;
    switch (service.serviceFor) {
      case "INVINCIBLE":
        console.log("Calling INVINCIBLE API...");
        response = await verifyCinInvincible(data);
        break;
      case "TRUTHSCREEN":
        console.log("Calling TRUTHSCREEN API...");
        response = await verifyCinTruthScreen(data);
        break;
      default:
        throw new Error("Unsupported PAN service");
    }

    console.log("API Response:", response);

    if(response?.message?.toUpperCase() == "VALID"){
       const companyDetails = response;
    console.log("companyDetails===>", companyDetails)
    if (!companyDetails) {
      let errorMessage = {
        message: "Invalid response structure: Missing company details", 
        statusCode: 400,
      };
      return next(errorMessage);
    }
    if (!companyDetails?.data) {
      let errorMessage = {
        message: "GSTIN not found in the response", 
        statusCode: 400,
      };
      return next(errorMessage);
    }
    const newCinVerification = await IncorporationCertificateModel.create({
      response: companyDetails,
      cinNumber: CIN,
      createdDate:new Date().toLocaleDateString(),
      createdTime:new Date().toLocaleTimeString()
    });

      console.log("Data saved to MongoDB:", newCinVerification);
      res.status(200).json({message: "Valid", response: response, success: true});
    }else{

    }
   

  } catch (error) {
    console.error('Error performing company verification:', error.message);

       let errorMessage = {
        message: "Failed to perform company verification", 
        statusCode: 400,
      };
      return next(errorMessage);
  }
};