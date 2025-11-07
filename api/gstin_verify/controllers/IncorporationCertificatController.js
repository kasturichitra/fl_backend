
const IncorporationCertificateModel = require("../models/IncorporationCertificateModel")
const { default: axios } = require("axios");
const checkingDetails = require("../../../utlis/authorization");
const loginAndSms = require("../../loginAndSms/model/loginAndSmsModel");
const { verifyCinTruthScreen } = require("../../service/provider.truthscreen");

exports.handleCINVerification = async (req, res , next) => {
  const { CIN } = req.body;
  const data = req.body;

  if (!CIN) {
    let errorMessage = {
      message: "CIN is required", 
      statusCode: 400,
    };
    return next(errorMessage);
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
    // const response = await axios.post('https://api.invincibleocean.com/invincible/get/companyDetailsV1', requestData, {
    //   headers: {
    //     'accept': 'application/json',
    //     'clientId': process.env.INVINCIBLE_CLIENT_ID,
    //     'secretKey': process.env.INVINCIBLE_SECRET_KEY
    //   }
    // });

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
      token: check,
      MerchantId: MerchantId,
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

exports.verifyPanNumber = async (req, res) => {
  const data = req.body;
  const { panNumber } = data;
  if (!panNumber?.trim()) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }
  if (
    panNumber?.trim()?.length > 10 ||
    panNumber?.trim()?.length < 10 ||
    !panNumber?.match(
      /^[A-Za-z]{3}[PCHABGJLFTpchabgjlft][A-Za-z][0-9]{4}[A-Za-z]$/
    )
  ) {
    return res.status(400).json(ERROR_CODES?.BAD_REQUEST);
  }
  const encryptedPan = encryptData(panNumber);

  const existingPanNumber = await panverificationModel.findOne({
    panNumber: encryptedPan,
  });
  console.log("existingPanNumber===>", existingPanNumber);
  if (existingPanNumber) {
    const decryptedPanNumber = decryptData(existingPanNumber?.panNumber);
    const decryptedResponse = {
      ...existingPanNumber?.response,
      PAN: decryptedPanNumber,
    };
    return res.json({
      message: "Valid",
      response: decryptedResponse,
      success: true,
    });
  }

  const service = await selectService("PAN");

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
        response = await verifyPanInvincible(data);
        break;
      case "TRUTHSCREEN":
        console.log("Calling TRUTHSCREEN API...");
        response = await verifyPanTruthScreen(data);
        break;
      case "ZOOP":
        console.log("Calling ZOOP API...");
        response = await verifyPanZoop(data);
        break;
      default:
        throw new Error("Unsupported PAN service");
    }
    console.log(
      `response from active service for pan ${service.serviceFor} ${JSON.stringify(response)}`
    );
    logger.info(`response from active service for pan ${service.serviceFor} ${JSON.stringify(response)}`)
    if (response?.message?.toUpperCase() == "VALID") {
      const encryptedPan = encryptData(response?.result?.PAN);
      const encryptedResponse = {
        ...response?.result,
        PAN: encryptedPan,
      };
      const storingData = {
        panNumber: encryptedPan,
        userName: response?.result?.Name,
        response: encryptedResponse,
        serviceResponse: response?.responseOfService,
        serviceName: response?.service,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString(),
      };

      await panverificationModel.create(storingData);

      return res.json({
        message: "Valid",
        response: response?.result,
        success: true,
      });
    } else {
      const invalidResponse = {
        PAN: panNumber,
        Name: "",
        PAN_Status: "",
        PAN_Holder_Type: "",
      };
      return res.json({
        message: "InValid",
        response: invalidResponse,
        success: false,
      });
    }

    // await resetSuccess(service);  // if want to implement it when continue three time serr is show then Freez the service
  } catch (error) {
    console.log("error in verifyPanNumber ===>>>", error)
    await updateFailure(service);
    res
      .status(500)
      .json({ message: "Service failed, fallback will apply next call" });
  }
};