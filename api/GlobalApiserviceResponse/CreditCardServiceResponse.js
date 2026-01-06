const { generateTransactionId, callTruthScreenAPI } = require("../truthScreen/callTruthScreen");
const axios = require("axios");
let RapidApiKey = process.env.RAPIDAPI_KEY
let RapidApiBinHost = process.env.RAPIDAPI_BIN_HOST
let RapidApiBankHost = process.env.RAPIDAPI_IFSC_HOST

const CreditCardActiveServiceResponse = async (data, services, index = 0) => {
    if (index >= services?.length) {
        return { success: false, message: "All services failed" };
    }

    const newService = services?.find((ser) => ser.priority === index + 1);

    if (!newService) {
        console.log(`No service with priority ${index + 1}, trying next`);
        return CreditCardActiveServiceResponse(data, services, index + 1);
    }

    const serviceName = newService.providerId || "";
    console.log(`Trying service:`, newService);

    try {
        const res = await CreditCardApiCall(data, serviceName);
        console.log('Credit Card Active service Response ===>', res);
        return res;
        console.log(`${serviceName} responded failure → trying next`);
        return CreditCardActiveServiceResponse(data, services, index + 1);

    } catch (err) {
        console.log(`Error from ${serviceName}:`, err.message);
        return CreditCardActiveServiceResponse(data, services, index + 1);
    }
};

// =======================================
//         Credit Card API CALL (ALL SERVICES)
// =======================================

const CreditCardApiCall = async (data, service) => {
    console.log('data',data)
    const ApiData = {
        RAPID: {
            BodyData: data,
            url: `https://cardverify.p.rapidapi.com/validate/${data}`,
            header: {
                'x-rapidapi-key': RapidApiKey,
                "x-rapidapi-host": "cardverify.p.rapidapi.com",
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
        ApiResponse = await axios.get(
            config.url,
            { headers: config.header }
        );

    } catch (error) {
        return { success: false };
    }

    const obj = ApiResponse?.data;
    console.log(`Response—${service}:`, obj);

    return obj
};


module.exports = {
    CreditCardActiveServiceResponse,
};




























