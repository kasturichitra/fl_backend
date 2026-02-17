const { default: axios } = require("axios");


async function selectService(servicecategory, serviceName) {
    try{
        const FinalService = await axios.get(`${process.env.SUPERADMIN_URL}/api/v1/apimodule/getAllProvidersByService?serviceId=${serviceName}&categoryId=${servicecategory}`)
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
