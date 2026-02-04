const { generateTransactionId, callTruthScreenAPI } = require("../truthScreen/callTruthScreen");
const axios = require("axios");

const AadhaarActiveServiceResponse = async (data, services, index = 0) => {
    if (index >= services?.length) {
        return { success: false, message: "All services failed" };
    }

    const newService = services?.find((ser) => ser.priority === index + 1);

    if (!newService) {
        console.log(`No service with priority ${index + 1}, trying next`);
        return AadhaarActiveServiceResponse(data, services, index + 1);
    }

    const serviceName = newService.providerId || "";
    console.log(`[AadhaarActiveServiceResponse] Trying service with priority ${index + 1}:`, newService);

    try {
        const res = await AadhaarApiCall(data, serviceName);
        console.log('[AadhaarActiveServiceResponse] Response:', JSON.stringify(res));
        if (res.code === 200) {
            return res;
        }
        console.log(`[AadhaarActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`);
        return AadhaarActiveServiceResponse(data, services, index + 1);

    } catch (err) {
        console.log(`[AadhaarActiveServiceResponse] Error from ${serviceName}:`, err.message);
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
        console.log(`[AadhaarApiCall] API Error in ${service}:`, error.message);
        return { success: false };
    }

    const obj = ApiResponse?.data;
    console.log(`[AadhaarApiCall] ${service} Response Object:`, JSON.stringify(obj));
    return obj;
};


module.exports = {
    AadhaarActiveServiceResponse,
};

