const { businessServiceLogger } = require("../../Logger/logger");
const { generateTransactionId, callTruthScreenAPI } = require("../../truthScreen/callTruthScreen");
const axios = require("axios");

const NameMatchActiveServiceResponse = async (data, services = [], index = 0) => {
    if (index >= services?.length) {
        return { success: false, message: "All services failed" };
    }

    const newService = services?.find((ser) => ser.priority === index + 1);
    console.log("[NameMatchActiveServiceResponse] incoming data ===>>", JSON.stringify(data))
    businessServiceLogger.info("[NameMatchActiveServiceResponse] incoming data ===>>", JSON.stringify(data))

    if (!newService) {
        console.log(`No service with priority ${index + 1}, trying next`);
        return NameMatchActiveServiceResponse(data, services, index + 1);
    }

    const serviceName = newService.providerId || "";
    console.log(`[NameMatchActiveServiceResponse] Trying service with priority ${index + 1}:`, newService);
    businessServiceLogger.info(`[NameMatchActiveServiceResponse] Trying service with priority ${index + 1}:`, newService);

    try {
        const res = await NameMatchApiCall(data, serviceName);

        if (res?.data) {
            return res.data;
        }

        console.log(`[NameMatchActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`);
        return NameMatchActiveServiceResponse(data, services, index + 1);

    } catch (err) {
        console.log(`[NameMatchActiveServiceResponse] Error from ${serviceName}:`, err.message);
        return NameMatchActiveServiceResponse(data, services, index + 1);
    }
};

// =======================================
//         TIN API CALL (ALL SERVICES)
// =======================================

const NameMatchApiCall = async (data, service) => {
    const tskId = await generateTransactionId(12);
    const ApiData = {
        TRUTHSCREEN: {
            BodyData: {
                transID: tskId,
                docType: 409,
                name_first: data?.firstName,
                name_second: data?.secondName,
                strtype: "name"
            },
            url: process.env.TRUTNSCREEN_BUSINESSVERIFICATION_URL, // NAME search is similar to the Tin
            header: {
                username: process.env.TRUTHSCREEN_USERNAME,
                token: process.env.TRUTHSCREEN_TOKEN,
            }
        }
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
        if (service === "TRUTHSCREEN") {
            ApiResponse = await callTruthScreenAPI({
                url: config.url,
                payload: config.BodyData,
                username: config.header.username,
                password: config.header.token,
            });
            console.log('[NameMatchApiCall] TruthScreen API response:', JSON.stringify(ApiResponse));

        } else {
            ApiResponse = await axios.post(
                config.url,
                config.BodyData,
                { headers: config.header }
            );
        }
        console.log(`[NameMatchApiCall] ${service} API response:`, JSON.stringify(ApiResponse?.data || ApiResponse));
    } catch (error) {
        console.log(`[NameMatchApiCall] API Error in ${service}:`, error.message);
        return { success: false };
    }

    const obj = ApiResponse?.data || ApiResponse;
    console.log(`Response—${service}:`, obj);


    // =======================================
    //      UNIFIED RESULT NORMALIZATION
    // =======================================

    let returnedObj = {};

    // ------------------------
    // TRUTHSCREEN RESPONSE
    // ------------------------
    if (service === "TRUTHSCREEN") {
        const msg = obj?.msg;

        if (!msg || msg?.STATUS === "INVALID") {
            return invalidResponse(service, msg);
        }

        returnedObj = msg

        return {
            success: true,
            data: {
                result: returnedObj,
                message: "Valid",
                responseOfService: msg,
                service: service,
            }
        };
    }


    // ===========================
    // DEFAULT VALID RETURN
    // ===========================
    return {
        success: true,
        data: {
            result: returnedObj,
            message: "Valid",
            responseOfService: obj?.result,
            service,
        }
    };
};

// =======================================
// INVALID RESPONSE HANDLER (REUSABLE)
// =======================================

const invalidResponse = (service, raw) => ({
    success: false,
    data: {
        result: "NoDataFound",
        message: "Invalid",
        responseOfService: raw || {},
        service,
    }
});



module.exports = {
    NameMatchActiveServiceResponse,
};
