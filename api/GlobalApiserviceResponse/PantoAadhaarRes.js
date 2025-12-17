const { generateTransactionId } = require("../truthScreen/callTruthScreen")
const { default: axios } = require("axios");

const PantoAadhaarActiveServiceResponse = async (data, services, index = 0) => {
    if (index >= services.length) {
        return { success: false, message: "All services failed" };
    }

    const newService = services.find((ser) => ser.priority === index + 1);

    if (!newService) {
        console.log(`No service with priority ${index + 1}, trying next`);
        return PantoAadhaarActiveServiceResponse(data, services, index + 1);
    }

    const serviceName = newService.providerId || "";
    console.log(`Trying service:`, newService);

    try {
        const res = await PantoAadhaarApiCall(data, serviceName, 0);

        if (res?.success) {
            return res.data;
        }

        console.log(`${serviceName} responded failure → trying next`);
        return PantoAadhaarActiveServiceResponse(data, services, index + 1);

    } catch (err) {
        console.log(`Error from ${serviceName}:`, err.message);
        return PantoAadhaarActiveServiceResponse(data, services, index + 1);
    }
};

const PantoAadhaarApiCall = async (data, service) => {
    const tskId = await generateTransactionId(12);

    const ApiData = {
        "INVINCIBLE": {
            BodyData: JSON.stringify({ panNumber: data }),
            url: "https://api.invincibleocean.com/invincible/panToMaskAadhaarLite",
            header: {
                clientId: process.env.INVINCIBLE_CLIENT_ID,
                secretKey: process.env.INVINCIBLE_SECRET_KEY,
                "Content-Type": "application/json",
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
        console.log('Api response success ===>', ApiResponse.data)
    } catch (error) {
        console.log('Api Response ==>',error)
        return { success: false, data: null }; // fallback trigger
    }

    const obj = ApiResponse.data;
    console.log('obj ==>',obj)
    // Format responses by provider
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
        case "INVINCIBLE":
            returnedObj = {
                panNumber: data,
                aadhaarNumber: obj?.result?.aadhaar,
                response: obj,
            };
            break;
    }

    return {
        success: true,
        data: {
            result: returnedObj,
            message: "Valid",
            responseOfService: obj?.result,
            service: service,
        }
    };
};

module.exports = {
    PantoAadhaarActiveServiceResponse,
}
