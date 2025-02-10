const registeration = require("../api/registeration/model/registerationModel")

const kycCheck = async (req,res, next)=>{
    const merchantId = req.merchantId 
    console.log("====>>>>merchantId", merchantId)

    const merchant = await registeration.findOne({merchantId : merchantId})

    try{
        const kyc = merchant?.kycCompleted;

        console.log("====>>>>>kyc" , kyc)

        if (!kyc) {
            let errorMessage = {
                message: "Your Kyc is not completed, Make Sure to complete it before proceeding 😊",
                statusCode: 400,
              };
              return next(errorMessage);
        }else{
            next()
        }


    }catch(error){
        next(error)
    }
}

module.exports = kycCheck;