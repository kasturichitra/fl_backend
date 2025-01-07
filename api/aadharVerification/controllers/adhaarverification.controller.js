const adhaarverificationModel = require("../models/adhaarverification.model");
const axios = require('axios');
const panverificationModel = require("../../panVerification/models/panverification.model");
const ServiceTrackingModelModel = require("../../ServiceTrackingModel/models/ServiceTrackingModel.model");
const loginAndSms = require("../../loginAndSms/model/loginAndSmsModel")
const invincibleClientId = process.env.INVINCIBLE_CLIENT_ID
const invincibleSecretKey = process.env.INVINCIBLE_SECRET_KEY
const checkingDetails = require("../../../middleware/authorization");
const logger = require("../../Logger/logger");

exports.sentadhaarotp = async (req, res, next) => {
  const { aadharNumber } = req.body;
  console.log("aadharNumber from frontend:", aadharNumber);

  const authHeader = req.headers.authorization;
  const check = await checkingDetails(authHeader , next)
  const hashCode = "drGxU6kMCwN";

  const activeService = await ServiceTrackingModelModel.findOne({ serviceFor: "Aadhar", serviceStatus: "Active" });
  console.log("ActiveService:", activeService);

  if (!activeService) {
    let errorMessage = {
      message: "No Active Service Found",
      statusCode: 500
    }
    return next(errorMessage)
  }

  if (activeService?.serviceName === "Invincible") {
    const response = await invincibleAadharSendOtp(aadharNumber, hashCode, check);
    console.log("Response after verifying Aadhaar number in Invincible:", response);
    return res.json(response);
  } else if (activeService.serviceName === "Zoop") {
    console.log("Verifying Aadhaar from Zoop");
    const response = await ZoopAadharSendOtp(aadharNumber, hashCode, check);
    console.log("Response after verifying Aadhaar number in Zoop:", response);
    return res.json(response);
  } else {
    let errorMessage = {
      message: "Invalid service name",
      statusCode: 500
    }
    return next(errorMessage)
  }
};
async function invincibleAadharSendOtp(aadharNumber, hashCode, token) {
  const aadharDetails = {
    aadhaarNumber: aadharNumber,
  }
  try {
    const details = await axios.post(
      'https://api.invincibleocean.com/invincible/aadhaarVerification/requestOtp',
      aadharDetails,
      {
        headers: {
          'clientId': invincibleClientId,
          'content-type': 'application/json',
          'secretKey': invincibleSecretKey,
          'hash': hashCode
        }
      }
    );

    const clientId = details.data.result.data.client_id;
    console.log("aadhar response from servcice=====>", details.data)
    const merchant = await loginAndSms.findOne({ token : token });
    if (!merchant) {
      return ({ message: 'merchant not found' });
    }
    const MerchantId = merchant.merchantId;
    console.log("aadhaar verify MerchantId", MerchantId);

    const detailsToSend = {
      aadharNumber,
      request_id: clientId,
      token,
      MerchantId
    };

    const adhardata = await adhaarverificationModel.findOne({ aadharNumber });
    if (!adhardata) {
      const response = await adhaarverificationModel.create(detailsToSend);
      console.log("Created Aadhaar verification record:", response);
    }
    else {
      const response = await adhaarverificationModel.updateOne({ aadharNumber }, { $set: { token, request_id: clientId } });
      console.log("updated Aadhaar verification record:", response);
    }
    return ({ success: true, message: 'Otp was Sent to your linked Mobile Number', clientId });
  } catch (error) {
    console.log('Error performing Aadhaar OTP verification:', error?.response?.status);
    console.log('Error in aadhar service', error);
    let errorMessage = 'Failed to perform Aadhaar OTP verification';
    if (error?.response?.status === 400) {
      return ({ success: false, message: "Invalid" });
    }
    else {
      errorMessage = error?.message;
      console.log("errorMessage====>", errorMessage)
      return ({ success: false, message: "InternalServerError" });
    }

  }
}
async function ZoopAadharSendOtp(aadharNumber, hashCode, token) {
  try {
    const response = await axios.post('https://live.zoop.one/in/identity/okyc/otp/request', {
      mode: 'sync',
      data: {
        customer_aadhaar_number: aadharNumber,
        name_to_match: "Nagarjuna",
        consent: "Y",
        consent_text: "I hereby declare my consent agreement for fetching my information via ZOOP API"
      },
      task_id: "08b01aa8-9487-4e6d-a0f0-c796839d6b78"
    },
      {
        headers: {
          'auth': 'false',
          'app-id': '621cbd236fed98001d14a0fc',
          'api-key': '711GWK9-9374RRM-QTBNYFT-CACRKFW',
          'Content-Type': 'application/json',
        }
      }
    );

    const responseData = response.data;
    console.log('Response from Aadhaar verification API in Zoop:', responseData);

    if (responseData) {
      const merchant = await panverificationModel.findOne({ token : token });
      if (!merchant) {
        return { status: 0, message: 'Merchant not found' };
      }
      const MerchantId = merchant.MerchantId;
      const detailsToSend = {
        aadharNumber,
        request_id: responseData?.request_id,
        taskId: responseData?.task_id,
        token,
        MerchantId
      };
      console.log("Aadhaar verify MerchantId in Zoop:", MerchantId);
      const clientId = responseData?.request_id
      const adhardata = await adhaarverificationModel.findOne({ aadharNumber });
      if (!adhardata) {
        await adhaarverificationModel.create(detailsToSend);
        console.log("Created Aadhaar verification record:", detailsToSend);
        return ({ success: true, message: 'Otp was Sent to your linked Mobile Number', clientId: responseData?.request_id, task_id: responseData?.task_id });
      }

      else {
        const response = await adhaarverificationModel.updateOne({ aadharNumber }, { $set: { token, request_id: clientId } });
        console.log("updated Aadhaar verification record:", response);

      }
      if (responseData?.response_message === "Valid Authentication") {
        return ({ success: true, message: 'validDetails', clientId: responseData?.request_id, task_id: responseData?.task_id });
      }
      else if (responseData?.metadata?.reason_message === "Invaild Aadhaar") {
        return ({ success: false, message: "Invalid" });

      }
      else {
        return ({ success: false, message: "Invalid" });
      }

    } else {
      return { status: 0, message: 'Failed to send OTP' };
    }
  } catch (error) {
    console.error('Error performing Aadhaar verification:', error);
    return { status: 0, message: 'Error performing Aadhaar verification' };
  }
}

