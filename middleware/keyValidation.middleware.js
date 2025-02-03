const checkKeys = (req,res,next)=>{
    const client = req.headers["client_id"];
    const secret = req.headers["secret_key"];
    const MerchantId = req.MerchantId

    console.log("=====>>>>Merchant id and client and secret" , MerchantId, client, secret)

    if (!client || !secret) {
        let errorMessage = {
          message: "Access denied. Client or Secret not provided.",
          statusCode: 400,
        };
        return next(errorMessage);
      }

    console.log("=====>>>>>" , client , secret);

    try{

    }catch(error){
        console.log("=====>>>>>error in key validation" , error);
    }

}