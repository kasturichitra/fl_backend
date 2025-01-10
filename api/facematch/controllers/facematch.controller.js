const axios = require("axios");
const checkingDetails = require("../../../utlis/authorization");
const faceMatch = require("../models/facematch.model");
const loginAndSms = require("../../loginAndSms/model/loginAndSmsModel");

const convertImageToBase64 = async (url) => {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "Content-Type": "image/jpeg",
        Accept: "image/jpeg",
      },
    });
    return Buffer.from(response.data, "binary").toString("base64");
  } catch (error) {
    console.error("Error converting image to base64:", error);
    throw error;
  }
};

exports.facematchapi = async (req, res, next) => {
  try {
    const { userimage, aadharImage } = req.body;
    console.log(userimage , aadharImage )
    const authHeader = req.headers.authorization;

    const token = await checkingDetails(authHeader, next);

    const merchant = await loginAndSms.findOne({token : token})

    if(!merchant){
      let errorMessage = {
        message: "You are not Eligible for this Verification",
        statusCode: 500,
      };
      return next(errorMessage);
    }

    const faceMatchingResponse = await axios.post(
      "https://live.zoop.one/api/v1/in/ml/face/match",
      {
        mode: "sync",
        data: {
          card_image: aadharImage,
          user_image: userimage,
          consent: "Y",
          consent_text: "I consent to this information being shared with zoop.one",
        },
      },
      {
        headers: {
          "app-id": process.env.ZOOP_APP_ID,
          "api-key": process.env.ZOOP_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const responseObject = faceMatchingResponse.data;
    console.log("FaceMatch Response: ===>", responseObject);

    if (responseObject.success) {
      const exsist = await  faceMatch.findOne({adhaarimage : aadharImage ,userimage :userimage  })
      console.log("======>>>>" , exsist)
      if(!exsist){
      await faceMatch.create({
          adhaarimage : aadharImage,
          userimage : userimage,
          response : responseObject,
          MerchantId : merchant.merchantId,
          createdDate:new Date().toLocaleDateString(),
          createdTime:new Date().toLocaleTimeString()
        })
      }
      return res.status(200).json({ message: responseObject?.response_message, success: true, result: responseObject.result });
    }

    let errorMessage = {
      message: "No Match Found",
      statusCode: 500,
    };
    return next(errorMessage);
  } catch (error) {
    console.error("Error performing facematch verification:", error);
    let errorMessage = {
      message: "Failed to perform facematch verification",
      statusCode: 500,
    };
    return next(errorMessage);
  }
};



