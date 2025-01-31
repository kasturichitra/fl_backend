const testingModel = require("../models/testing.model");
const registerationModel = require("../../registeration/model/registerationModel");

function generatingApiKey(name) {
  const hashcode = Math.floor(100000000 + Math.random() * 900000000).toString();
  const currentDateTime = new Date();
  const timestamp = currentDateTime.getTime();
  const firstWord = timestamp.toString().split("").reverse().join("");
  const secondWord = timestamp.toString();
  const lastWord = name.substring(0, 2);

  const apiKey = `${firstWord}${secondWord}${hashcode}${lastWord}`;

  console.log("=====>>>>apiKey", apiKey);

  return apiKey;
}

function generationApiSalt(name) {
  const hashcode = Math.floor(100000000 + Math.random() * 900000000).toString();
  const currentDateTime = new Date();
  const timestamp = currentDateTime.getTime();
  const firstWord = timestamp.toString().split("").reverse().join("");
  const secondWord = timestamp.toString();
  const lastWord = name.substring(0, 2);

  const apiSaltKey = `${firstWord}${secondWord}${hashcode}${lastWord}`;

  console.log(apiSaltKey, "======>>>>apiSaltKey");

  return apiSaltKey;
}

const generateApiKeys = async (req, res, next) => {
  const MerchantId = req.merchantId;
  const check = req.token;

  const existingDetails = await registerationModel.findOne({
    merchantId: MerchantId,
  });
  const existingName = existingDetails?.name;

  try {
    console.log("try block");
    const testing_Api_key = generatingApiKey(existingName);
    const testing_Api_salt = generationApiSalt(existingName);

    console.log(
      "========>>>>testing key and test salt key",
      testing_Api_key,
      testing_Api_salt
    );

    const existingKeysForService = await testingModel.find({
      MerchantId: MerchantId,
    });

    const existingKeysForServiceLength = existingKeysForService?.length;
    console.log(
      "======>>>>existingKeysForServiceLength",
      existingKeysForServiceLength
    );

    if (existingKeysForServiceLength == 3) {
      let errorMessage = {
        message: "Your Key Limit Reached You can not Generate another one 😒!",
        statusCode: 400,
      };
      return next(errorMessage);
    } else {
      const testDetails = await testingModel.create({
        MerchantId,
        token: check,
        client_id: testing_Api_key,
        secret_key: testing_Api_salt,
        limit: 3,
      });
      console.log("======>testDetails", testDetails);
    }

    const testDetailsResponse = {
      client_id: testing_Api_key,
      secret_key: testing_Api_salt,
    };

    res
      .status(200)
      .json({ message: "Valid", success: true, response: testDetailsResponse });
  } catch (error) {
    console.log("catch block");
    let errorMessage = {
      message: "Something went wrong, try again after some time",
      statusCode: 400,
    };
    return next(errorMessage);
  }
};

const getAllApiKeys = async(req,res,next)=>{
    const { MerchantId }=req.params;
    console.log(MerchantId , "========>>>MerchantId")

    try{
      const existingKeys = await testingModel.find({MerchantId})
      console.log(existingKeys , "========>>>existingKeys")
      if(existingKeys?.length > 0){

        res.status(200).json({message:"Valid",success:true,response:existingKeys})
      }else{
        let errorMessage = {
          message: "No Keys Found",
          statusCode: 404,
        };
        return next(errorMessage);
      }

    }catch(error){
      let errorMessage = {
        message: "Something went wrong, try again after some time",
        statusCode: 400,
      };
      return next(errorMessage);
    }
}

const removeOneApi = async (req, res, next) => {
  const {id} = req.params;
  console.log(id, "========>>>id")
  try {
    const existingKey = await testingModel.findByIdAndDelete(id)
    console.log(existingKey, "========>>>existingKey")
    if (existingKey) {
      res.status(200).json({ message: "Valid", success: true, response: "Deleted Successfully" });
        } else {
          let errorMessage = {
            message: "No Key Found",
            statusCode: 404,
            };
            return next(errorMessage);
            }
            } catch (error) {
              let errorMessage = {
                message: "Something went wrong, try again after some time",
                statusCode: 400,
                };
                return next(errorMessage);
            
          }
     }
            


module.exports = {generateApiKeys, getAllApiKeys, removeOneApi};
