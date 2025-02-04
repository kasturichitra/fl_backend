const testingKeysModel = require("../api/testing_api_keys/models/testing.model")

const checkKeys = async(req,res,next)=>{
    const client = req.headers["client_id"];
    const secret = req.headers["secret_key"];
    const MerchantId = req.merchantId;

    console.log("=====>>>>Merchant id and client and secret" , MerchantId, client, secret)

    if (!client || !secret) {
        let errorMessage = {
          message: "Access denied. Client or Secret not provided.",
          statusCode: 400,
        };
        return next(errorMessage);
      }


    
    try{
      const existingKeys = await testingKeysModel.find({client_id : client, secret_key : secret, MerchantId: MerchantId});

      if(existingKeys?.length == 1){
        console.log(existingKeys?.length)
        next()
      }else{
        let errorMessage = {
          message: "You Provided Wrong Keys",
          statusCode: 404,
        };
        return next(errorMessage);
      }

    }catch(error){
        console.log("=====>>>>>error in key validation" , error);
        let errorMessage = {
          message: "Some thing went wrong Try Again after some time",
          statusCode: 500,
        };
        return next(errorMessage);
    }

}


module.exports = checkKeys;