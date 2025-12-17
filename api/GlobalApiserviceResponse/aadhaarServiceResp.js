const { generateTransactionId, callTruthScreenAPI } = require("../truthScreen/callTruthScreen");
const axios = require("axios");

const AadhaarActiveServiceResponse = async (data, services, index = 0) => {
    if (index >= services.length) {
        return { success: false, message: "All services failed" };
    }

    const newService = services.find((ser) => ser.priority === index + 1);

    if (!newService) {
        console.log(`No service with priority ${index + 1}, trying next`);
        return AadhaarActiveServiceResponse(data, services, index + 1);
    }

    const serviceName = newService.providerId || "";
    console.log(`Trying service:`, newService);

    try {
        const res = await AadhaarApiCall(data, serviceName);
        console.log('Aadhaar Active Service response ', data, res)
        if (res.code === 200) {
            return res;
        }
        console.log(`${serviceName} responded failure → trying next`);
        return AadhaarActiveServiceResponse(data, services, index + 1);

    } catch (err) {
        console.log(`Error from ${serviceName}:`, err.message);
        return AadhaarActiveServiceResponse(data, services, index + 1);
    }
};

// =======================================
//         Aadhaar API CALL (ALL SERVICES)
// =======================================

const AadhaarApiCall = async (data, service) => {
    const tskId = await generateTransactionId(12);
    const ApiData = {
        INVINCIBLE: {
            BodyData: data,
            url: process.env.INVINCIBLE_MASKAADHAAR_URL,
            header: {
                "Content-Type": "application/json",
                clientId: process.env.INVINCIBLE_CLIENT_ID,
                secretKey: process.env.INVINCIBLE_SECRET_KEY,
            }
        },
    };

    // Empty provider fallback
    if (!service?.trim()) {
        service = Object.keys(ApiData)[0];
        console.log("Empty provider → defaulting to:", service);
    }

    const config = ApiData[service];
    if (!config) throw new Error(`Invalid service: ${service}`);

    let ApiResponse;

    try {
        ApiResponse = await axios.post(
            config.url,
            config.BodyData,
            { headers: config.header }
        );
    } catch (error) {
        console.log("API Error:", error);
        return { success: false };
    }

    const obj = ApiResponse?.data;
    console.log(`Response—${service}:`, obj);
    return obj;
};


module.exports = {
    AadhaarActiveServiceResponse,
};

