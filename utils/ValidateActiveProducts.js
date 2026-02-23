const { default: axios } = require("axios");
const { createApiResponse } = require("./ApiResponseHandler");
const superAdminUrl = process.env.SUPERADMIN_URL;

const { commonLogger } = require("../api/Logger/logger");

const handleValidateActiveProducts = async (data) => {
    const { clientId, serviceId } = data;
    commonLogger.info(`Validating active products for client: ${clientId}, service: ${serviceId}`);
    try {
        // const res = await axios.post(`${superAdminUrl}/api/v1/apimodule/isClient/subscribe-service`,{clientId, serviceId});
        // if(res.data?.success){
        //     return {isSubscribe:true,message:'service is subScribe'}
        // }else{
        //     return {isSubscribe:false,message:'Service is not subScribe'}
        // }
    } catch (err) {
        commonLogger.error(`Error validating active products for client ${clientId}: ${err.message}`);
        return { isSubscribe: false, message: err.message }
    }
}

module.exports = {
    handleValidateActiveProducts
}