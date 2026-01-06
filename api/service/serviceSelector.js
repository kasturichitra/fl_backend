const { default: axios } = require("axios");


async function selectService(serviceName) {
    try{
        const FinalService = await axios.get(`${process.env.SUPPERADMIN_URL}/api/v1/apimodule/getAllProvidersByService?serviceId=${serviceName}`)
    console.log("Final selected service =>", FinalService?.data);
    const { success, statusCode, data } = FinalService?.data;
    if (success) {
        console.log("Final selected service =>", data);
        return data ;
    };
    }catch(error){
        console.log('SelectService Error:',error);
    }
}


module.exports = { selectService };
