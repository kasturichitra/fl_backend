const { generateTransactionId, callTruthScreenAPI } = require("../truthScreen/callTruthScreen");
const axios = require("axios");

const PanActiveServiceResponse = async (data, services, index = 0) => {
    if (index >= services?.length) {
        return { success: false, message: "All services failed" };
    }

    const newService = services?.find((ser) => ser.priority === index + 1);

    if (!newService) {
        console.log(`No service with priority ${index + 1}, trying next`);
        return PanActiveServiceResponse(data, services, index + 1);
    }

    const serviceName = newService.providerId || "";
    console.log(`Trying service:`, newService);

    try {
        const res = await PanApiCall(data, serviceName);

        if (res?.success) {
            return res.data;
        }

        console.log(`${serviceName} responded failure → trying next`);
        return PanActiveServiceResponse(data, services, index + 1);

    } catch (err) {
        console.log(`Error from ${serviceName}:`, err.message);
        return PanActiveServiceResponse(data, services, index + 1);
    }
};

// =======================================
//         PAN API CALL (ALL SERVICES)
// =======================================

const PanApiCall = async (data, service) => {
    const tskId = await generateTransactionId(12);
    const ApiData = {
        ZOOP: {
            BodyData: {
                mode: "sync",
                data: {
                    customer_pan_number: JSON.stringify({
                        pan_number: data
                    }),
                    consent: "Y",
                    consent_text: "I consent to this information being shared with zoop.one",
                },
                task_id: tskId
            },
            url: process.env.ZOOP_PANVERFICATON_URL,
            header: {
                "app-id": process.env.ZOOP_APP_ID,
                "api-key": process.env.ZOOP_API_KEY,
                "Content-Type": "application/json",
            }
        },
        INVINCIBLE: {
            BodyData: data,
            url: process.env.INVINCIBLE_PANVERIFICATION_URL,
            header: {
                clientId: process.env.INVINCIBLE_CLIENT_ID,
                secretKey: process.env.INVINCIBLE_SECRET_KEY,
            }
        },
        TRUTHSCREEN: {
            BodyData: {
                transID: tskId,
                docType: 2,
                docNumber: data,
            },
            url: process.env.TRUTNSCREEN_PANVERIFICATION_URL,
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
        } else {
            ApiResponse = await axios.post(
                config.url,
                config.BodyData,
                { headers: config.header }
            );
        }

    } catch (error) {
        console.log("API Error:", error);
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

        returnedObj = {
            PAN: msg?.PanNumber || null,
            Name: msg?.Name || null,
            PAN_Status: msg?.STATUS || null,
            PAN_Holder_Type: msg?.panHolderStatusType || null,
        };

        return {
            success: true,
            data: {
                result: returnedObj,
                message: "Valid",
                responseOfService: msg,
                service,
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
    PanActiveServiceResponse,
};




























