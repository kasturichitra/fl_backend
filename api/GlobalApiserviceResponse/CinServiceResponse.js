
const { generateTransactionId, callTruthScreenAPI } = require("../truthScreen/callTruthScreen");
const axios = require("axios");

const CinActiveServiceResponse = async (data, services, index = 0) => {
    if (index >= services?.length) {
        return { success: false, message: "All services failed" };
    }

    const newService = services?.find((ser) => ser.priority === index + 1);

    if (!newService) {
        console.log(`No service with priority ${index + 1}, trying next`);
        return CinActiveServiceResponse(data, services, index + 1);
    }

    const serviceName = newService.providerId || "";
    console.log(`[CinActiveServiceResponse] Trying service with priority ${index + 1}:`, newService);

    try {
        const res = await CinApiCall(data, serviceName);

        if (res?.success) {
            return res.data;
        }

        console.log(`[CinActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`);
        return CinActiveServiceResponse(data, services, index + 1);

    } catch (err) {
        console.log(`[CinActiveServiceResponse] Error from ${serviceName}:`, err.message);
        return CinActiveServiceResponse(data, services, index + 1);
    }
};

const CinApiCall = async (data, service) => {
    console.log('[CinApiCall] Triggered with data:', data);
    const tskId = generateTransactionId(12);

    const ApiData = {
        "INVINCIBLE": {
            BodyData: { CIN: data },
            url: process.env.INVINCIBLE_CIN_URL,
            header: {
                accept: "application/json",
                clientId: process.env.INVINCIBLE_CLIENT_ID,
                secretKey: process.env.INVINCIBLE_SECRET_KEY,
            }
        },
        "TRUTHSCREEN": {
            BodyData: {
                transID: tskId,
                docType: 15,     // CIN docType
                docNumber: data
            },
            url: process.env.TRUTNSCREEN_CIN_URL,
            header: {
                username: process.env.TRUTHSCREEN_USERNAME,
                password: process.env.TRUTHSCREEN_TOKEN
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
        if (service === "TRUTHSCREEN") {
            ApiResponse = await callTruthScreenAPI({
                url: config.url,
                payload: config.BodyData,
                username: config.header.username,
                password: config.header.password
            });
        } else {
            ApiResponse = await axios.post(
                config.url,
                config.BodyData,
                { headers: config.header }
            );
        }

    } catch (error) {
        console.log(`[CinApiCall] API Error in ${service}:`, error.message);
        return { success: false, data: null };
    }

    const obj = ApiResponse?.data || ApiResponse;
    console.log(`[CinApiCall] ${service} Response Object:`, JSON.stringify(obj));


    // If truthscreen/others return invalid code
    if (obj?.response_code === "101") {
        return {
            success: false,
            data: {
                result: "NoDataFound",
                message: "Invalid",
                responseOfService: obj,
                service,
            }
        };
    }

    /** -------------------------
     *  RESULT NORMALIZATION
     * ------------------------- */

    let returnedObj = {};

    switch (service) {

        case "INVINCIBLE":
            returnedObj = {
                CIN: obj?.result?.data?.CIN || "",
                CompanyName: obj?.result?.data?.COMPANY_NAME || "",
                status: obj?.result?.data?.COMPANY_STATUS || "",
            };
            break;

        case "TRUTHSCREEN":
            returnedObj = {
                CIN: obj?.result?.companyCIN || "",
                CompanyName: obj?.result?.companyName || "",
                status: obj?.result?.companyStatus || "",
            };
            break;
    }

    console.log('[CinApiCall] Returned Object:', JSON.stringify(returnedObj));
    return {
        success: true,
        data: {
            cinNumber: returnedObj.CIN || "",
            result: returnedObj,
            message: "Valid",
            responseOfService: obj,
            service,
        }
    };
};

module.exports = {
    CinActiveServiceResponse
};
