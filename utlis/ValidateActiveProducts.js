const { default: axios } = require("axios");
const { createApiResponse } = require("./ApiResponseHandler");
const superAdminUrl = process.env.SUPERADMIN_URL;

const handleValidateActiveProducts = async(data)=>{
    const {clientId, serviceId} = data;
    console.log('Handle Validate Active Products', clientId, serviceId)
    try{
        // const res = await axios.post(`${superAdminUrl}/api/v1/apimodule/isClient/subscribe-service`,{clientId, serviceId});
        // if(res.data?.success){
        //     return {isSubscribe:true,message:'service is subScribe'}
        // }else{
        //     return {isSubscribe:false,message:'Service is not subScribe'}
        // }
    }catch(err){
        console.log('ErrorWhile Validateing Active Products', err);
        return {isSubscribe:false,message:err.message}
    }
}

module.exports={
    handleValidateActiveProducts
}