exports.adhaarotpverify = async (req, res , next) => {
  try {
    const { client_id, otp, task_id, aadharNumber } = req.body;
    const authHeader = req.headers.authorization;
    console.log("client_id, otp in aadhaar otp verification===>", client_id, otp)
    logger.info("client_id, otp in aadhaar otp verification===>", client_id, otp)
    const check = await checkingDetails(authHeader , next)
    if (!client_id || !otp) {
      let errorMessage = {
        message: "client_id and otp are required",
        statusCode: 400,
      };
      return next(errorMessage);

    }
    console.log(check , "check")
    const merchant = await loginAndSms.findOne({ token : check });
    if (!merchant) {
      let errorMessage = {
        message: "User not found",
        statusCode: 404,
      };
      return next(errorMessage);
    }
    const MerchantId = merchant.merchantId;

    if (!MerchantId) {
      let errorMessage = {
        message: "merchant ID not found for the user",
        statusCode: 404,
      };
      return next(errorMessage);
    }

    if(MerchantId){
      const activeService = await ServiceTrackingModelModel.findOne({ serviceFor: "Aadhar", serviceStatus: "Active" })

      if(!activeService){
        let errorMessage = {
          message: "No Active Service Available",
          statusCode: 404,
        };
        return next(errorMessage);
      }
      console.log("activeService in aadhar===>", activeService)
      if (activeService.serviceName === "Invincible") {
        const response = await invincibleAadharOtpVerify(client_id, otp, check, MerchantId,aadharNumber, task_id)
        console.log("response after verfying aadhar otp====>", response)
        if (response.message === "Otp Verified Successfully") {
          return res.status(200).json( response );
        }
        else if (response.message === "timeOut") {
          let errorMessage = {
            message: "timeOut",
            statusCode: 500,
          };
          return next(errorMessage);
        }
        else if (response.message === "invalidOtp") {
          let errorMessage = {
            message: "invalidOtp",
            statusCode: 500,
          };
          return next(errorMessage);
        }
        else if (response.message === "InternalServerError") {
          let errorMessage = {
            message: "InternalServerError",
            statusCode: 500,
          };
          return next(errorMessage);
        }
        else {
          let errorMessage = {
            message: "Invalid",
            statusCode: 500,
          };
          return next(errorMessage);
        }
      }
      else if (activeService.serviceName === "Zoop") {
        const response = await ZoopOtpVerify(client_id, otp, check, MerchantId,aadharNumber, task_id)
        console.log("response after verfying aadhar otp in zoop===>", response)
        if (response.message === "Otp Verified Successfully") {
          return res.status(200).json( response );
        }
        else if (response.message === "timeOut") {
          let errorMessage = {
            message: "timeOut",
            statusCode: 500,
          };
          return next(errorMessage);
        }
        else if (response.message === "invalidOtp") {
          let errorMessage = {
            message: "invalidOtp",
            statusCode: 400,
          };
          return next(errorMessage);
        }
        else if (response.message === "InternalServerError") {
          let errorMessage = {
            message: "InternalServerError",
            statusCode: 500,
          };
          return next(errorMessage);
        }
        else {
          let errorMessage = {
            message: "Invalid",
            statusCode: 500,
          };
          return next(errorMessage);
        }
      }
    }

  
  } catch (error) {
    console.log('Error performing adhaarotp verification:', error);
    logger.error('Error performing adhaarotp verification:', error)
    let errorMessage = {
      message: "Failed to perform adhaarotp verification",
      statusCode: 500,
    };
    return next(errorMessage);
  }
};

