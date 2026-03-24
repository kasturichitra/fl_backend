const { businessServiceLogger } = require("../../Logger/logger");
const { generateTransactionId, callTruthScreenAPI } = require("../../truthScreen/callTruthScreen");
const axios = require("axios");

const GstTaxpayerActiveServiceResponse = async (data, services=[], index = 0) => {
    if (index >= services?.length) {
        return { success: false, message: "All services failed" };
    }

    const newService = services?.find((ser) => ser.priority === index + 1);
    console.log("[GstTaxpayerActiveServiceResponse] incoming data ===>>", JSON.stringify(data))
    businessServiceLogger.info("[GstTaxpayerActiveServiceResponse] incoming data ===>>", JSON.stringify(data))

    if (!newService) {
        console.log(`No service with priority ${index + 1}, trying next`);
        return GstTaxpayerActiveServiceResponse(data, services, index + 1);
    }

    const serviceName = newService.providerId || "";
    console.log(`[GstTaxpayerActiveServiceResponse] Trying service with priority ${index + 1}:`, newService);
    businessServiceLogger.info(`[GstTaxpayerActiveServiceResponse] Trying service with priority ${index + 1}:`, newService);

    try {
        const res = await GstInTaxPayerApiCall(data, serviceName);

        if (res?.success) {
            return res.data;
        }

        console.log(`[GstTaxpayerActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`);
        return GstTaxpayerActiveServiceResponse(data, services, index + 1);

    } catch (err) {
        console.log(`[GstTaxpayerActiveServiceResponse] Error from ${serviceName}:`, err.message);
        return GstTaxpayerActiveServiceResponse(data, services, index + 1);
    }
};

// =======================================
//         PAN API CALL (ALL SERVICES)
// =======================================

const GstInTaxPayerApiCall = async (data, service) => {
    const tskId = await generateTransactionId(12);
    const ApiData = {
        TRUTHSCREEN: {
            BodyData: {
                transID: tskId,
                docType: 115,
                docNumber: data,
            },
            url: process.env.TRUTNSCREEN_BUSINESSVERIFICATION_URL, // DIN URL is similar to the Pan
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
            console.log('[GstInTaxPayerApiCall] TruthScreen API response:', JSON.stringify(ApiResponse));

        } else {
            ApiResponse = await axios.post(
                config.url,
                config.BodyData,
                { headers: config.header }
            );
        }
        console.log(`[GstInTaxPayerApiCall] ${service} API response:`, JSON.stringify(ApiResponse?.data || ApiResponse));
    } catch (error) {
        console.log(`[GstInTaxPayerApiCall] API Error in ${service}:`, error.message);
        return { success: false };
    }

    const obj = ApiResponse?.data || ApiResponse;
    console.log(`Response—${service}:`, obj);


    // =======================================
    //      UNIFIED RESULT NORMALIZATION
    // =======================================

    let returnedObj = {};

    // ------------------------
    // ZOOP RESPONSE
    // ------------------------
    if (service === "ZOOP") {
        if (obj?.response_code === "101" || !obj?.success) {
            return invalidResponse(service, obj?.result);
        }

        returnedObj = {
            PAN: obj?.result?.pan_number || null,
            Name: obj?.result?.user_full_name || null,
            PAN_Status: obj?.result?.pan_status || null,
            PAN_Holder_Type: obj?.result?.pan_type || null,
        };
    }

    // ------------------------
    // INVINCIBLE RESPONSE
    // ------------------------
    if (service === "INVINCIBLE") {
        if (!obj?.success) return invalidResponse(service, obj?.result);

        returnedObj = {
            PAN: obj?.result?.pan_number || null,
            Name: obj?.result?.user_full_name || null,
            PAN_Status: obj?.result?.pan_status || null,
            PAN_Holder_Type: obj?.result?.pan_type || null,
        };
    }

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
                service:service,
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
    GstTaxpayerActiveServiceResponse,
};
