
const { generateTransactionId, callTruthScreenAPI } = require("../truthScreen/callTruthScreen");
const crypto = require("crypto");
const axios = require("axios");
const xml2js = require('xml2js');

const rechargeOperatorActiveServiceResponse = async (data, services, ApiType, index = 0) => {
    if (!data) {
        return { success: false, message: "Invalid Data" };
    }

    if (!services || services.length === 0 || index >= services.length) {
        return { success: false, message: "All services failed" };
    }

    const newService = services?.find((ser) => ser.priority === index + 1);

    if (!newService) {
        console.log(`No service with priority ${index + 1}, trying next`);
        return rechargeOperatorActiveServiceResponse(data, services, ApiType, index + 1);
    }

    const serviceName = newService.providerId || "";
    console.log(`Trying service: ${serviceName} for ${ApiType}`);

    try {
        let res;
        switch (ApiType) {
            case "OPERATORS":
                res = await OperatorsApiCall(data, serviceName);
                break;
            case "PLANS":
                res = await PlansApiCall(data, serviceName);
                break;
            case "OFFERS":
                res = await OffersApiCall(data, serviceName);
                break;
            case "OLD_PLANS":
                res = await OldPlansApiCall(data, serviceName);
                break;
            case "RECHARGE":
                res = await RechargeApiCall(data, serviceName);
                break;
            default:
                console.log("No valid ApiType provided, defaulting to OPERATORS");
                res = await OperatorsApiCall(data, serviceName);
                break;
        }

        if (res?.success) {
            if (typeof res.data === 'object' && res.data !== null && !Array.isArray(res.data)) {
                return { ...res.data, success: true };
            }
            return res.data;
        }

        console.log(`${serviceName} responded failure → trying next`);
        return rechargeOperatorActiveServiceResponse(data, services, ApiType, index + 1);

    } catch (err) {
        console.log(`Error in service ${serviceName}:`, err);
        return rechargeOperatorActiveServiceResponse(data, services, ApiType, index + 1);
    }
};

const OperatorsApiCall = async (data, service) => {
    const { MobileNumber } = data;

    const ApiData = {
        "AMBIKA": {
            url: process.env.OPERATORfETCH_URL,
            Paramdata: {
                ApiUserID: process.env.APIMEMBER_ID,
                ApiPassword: process.env.API_PASSWORD,
                Mobileno: MobileNumber
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
        ApiResponse = await axios.get(config.url, { params: config?.Paramdata });

    } catch (error) {
        console.log("Error =>", error);
        return { success: false, data: null };
    }

    console.log("Operators Response =>", ApiResponse?.data);

    if (!ApiResponse || !ApiResponse.data) {
        return { success: false, data: null };
    }

    let returnedObj = {};

    switch (service) {

        case "AMBIKA":
            returnedObj = ApiResponse?.data;
            break;
    }

    return {
        success: true,
        data: {
            Mobile: returnedObj?.Mobile,
            result: returnedObj,
            message: "Valid",
            responseOfService: returnedObj,
            service: "AMBIKA",
        }
    };
};

const PlansApiCall = async (data, service) => {
    const { operatorcode, cricle } = data;

    const ApiData = {
        "AMBIKA": {
            url: process.env.PLAN_URL,
            Paramdata: {
                apimember_id: process.env.APIMEMBER_ID,
                api_password: process.env.API_PASSWORD,
                operatorcode,
                cricle
            }
        }
    };

    if (!service?.trim()) {
        service = Object.keys(ApiData)[0];
    }

    const config = ApiData[service];
    if (!config) throw new Error(`Invalid service: ${service}`);

    let ApiResponse;

    try {
        ApiResponse = await axios.get(config.url, { params: config?.Paramdata });
    } catch (error) {
        console.log("Error =>", error);
        return { success: false, data: null };
    }

    console.log("Plans Response =>", ApiResponse?.data);

    if (!ApiResponse || !ApiResponse.data) {
        return { success: false, data: null };
    }

    return {
        success: true,
        data: ApiResponse?.data
    };
}

const OffersApiCall = async (data, service) => {
    const { operator_code, mobile_no } = data;

    const ApiData = {
        "AMBIKA": {
            url: process.env.ROFFER_URL,
            Paramdata: {
                apimember_id: process.env.APIMEMBER_ID,
                api_password: process.env.API_PASSWORD,
                operator_code,
                mobile_no
            }
        }
    };

    if (!service?.trim()) {
        service = Object.keys(ApiData)[0];
    }

    const config = ApiData[service];
    if (!config) throw new Error(`Invalid service: ${service}`);

    let ApiResponse;

    try {
        ApiResponse = await axios.get(config.url, { params: config?.Paramdata });
    } catch (error) {
        console.log("Error =>", error);
        return { success: false, data: null };
    }

    console.log("Offers Response =>", ApiResponse?.data);

    if (!ApiResponse || !ApiResponse.data) {
        return { success: false, data: null };
    }

    return {
        success: true,
        data: ApiResponse?.data
    };
}

const OldPlansApiCall = async (data, service) => {
    const { operatorcode, cricle } = data;

    const ApiData = {
        "AMBIKA": {
            url: process.env.OLD_PLAN_URL,
            Paramdata: {
                apimember_id: process.env.APIMEMBER_ID,
                api_password: process.env.API_PASSWORD,
                operatorcode,
                cricle
            }
        }
    };

    if (!service?.trim()) {
        service = Object.keys(ApiData)[0];
    }

    const config = ApiData[service];
    if (!config) throw new Error(`Invalid service: ${service}`);

    let ApiResponse;

    try {
        ApiResponse = await axios.get(config.url, { params: config?.Paramdata });
    } catch (error) {
        console.log("Error =>", error);
        return { success: false, data: null };
    }

    console.log("Old Plans Response =>", ApiResponse?.data);

    if (!ApiResponse || !ApiResponse.data) {
        return { success: false, data: null };
    }

    return {
        success: true,
        data: ApiResponse?.data
    };
}

const RechargeApiCall = async (data, service) => {
    console.log('Recharge Api Call is Triggred ===>',data)
    const { account, actualAmount, spKey, transactionId, geoCode, customerNumber, pincode } = data;

    const ApiData = {
        "AMBIKA": {
            url: process.env.RECHARGE_URL,
            Paramdata: {
                UserID: process.env.USER_ID,
                Token: process.env.TOKEN,
                Account: account,
                Amount: actualAmount,
                SPKey: spKey,
                APIRequestID: transactionId,
                GEOCode: geoCode,
                CustomerNumber: customerNumber,
                Pincode: pincode,
                Format: 2
            }
        }
    };

    if (!service?.trim()) {
        service = Object.keys(ApiData)[0];
    }

    const config = ApiData[service];
    if (!config) throw new Error(`Invalid service: ${service}`);

    let ApiResponse;

    try {
        ApiResponse = await axios.get(config.url, { params: config?.Paramdata });
    } catch (error) {
        console.log("Error =>", error);
        return { success: false, data: null };
    }

    console.log("Recharge Response =>", ApiResponse?.data);

    if (!ApiResponse || !ApiResponse.data) {
        return { success: false, data: null };
    }

    let jsonData = ApiResponse?.data;
    if (service === "AMBIKA") {
        const parser = new xml2js.Parser({ explicitArray: false });
        try {
            jsonData = await parser.parseStringPromise(ApiResponse.data);
        } catch (e) {
            console.log("XML Parsing Error", e);
        }
    }

    return {
        success: true,
        data: jsonData
    };
}

module.exports = {
    rechargeOperatorActiveServiceResponse
};