async function invincibleAadharOtpVerify(client_id, otp, aadharNumber, task_id) {
  const requestData = { client_id, otp };
  try {
    console.log("hello")
    const response = await axios.post('https://api.invincibleocean.com/invincible/aadhaarVerification/submitOtp', requestData, {
      headers: {
        'clientId': invincibleClientId,
        'content-type': 'application/json',
        'secretKey': invincibleSecretKey
      }
    });
    const responseData = response?.data;
    console.log("responseData" , responseData)
    const aadhaarData = response?.data?.result?.data ;
    const addressDetails = response?.data?.result?.data?.address
    const generalDetails = response?.data?.result?.data
    console.log("response data after verfying aadhar in invincible===>", JSON.stringify(responseData))
    console.log("generalDetails invincibleAadharOtpVerify===>", generalDetails)

    const userNameFromAadhar = responseData?.result?.data?.full_name;
    const aadharImage = responseData?.result?.data?.profile_image;
    await adhaarverificationModel.updateOne(
      { request_id: client_id },
      {
        $set: {
          response: responseData, aadharImage: aadharImage,
          aadharNumber: aadharNumber,
          aadharName: userNameFromAadhar,
          state: addressDetails?.state,
          country: addressDetails?.country,
          district: addressDetails?.dist,
          subDistrict: addressDetails?.subdist,
          street: addressDetails?.street,
          houseNo: addressDetails?.house,
          location: addressDetails?.loc,
          gender: generalDetails?.gender,
          pinCode: generalDetails?.zip,
          dateOfBirth: generalDetails?.dob,
          createdDate:new Date().toLocaleDateString(),
          createdTime:new Date().toLocaleTimeString()
        }
      }
    );
    console.log("adhaarverificationModel====>", adhaarverificationModel)
    return ({ message: "Otp Verified Successfully", aadhaarData });
  } catch (error) {
    console.log("error while veryfying otp====>")
    // console.log("error while veryfying otp====>", error)
    console.log("error data====>", error.data)
    console.log("error response====>", error.response)
    console.log("error response status====>", error.response.status)
    if (error.response.status === 504) {
      return ({ message: "timeOut", success: false })
    }
    else if (error.response.data?.message === "Error: Wrong Otp..!") {
      return ({ message: "invalidOtp", success: false })
    }
    else {
      return ({ message: "InternalServerError", success: false })

    }
  }
}
async function ZoopOtpVerify(client_id, otp, token, MerchantId, aadharNumber, task_id) {
  try {
    const response = await axios.post('https://live.zoop.one/in/identity/okyc/otp/verify', {
      data: {
        request_id: client_id,
        otp: otp,
        consent: "Y",
        consent_text: "I hear by declare my consent agreement for fetching my information via ZOOP API"
      },
      task_id: task_id
    },
      {
        headers: {
          'auth': 'false',
          'app-id': '621cbd236fed98001d14a0fc',
          'api-key': '711GWK9-9374RRM-QTBNYFT-CACRKFW',
          'Content-Type': 'application/json',
        }
      })
    const responseData = response?.data
    const aadhaarData = response?.data?.result?.data ;
    // console.log("adhar otp response from zoop===>", response?.data)

    const userNameFromAadhar = responseData?.result?.user_full_name;
    const aadharImage = responseData?.result?.user_profile_image;
    const addressDetails = responseData?.result.user_address
    const generalDetails = responseData?.result
    console.log("generalDetails ZoopOtpVerify===>", generalDetails)
    await adhaarverificationModel.findOneAndUpdate(
      { request_id: client_id },
      {
        $set: {
          response: responseData, aadharImage: aadharImage,
          aadharNumber: aadharNumber,
          aadharName: userNameFromAadhar,
          state: addressDetails?.state,
          country: addressDetails?.country,
          district: addressDetails?.dist,
          subDistrict: addressDetails?.subdist,
          street: addressDetails?.street,
          houseNo: addressDetails?.house,
          location: addressDetails?.loc,
          gender: generalDetails?.user_gender,
          pinCode: generalDetails?.address_zip,
          dateOfBirth: generalDetails?.user_dob,
          createdDate:new Date().toLocaleDateString(),
          createdTime:new Date().toLocaleTimeString()
        }
      }
    );
    return ({ message: "Otp Verified Successfully", aadhaarData });
  } catch (error) {
    console.log("error while veryfying otp====>", error)
    console.log("error data====>", error.data)
    console.log("error response====>", error.response.data)
    console.log("error response status====>", error.response.status)
    if (error.response.status === 504) {
      return ({ message: "timeOut", success: false })
    }
    else if (error.response.status === 403) {
      return ({ message: "invalidOtp", success: false })
    }
    else if (error?.response?.data?.metadata?.reason_message === "Wrong OTP Entered") {
      return ({ message: "invalidOtp", success: false })
    }
    else {
      return ({ message: "InternalServerError", success: false })
    }
  }
}

function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

