const { professionalLogger } = require("../../Logger/logger");
const { generateTransactionId, callTruthScreenAPI } = require("../../truthScreen/callTruthScreen");
const axios = require("axios");

const professionalActiveServiceResponse = async (data, services = [], ActiveSerice, index = 0) => {
    if (index >= services?.length) {
        return { success: false, message: "All services failed" };
    }

    const newService = services?.find((ser) => ser.priority === index + 1);
    console.log("[professionalActiveServiceResponse] incoming data ===>>", JSON.stringify(data))
    professionalLogger.info("[professionalActiveServiceResponse] incoming data ===>>", JSON.stringify(data))

    if (!newService) {
        console.log(`No service with priority ${index + 1}, trying next`);
        return professionalActiveServiceResponse(data, services, index + 1);
    }

    const serviceName = newService.providerId || "";
    console.log(`[professionalActiveServiceResponse] Trying service with priority ${index + 1}:`, newService);
    professionalLogger.info(`[professionalActiveServiceResponse] Trying service with priority ${index + 1}:`, newService);

    try {
        let res;
        switch (ActiveSerice) {
            case "InsuranceApiCall":
                res = await InsuranceApiCall(data, serviceName);
                break;
            case "CAApiCall":
                res = await CAApiCall(data, serviceName);
                break;
            case "DocterApicall":
                res = await DocterApicall(data, serviceName);
                break;
            case "DentistApicall":
                res = await DentistApicall(data, serviceName);
                break;
        }

        if (res?.success) {
            return res.data;
        }

        console.log(`[professionalActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`);
        return professionalActiveServiceResponse(data, docNumber,docNumberservices,ActiveSerice, index + 1);

    } catch (err) {
        console.log(`[professionalActiveServiceResponse] Error from ${serviceName}:`, err.message);
        return professionalActiveServiceResponse(data, services,ActiveSerice, index + 1);
    }
};

// =======================================
//         TIN API CALL (ALL SERVICES)
// =======================================

const InsuranceApiCall = async (data, service) => {
    const tskId = await generateTransactionId(12);
    const ApiData = {
        TRUTHSCREEN: {
            BodyData: {
                transID: tskId,
                docType: 32,
                docNumber: data,
            },
            url: process.env.TRUTHSCREEN_PROFESSIONALSEARCH_URL,
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
            console.log('[InsuranceApiCall] TruthScreen API response:', JSON.stringify(ApiResponse));

        } else {
            ApiResponse = await axios.post(
                config.url,
                config.BodyData,
                { headers: config.header }
            );
        }
        console.log(`[InsuranceApiCall] ${service} API response:`, JSON.stringify(ApiResponse?.data || ApiResponse));
    } catch (error) {
        console.log(`[InsuranceApiCall] API Error in ${service}:`, error.message);
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
const CAApiCall = async (data, service) => {
    const tskId = await generateTransactionId(12);
    const ApiData = {
        TRUTHSCREEN: {
            BodyData: {
                transID: tskId,
                docType: 33,
                docNumber: data,
            },
            url: process.env.TRUTHSCREEN_PROFESSIONALSEARCH_URL,
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
            console.log('[InsuranceApiCall] TruthScreen API response:', JSON.stringify(ApiResponse));

        } else {
            ApiResponse = await axios.post(
                config.url,
                config.BodyData,
                { headers: config.header }
            );
        }
        console.log(`[InsuranceApiCall] ${service} API response:`, JSON.stringify(ApiResponse?.data || ApiResponse));
    } catch (error) {
        console.log(`[InsuranceApiCall] API Error in ${service}:`, error.message);
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
const DocterApicall = async (data, service) => {
    const tskId = await generateTransactionId(12);
    const ApiData = {
        TRUTHSCREEN: {
            BodyData: {
                transID: tskId,
                docType: 34,
                state: data?.state,
                docNumber: data?.Registration ,
            },
            url: process.env.TRUTHSCREEN_PROFESSIONALSEARCH_URL,
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
            console.log('[InsuranceApiCall] TruthScreen API response:', JSON.stringify(ApiResponse));

        } else {
            ApiResponse = await axios.post(
                config.url,
                config.BodyData,
                { headers: config.header }
            );
        }
        console.log(`[InsuranceApiCall] ${service} API response:`, JSON.stringify(ApiResponse?.data || ApiResponse));
    } catch (error) {
        console.log(`[InsuranceApiCall] API Error in ${service}:`, error.message);
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
const DentistApicall = async (data, service) => {
    const tskId = await generateTransactionId(12);
    const ApiData = {
        TRUTHSCREEN: {
            BodyData: {
                transID: tskId,
                docType: 37,
                state: data?.state,
                docNumber: data?.Registration ,
            },
            url: process.env.TRUTHSCREEN_PROFESSIONALSEARCH_URL,
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
            console.log('[InsuranceApiCall] TruthScreen API response:', JSON.stringify(ApiResponse));

        } else {
            ApiResponse = await axios.post(
                config.url,
                config.BodyData,
                { headers: config.header }
            );
        }
        console.log(`[InsuranceApiCall] ${service} API response:`, JSON.stringify(ApiResponse?.data || ApiResponse));
    } catch (error) {
        console.log(`[InsuranceApiCall] API Error in ${service}:`, error.message);
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
    professionalActiveServiceResponse,
};
