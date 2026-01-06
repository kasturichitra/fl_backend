
const { generateTransactionId, callTruthScreenAPI } = require("../truthScreen/callTruthScreen");
const axios = require("axios");
const {
  DOVE_SOFT_USER,
  DOVE_SOFT_KEY,
  DOVE_SOFT_API_URL,
  DOVE_SOFT_ENTITYID,
  DOVE_SOFT_TEMPID,
  DOVE_SOFT_SENDERID,
} = process.env;

const smsOtpActiveServiceResponse = async (data, services, index = 0) => {
    if (index >= services?.length) {
        return { success: false, message: "All services failed" };
    }

    const newService = services?.find((ser) => ser.priority === index + 1);

    if (!newService) {
        console.log(`No service with priority ${index + 1}, trying next`);
        return smsOtpActiveServiceResponse(data, services, index + 1);
    }

    const serviceName = newService.providerId || "";
    console.log(`Trying service:`, newService);

    try {
        const res = await smsApiCall(data, serviceName);

        if (res?.success) {
            return res.data;
        }

        console.log(`${serviceName} responded failure → trying next`);
        return smsOtpActiveServiceResponse(data, services, index + 1);

    } catch (err) {
        console.log(`Error from ${serviceName}:`, err.message);
        return smsOtpActiveServiceResponse(data, services, index + 1);
    }
};

const smsApiCall = async (data, service) => {
    const tskId = await generateTransactionId(12);
    const {mobileNumber,message} = data
    const ApiData = {
        DOVESOFT: {
            url: `${DOVE_SOFT_API_URL}&user=${DOVE_SOFT_USER}&key=${DOVE_SOFT_KEY}&mobile=+91${mobileNumber}&message=${message}&senderid=${DOVE_SOFT_SENDERID}&accusage=1&entityid=${DOVE_SOFT_ENTITYID}&tempid=${DOVE_SOFT_TEMPID}`,
            header: {
                accept: "application/json",
                clientId: process.env.INVINCIBLE_CLIENT_ID,
                secretKey: process.env.INVINCIBLE_SECRET_KEY,
            }
        }
    };


    if (!service?.trim()) {
        service = Object.keys(ApiData)[0];
        console.log("Empty provider → defaulting to:", service);
    }

    const config = ApiData[service];
    if (!config) throw new Error(`Invalid service: ${service}`);

    let ApiResponse;

    try {
        ApiResponse = await axios.get(
            config.url
        );
        console.log('Sms Apicall is trigred ===>', ApiResponse)
    } catch (error) {
        console.log("Error =>", error);
        return { success: false, data: null };
    }
    const obj = ApiResponse?.data ;

    return {
        success: true,
        data: obj
    };
};

module.exports = {
    smsOtpActiveServiceResponse
};
