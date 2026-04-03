const { businessServiceLogger } = require("../../Logger/logger");
const { generateTransactionId, callTruthScreenAPI } = require("../../truthScreen/callTruthScreen");
const axios = require("axios");

const UamActiveServiceResponse = async (data, services = [], ActiveSerice, index = 0, TxnID = "") => {
    if (index >= services?.length) {
        return { success: false, message: "All services failed" };
    }

    const newService = services?.find((ser) => ser.priority === index + 1);
    console.log("[UamActiveServiceResponse] incoming data ===>>", JSON.stringify(data))
    businessServiceLogger.info("[UamActiveServiceResponse] incoming data ===>>", JSON.stringify(data))

    if (!newService) {
        console.log(`No service with priority ${index + 1}, trying next`);
        return UamActiveServiceResponse(data, services, ActiveSerice, index + 1, TxnID);
    }

    const serviceName = newService.providerId || "";
    console.log(`[UamActiveServiceResponse] Trying service with priority ${index + 1}:`, newService);
    businessServiceLogger.info(`[UamActiveServiceResponse] Trying service with priority ${index + 1}:`, newService);

    try {
        // const res = await UamApiCall(data, serviceName);

        let res;
        switch (ActiveSerice) {
            case "UamApiCall":
                res = await UamApiCall(data, serviceName, TxnID);
                break;
            case "UamwithPhoneApiCall":
                res = await UamwithPhoneApiCall(data, serviceName, TxnID);
                break;
        }

        if (res?.success) {
            return res.data;
        }

        console.log(`[UamActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`);
        return UamActiveServiceResponse(data, services, ActiveSerice, index + 1, TxnID);

    } catch (err) {
        console.log(`[UamActiveServiceResponse] Error from ${serviceName}:`, err.message);
        return UamActiveServiceResponse(data, services, ActiveSerice, index + 1, TxnID);
    }
};

// =======================================
//         TIN API CALL (ALL SERVICES)
// =======================================

const UamApiCall = async (data, service, TxnID = "") => {
    const tskId = TxnID || await generateTransactionId(12);
    const ApiData = {
        TRUTHSCREEN: {
            BodyData: {
                transID: tskId,
                docType: 25,
                docNumber: data,
            },
            url: process.env.TRUTNSCREEN_UAMADDHAARVERIFICATION_URL, // UAM URL is similar to the Tin
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
                logger: businessServiceLogger
            });
            console.log('[UamApiCall] TruthScreen API response:', JSON.stringify(ApiResponse));

        } else {
            ApiResponse = await axios.post(
                config.url,
                config.BodyData,
                { headers: config.header }
            );
        }
        console.log(`[UamApiCall] ${service} API response:`, JSON.stringify(ApiResponse?.data || ApiResponse));
    } catch (error) {
        console.log(`[UamApiCall] API Error in ${service}:`, error.message);
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

const UamwithPhoneApiCall = async (data, service, TxnID = "") => {
    const tskId = TxnID || await generateTransactionId(12);
    const ApiData = {
        TRUTHSCREEN: {
            BodyData: {
                transID: tskId,
                docType: 193,
                docNumber: data?.UAMNumber,
                mobileno:data?.customerNumber
            },
            url: process.env.TRUTHSCREEN_API_URL, // UAM with phone URL is similar to the Tin
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
                logger: businessServiceLogger
            });
            console.log('[UamApiCall] TruthScreen API response:', JSON.stringify(ApiResponse));

        } else {
            ApiResponse = await axios.post(
                config.url,
                config.BodyData,
                { headers: config.header }
            );
        }
        console.log(`[UamApiCall] ${service} API response:`, JSON.stringify(ApiResponse?.data || ApiResponse));
    } catch (error) {
        console.log(`[UamApiCall] API Error in ${service}:`, error.message);
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
    UamActiveServiceResponse,
};
