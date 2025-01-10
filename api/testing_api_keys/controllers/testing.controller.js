const checkingDetails = require("../../../utlis/authorization");
const loginAndSms = require("../../loginAndSms/model/loginAndSmsModel");

function generatingApiKey(service){
    const hashcode = Math.floor(100000 + Math.random() * 900000).toString();
    const firstWord = service.subSting(0,2)
    const currentDateTime = new Date();
    const timestamp = currentDateTime.getTime();
    const secondWord = timestamp.toString().slice(-8)

    const apiKey = `${firstWord}_${secondWord}_${hashcode}`

    return apiKey
}

function generationApiSalt(service){

}

const generateApiKeys = async(req,res,next)=>{
    const { service } = req.body

  const authHeader = req.headers.authorization;

  const check = await checkingDetails(authHeader , next)

  const merchant = await loginAndSms.findOne({token : check})

  if(!merchant){
    let errorMessage = {
        message: `You are not authorized for this ${service} key Generation`,
        statusCode: 400,
      };
      return next(errorMessage);
  }

}