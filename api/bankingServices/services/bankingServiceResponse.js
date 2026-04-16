const { businessServiceLogger } = require("../../Logger/logger");
const { generateTransactionId, callTruthScreenAPI } = require("../../truthScreen/callTruthScreen");
const axios = require("axios");

const BankActiveServiceResponse = async (data, services = [], ActiveService, index = 0, TxnID) => {
    if (index >= services?.length) {
        return { success: false, message: "All services failed" };
    }

    const newService = services?.find((ser) => ser.priority === index + 1);
    businessServiceLogger.info(`TxnID:${TxnID}, [BankActiveServiceResponse] incoming data ===>> ${JSON.stringify(data)}`);

    if (!newService) {
        businessServiceLogger.info(`TxnID:${TxnID}, No service with priority ${index + 1}, trying next`);
        return BankActiveServiceResponse(data, services, ActiveService, index + 1, TxnID);
    }

    const serviceName = newService.providerId || "";
    businessServiceLogger.info(`TxnID:${TxnID}, [BankActiveServiceResponse] Trying service with priority ${index + 1}: ${JSON.stringify(newService)}`);

    try {
        let res;
        switch (ActiveService) {
            case 'AdvanceBankApiCall':
                res = await AdvanceBankApiCall(data, serviceName, TxnID);
                break;
            default:
                businessServiceLogger.warn(`TxnID:${TxnID}, Unknown ActiveService: ${ActiveService}`);
                break;
        }

        if (res?.data) {
            return res.data;
        }

        businessServiceLogger.info(`TxnID:${TxnID}, [BankActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`);
        return BankActiveServiceResponse(data, services, ActiveService, index + 1, TxnID);

    } catch (err) {
        businessServiceLogger.error(`TxnID:${TxnID}, [BankActiveServiceResponse] Error from ${serviceName}: ${err.message}`);
        return BankActiveServiceResponse(data, services, ActiveService, index + 1, TxnID);
    }
};

// =======================================
//         PAN API CALL (ALL SERVICES)
// =======================================

const AdvanceBankApiCall = async (data, service, TxnID) => {
    const tskId = TxnID || await generateTransactionId(12);
    const ApiData = {
        TRUTHSCREEN: {
            BodyData: {
                transID: tskId,
                docType: 430,
                ifscCode: data?.ifscCode,
                accountNumber: data?.accountNumber,
            },
            url: process.env.TRUTHSCREEN_ADVANCEBANKACCOUNT_URL,
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
                CID:"",
                logger:businessServiceLogger
                
            });
            console.log('[AdvanceBankApiCall] TruthScreen API response:', JSON.stringify(ApiResponse));

        } else {
            ApiResponse = await axios.post(
                config.url,
                config.BodyData,
                { headers: config.header }
            );
        }
        console.log(`[AdvanceBankApiCall] ${service} API response:`, JSON.stringify(ApiResponse?.data || ApiResponse));
    } catch (error) {
        console.log(`[AdvanceBankApiCall] API Error in ${service}:`, error.message);
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
    BankActiveServiceResponse,
};
