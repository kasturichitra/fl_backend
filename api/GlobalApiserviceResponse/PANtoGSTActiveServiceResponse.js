const { generateTransactionId } = require("../truthScreen/callTruthScreen")
const { default: axios } = require("axios");

const PANtoGSTActiveServiceResponse = async (data, services, index = 0) => {
    console.log('PANtoGSTActiveServiceResponse called');
    if (index >= services?.length) {
        return { success: false, message: "All services failed" };
    }

    const newService = services?.find((ser) => ser.priority === index + 1);

    if (!newService) {
        console.log(`No service with priority ${index + 1}, trying next`);
        return PANtoGSTActiveServiceResponse(data, services, index + 1);
    }

    const serviceName = newService.providerId || "";
    console.log(`[PANtoGSTActiveServiceResponse] Trying service with priority ${index + 1}:`, newService);

    try {
        const res = await GSTApiCall(data, serviceName, 0);

        if (res?.success) {
            return res.data;
        }

        console.log(`[PANtoGSTActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`);
        return PANtoGSTActiveServiceResponse(data, services, index + 1);

    } catch (err) {
        console.log(`[PANtoGSTActiveServiceResponse] Error from ${serviceName}:`, err.message);
        return PANtoGSTActiveServiceResponse(data, services, index + 1);
    }
};

const GSTApiCall = async (data, service) => {
    const tskId = await generateTransactionId(12);

    const ApiData = {
        "TRUTHSCREEN": {
            BodyData: {
                transID: tskId,
                "docType": "47",
                "docNumber": data
            },
            url: process.env.TRUTNSCREEN_GST_IN_TO_PAN_URL,
            header: {
                username: process.env.TRUTHSCREEN_USERNAME,
                token: process.env.TRUTHSCREEN_TOKEN,
            }
        }
    };

    // If service is empty → use first service entry
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
        console.log(`[GSTApiCall] API Error in ${service}:`, error.message);
        return { success: false, data: null }; // fallback trigger
    }

    const obj = ApiResponse.data;
    console.log(`[GSTApiCall] ${service} API Response Object:`, JSON.stringify(obj));

    let returnedObj = {};

    if (obj.response_code === "101") {
        return {
            success: false,
            data: {
                result: "NoDataFound",
                message: "Invalid",
                responseOfService: {},
                service: service,
            }
        };
    }

    switch (service) {
        case "TRUTHSCREEN":
            returnedObj = {
                gstinNumber: obj?.result?.essentials?.gstin || "",
            }
            break;
    }
    return {
        success: true,
        data: {
            gstinNumber: data || "",
            result: returnedObj,
            message: "Valid",
            responseOfService: obj,
            service: service,
        }
    };
};

module.exports = {
    PANtoGSTActiveServiceResponse,
}
