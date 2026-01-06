const { generateTransactionId } = require("../truthScreen/callTruthScreen")
const { default: axios } = require("axios");

const shopActiveServiceResponse = async (data, services, index = 0) => {
    if (index >= services?.length) {
        return { success: false, message: "All services failed" };
    }

    const newService = services?.find((ser) => ser.priority === index + 1);

    if (!newService) {
        console.log(`No service with priority ${index + 1}, trying next`);
        return shopActiveServiceResponse(data, services, index + 1);
    }

    const serviceName = newService.providerId || "";
    console.log(`Trying service:`, newService);

    try {
        const res = await shopApiCall(data, serviceName, 0);

        if (res?.success) {
            return res.data;
        }

        console.log(`${serviceName} responded failure → trying next`);
        return shopActiveServiceResponse(data, services, index + 1);

    } catch (err) {
        console.log(`Error from ${serviceName}:`, err.message);
        return shopActiveServiceResponse(data, services, index + 1);
    }
};

const shopApiCall = async (data, service) => {
    const tskId = await generateTransactionId(12);

    const ApiData = {
        "ZOOP": {
            BodyData: {
                mode: "sync",
                data: {
                    customer_pan_number: data,
                    consent: "Y",
                    consent_text: "Iconsenttothisinformationbeingsharedwithzoop.one",
                },
                task_id: tskId
            },
            url: process.env.ZOOP_SHOP_URL,
            header: {
                "app-id": process.env.ZOOP_APP_ID,
                "api-key": process.env.ZOOP_API_KEY,
                "content-type": "application/json",
            }
        },
        "INVINCIBLE": {
            BodyData: JSON.stringify({registrationNumber, state }),
            url: process.env.INVINCIBLE_SHOP_URL,
            header: {
                accept: "application/json",
                clientId: process.env.INVINCIBLE_CLIENT_ID,
                "content-type": "application/json",
                secretKey: process.env.INVINCIBLE_SECRET_KEY,
            }
        },
        "TRUTHSCREEN": {
            BodyData: JSON.stringify({
                gstin: data
            }),
            url: process.env.INVINCIBLE_GSTIN_URL,
            header: {
                accept: "application/json",
                clientId: process.env.INVINCIBLE_CLIENT_ID,
                "content-type": "application/json",
                secretKey: process.env.INVINCIBLE_SECRET_KEY,
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
        return { success: false, data: null }; // fallback trigger
    }

    const obj = ApiResponse.data;
    console.log('obj ==>', obj)

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
        case "ZOOP":
            returnedObj = {
                registrationNumber: data,
                state: obj?.state,
                shopName: obj?.result?.result?.nameOfTheShop,
                shopAddress: obj?.result?.result?.address
            }
            break;

        case "INVINCIBLE":
            returnedObj = {
                gstinNumber: obj?.result?.essentials?.gstin || "",
                business_constitution: obj?.result?.result?.gstnDetailed?.constitutionOfBusiness || "",
                central_jurisdiction: obj?.result?.result?.gstnDetailed?.centreJurisdiction || "",
                gstin: obj?.result?.result?.gstnDetailed?.gstinStatus || "",
                companyName: obj?.result?.result?.gstnDetailed?.gstinStatus || "",
                other_business_address: obj?.result?.result?.gstnDetailed?.principalPlaceAddress?.address || "",
                register_cancellation_date: obj?.result?.result?.gstnDetailed?.cancellationDate || "",
                state_jurisdiction: obj?.result?.result?.gstnDetailed?.stateJurisdiction || "",
                tax_payer_type: obj?.result?.result?.gstnDetailed?.taxPayerType || "",
                trade_name: obj?.result?.result?.gstnDetailed?.tradeNameOfBusiness || "",
                primary_business_address: obj?.result?.result?.gstnDetailed?.principalPlaceAddress?.address || ""
            }
            break;
        case "TRUTHSCREEN":
            returnedObj = {
                gstinNumber: obj?.result?.essentials?.gstin || "",
                business_constitution: obj?.result?.result?.gstnDetailed?.constitutionOfBusiness || "",
                central_jurisdiction: obj?.result?.result?.gstnDetailed?.centreJurisdiction || "",
                gstin: obj?.result?.result?.gstnDetailed?.gstinStatus || "",
                companyName: obj?.result?.result?.gstnDetailed?.gstinStatus || "",
                other_business_address: obj?.result?.result?.gstnDetailed?.principalPlaceAddress?.address || "",
                register_cancellation_date: obj?.result?.result?.gstnDetailed?.cancellationDate || "",
                state_jurisdiction: obj?.result?.result?.gstnDetailed?.stateJurisdiction || "",
                tax_payer_type: obj?.result?.result?.gstnDetailed?.taxPayerType || "",
                trade_name: obj?.result?.result?.gstnDetailed?.tradeNameOfBusiness || "",
                primary_business_address: obj?.result?.result?.gstnDetailed?.principalPlaceAddress?.address || ""
            }
            break;
    }
    return {
        success: true,
        data: {
            registrationNumber: data || "",
            result: returnedObj,
            message: "Valid",
            responseOfService: obj,
            service:service ,
        }
    };
};

module.exports = {
    shopActiveServiceResponse,
}
