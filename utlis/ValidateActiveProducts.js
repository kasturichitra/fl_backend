const { createApiResponse } = require("./ApiResponseHandler");

const handleValidateActiveProducts = async()=>{
    try{
        const res = await axios.post(`${SUPERADMIN_URL}/isClient/subscribe-service`,{clientId, serviceId});
        if(res.data?.success){
            return {status:true,message:'service is subScribe'}
        }else{
            return {status:false,message:'Service is not subScribe'}
        }
    }catch(err){
        console.log('ErrorWhile Validateing Active Products', err);
        return {status:false,message:err.message}
    }
}

module.exports={
    handleValidateActiveProducts
}