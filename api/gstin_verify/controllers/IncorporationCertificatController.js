
const IncorporationCertificateModel = require("../models/IncorporationCertificateModel")
const { default: axios } = require("axios");
const checkingDetails = require("../../../utlis/authorization");
const loginAndSms = require("../../loginAndSms/model/loginAndSmsModel");

exports.handleCINVerification = async (req, res , next) => {
  const { CIN } = req.body;
  const authHeader = req.headers.authorization;

  const check = await checkingDetails(authHeader , next)

  if (!CIN) {
    let errorMessage = {
      message: "CIN is required", 
      statusCode: 400,
    };
    return next(errorMessage);
  }
  const merchantDetails = await loginAndSms.findOne({ token:check })

  const cinDetails = await IncorporationCertificateModel.findOne({ cinNumber : CIN })

  if(cinDetails){
    return res.status(200).json({ message : cinDetails?.response?.data})
  }

  const requestData = { CIN };

  console.log("Request Data:", requestData);

  try {
    const response = await axios.post('https://api.invincibleocean.com/invincible/get/companyDetailsV1', requestData, {
      headers: {
        'accept': 'application/json',
        'clientId': process.env.INVINCIBLE_CLIENT_ID,
        'secretKey': process.env.INVINCIBLE_SECRET_KEY
      }
    });

    console.log("API Response:", response.data);

    const companyDetails = response.data?.result;
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
      MerchantId: merchantDetails?.merchantId,
      createdDate:new Date().toLocaleDateString(),
      createdTime:new Date().toLocaleTimeString()
    });

    console.log("Data saved to MongoDB:", newCinVerification);
    res.status(200).json( { message : newCinVerification?.response?.data } );

  } catch (error) {
    console.error('Error performing company verification:', error.message);

       let errorMessage = {
        message: "Failed to perform company verification", 
        statusCode: 400,
      };
      return next(errorMessage);
  }
};