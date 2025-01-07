const panverificationModel = require("../models/panverification.model");
const axios = require('axios');
require('dotenv').config();
const checkingDetails = require("../../../middleware/authorization")
const ServiceTrackingModel = require("../../ServiceTrackingModel/models/ServiceTrackingModel.model");
const loginAndSms = require("../../loginAndSms/model/loginAndSmsModel");
const logger = require("../../Logger/logger");

exports.verifyPan = async (req, res , next) => {
  const { panNumber } = req.body;
  console.log("pan number from frontend===>", panNumber);
  const authHeader = req.headers.authorization;

  if (!panNumber) {
    let errorMessage = {
      message: "PAN number is required",
      statusCode: 400,
    };
    return next(errorMessage);
  }

  try {
    console.log("hello")
   const check = await checkingDetails(authHeader , next )
   console.log(check)

     if(!check){
      return ;
    }

    const merchant = await loginAndSms.findOne({ token : check });
    if (!merchant) {
      let errorMessage = {
        message: "User not found",
        statusCode: 404,
      };
      return next(errorMessage);
    }
    const MerchantId = merchant?.merchantId;
    if (!MerchantId) {
      let errorMessage = {
        message: "merchant ID not found for the user",
        statusCode: 404,
      };
      return next(errorMessage);
    }
    const existingPanNumber = await panverificationModel.findOne({ panNumber:panNumber });
    console.log("existingPanNumber===>",existingPanNumber)
    if (existingPanNumber) {
      await panverificationModel.updateOne(
        { _id: existingPanNumber._id },
        { $set: { MerchantId: MerchantId , token : check} }
      );
      return res.status(200).json({ message: existingPanNumber?.response });
    }
    const activeService = await ServiceTrackingModel.findOne({ serviceFor: "Pan", serviceStatus: "Active" });
    console.log("activeService====>", activeService);
    if (activeService) {
      if (activeService?.serviceName === "Invincible") {
        const response = await invinciblePanVerification(panNumber, check, MerchantId);
        console.log(response)
        if(response.message == "Valid"){
          return res.json({ message: response?.result } );

        }
        if(response.message == "NoDataFound"){
          let errorMessage = {
            message: `No Data Found for this panNumber ${panNumber}`,
            statusCode: 404,
          };
          return next(errorMessage);
        }
        if(response.message == "NoBalance"){
          let errorMessage = {
            message: `No Balance for this verification`,
            statusCode: 404,
          };
          return next(errorMessage);
        }
      }
      else if (activeService?.serviceName === "Zoop") {
        const response = await zoopPanVerification(panNumber, check, MerchantId);
        console.log("response from zoop............", response);
        const username = response?.username;
        console.log(response)
        if(response.message == "Valid"){
          return res.json({ message: response?.result } );
        }
        if(response.message == "NoDataFound"){
          let errorMessage = {
            message: `No Data Found for this panNumber ${panNumber}`,
            statusCode: 404,
          };
          return next(errorMessage);
        }
      }
    }
    else {
      console.log("No active service available")
      let errorMessage = {
        message: "No Active Service Available",
        statusCode: 404,
      };
      return next(errorMessage);
    }
  } catch (error) {
    console.log('Error in PAN verification:', error);
        if (error.response) {
          let errorMessage = {
            message: error?.response?.data,
            statusCode: 500,
          };
          return next(errorMessage);
    } else if (error.request) {
      let errorMessage = {
        message: "No response received from server",
        statusCode: 500,
      };
      return next(errorMessage);
    } else {
      let errorMessage = {
        message: "Error in PAN verification Try again after some time",
        statusCode: 500,
      };
      return next(errorMessage);
    }
  }
};

async function invinciblePanVerification(panNumber, token, MerchantId) {
  try {
    const clientId = process.env.INVINCIBLE_CLIENT_ID;
    const secretKey = process.env.INVINCIBLE_SECRET_KEY;
    const url = 'https://api.invincibleocean.com/invincible/panPlus';
    const headers = {
      'clientId': clientId,
      'secretKey': secretKey,
      'Content-Type': 'application/json'
    };
    const data = { panNumber };
    const response = await axios.post(url, data, { headers });
    console.log('API response:', response.data);
    if (response.data.code === 404) {
      console.log(" pan data not found")
      return { message: "NoDataFound" }
    }
    else if (response.data.code === 402) {
      console.log("NoBalance")
      logger.info("NoBalance")
      return { message: "NoBalance" }
    }
    const obj = response.data;
    const result = obj.result || {};
    const firstName = result.FIRST_NAME || '';
    const middleName = result.MIDDLE_NAME || '';
    const lastName = result.LAST_NAME || '';

    const username = [firstName, middleName, lastName].filter(Boolean).join(' ');
    const panData = {
      panNumber,
      response: obj,
      token,
      MerchantId,
      userName:username,
      createdDate:new Date().toLocaleDateString(),
      createdTime:new Date().toLocaleTimeString()
    };
    const newpanVerification = await panverificationModel.create(panData);
    return { result : response.data, message: "Valid" };
  } catch (error) {
    console.log('Error performing PAN verification:', error);
    console.log("error.response in pan verification====>", error.response)
    if (error.response) {
      throw new Error(error.response.data);
    } else if (error.request) {
      throw new Error('No response received from server');
    } else {
      throw new Error(error.message);
    }
  }
}
async function zoopPanVerification(panNumber, token, MerchantId) {
  try {
    const options = {
      method: 'POST',
      url: 'https://live.zoop.one/api/v1/in/identity/pan/lite',
      headers: {
        'app-id': process.env.ZOOP_APP_ID,
        'api-key': process.env.ZOOP_API_KEY,
        'Content-Type': 'application/json',
        'org-id': process.env.ZOOP_ORG_ID
      },
      data: {
        mode: 'sync',
        data: {
          customer_pan_number: panNumber,
          consent: 'Y',
          consent_text: 'Iconsenttothisinformationbeingsharedwithzoop.one'
        }
      }
    };

    const response = await axios(options);

    // Parse the response body
    const obj = response.data;
    console.log(obj);
    if (obj.response_code === "101") {
      return { message: "NoDataFound" }

    }
    const pancardNumber = obj.result.pan_number;
    const username = obj.result.user_full_name;

    // Save the PAN verification data to your MongoDB collection
    const panVerificationData = {
      panNumber,
      response: obj,
      token,
      MerchantId,
      userName:username,
      createdDate:new Date().toLocaleDateString(),
      createdTime:new Date().toLocaleTimeString()
    };

    await panverificationModel.create(panVerificationData);
    return { result: response.data, message: "Valid" };
  } catch (error) {
    console.log('Error performing PAN verification:', error);
    throw new Error('Failed to perform PAN verification');
  }
}