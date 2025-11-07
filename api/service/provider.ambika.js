const axios = require("axios");
const xml2js = require('xml2js');

async function apiCall(url, Paramdata) {
    console.log('Api call triggred', url, Paramdata)
    try {
        console.log('Api Call In try block');
        const res = await axios.get(url, { params: Paramdata });
        console.log('Api Call response ===>', res?.data);
        return res?.data || {};

    } catch (err) {
        console.log(`Invincible Retry Attempt error ${err}`);
        const isNetworkErr = err.code === "ECONNABORTED" || !err.response;
        if (!isNetworkErr) {
            throw err;
        }
        return {}
    }
}

async function GetOperator(MobileNumber) {
    const url = process.env.OPERATORfETCH_URL;
    const Paramdata = {
        ApiUserID: process.env.APIMEMBER_ID,
        ApiPassword: process.env.API_PASSWORD,
        Mobileno: MobileNumber
    }
    const apiresponse = await apiCall(url, Paramdata);
    console.log('api Response form ambika is this ===>', apiresponse)
    return apiresponse;
}
async function GetPlans(operatorcode, cricle) {
    const url = process.env.PLAN_URL;
    const Paramdata = {
        apimember_id: process.env.APIMEMBER_ID,
        api_password: process.env.API_PASSWORD,
        operatorcode,
        cricle
    }
    const apiresponse = await apiCall(url, Paramdata);
    console.log('api Response form ambika is this ===>', apiresponse);
    return apiresponse;
}
async function GetOldPlan(operatorcode, cricle) {
    const url = process.env.OLD_PLAN_URL;
    const Paramdata = {
        apimember_id: process.env.APIMEMBER_ID,
        api_password: process.env.API_PASSWORD,
        operatorcode,
        cricle
    }
    const apiresponse = await apiCall(url, Paramdata);
    console.log('api Response form ambika is this ===>', apiresponse);
    return apiresponse;
}
async function GetOffers(operator_code, mobile_no) {
    const url = process.env.ROFFER_URL;
    const Paramdata = {
        apimember_id: process.env.APIMEMBER_ID,
        api_password: process.env.API_PASSWORD,
        operator_code,
        mobile_no
    }
    const apiresponse = await apiCall(url, Paramdata);
    console.log('api Response form ambika is this ===>', apiresponse);
    return apiresponse;
}
async function RECHARGE(paramsData) {
    const url = process.env.RECHARGE_URL;
    const Paramdata = {
        UserID: process.env.USER_ID,
        Token: process.env.TOKEN,
        Account: paramsData?.account,
        Amount: paramsData?.actualAmount,
        SPKey: paramsData?.spKey,
        APIRequestID: paramsData?.transactionId,
        GEOCode: paramsData?.geoCode,
        CustomerNumber: paramsData?.customerNumber,
        Pincode: paramsData?.pincode,
        Format: 2
    }
    const apiresponse = await apiCall(url, Paramdata);
    console.log('api Response form ambika is this ===>', apiresponse);
     const parser = new xml2js.Parser({ explicitArray: false });
    const jsonData = await parser.parseStringPromise(apiresponse);
    return jsonData;
}

module.exports = {
    GetOperator,
    GetPlans,
    GetOffers,
    GetOldPlan,
    RECHARGE
};
