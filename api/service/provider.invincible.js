const axios = require("axios");
const logger = require("../Logger/logger");

const API_TIMEOUT = 8000;
const MAX_RETRY = 2;

async function apiCall(url, body, headers) {
    console.log('Api call triggred in invincible', url, body, headers)
    try {
        const res = await axios.post(url, body, {
            headers,
        });
        console.log('Api Call response in invincible ===>', res?.data);
        return res?.data;

    } catch (err) {
        const isNetworkErr = err.code === "ECONNABORTED" || !err.response;
        if (!isNetworkErr) {
            throw err;
        }
        console.log(`Invincible Retry Attempt error ${err}`);
    }
}

// poonam
async function verifyPanInvincible(data) {
    const url = "https://api.invincibleocean.com/invincible/panPlus";
    const headers = {
        'clientId': process.env.INVINCIBLE_CLIENT_ID,
        'secretKey': process.env.INVINCIBLE_SECRET_KEY
    }

    try {
        const responsedata = await apiCall(url, data, headers);

        if (responsedata.code === 404) {
            console.log("PAN data not found");
            return { message: "NoDataFound" };
        } else if (responsedata.code === 402) {
            console.log("NoBalance");
            logger.info("NoBalance in invincible ====>>>");
            return { message: "NoBalance" };
        }

        const result = responsedata.result || {};
        console.log("result in verify pan invincible====>>>", result)

        const firstName = result.FIRST_NAME || "";
        const middleName = result.MIDDLE_NAME || "";
        const lastName = result.LAST_NAME || "";
        const username = [firstName, middleName, lastName]
            .filter(Boolean)
            .join(" ");

        console.log("username in invincible ===>>>", username)

        const returnedObj = {
            PAN: result.PAN || null,
            Name: username || null,
            PAN_Status: result.PAN_STATUS || "VALID",
            PAN_Holder_Type: result.IDENTITY_TYPE || null,
        };
        return {
            result: returnedObj,
            message: "Valid",
            responseOfService: result,
            service: "Invincible",
        };
    } catch (err) {
        if (err) {
            throw err;
        }
    }
}
async function verifyAadhaar(data) {
    const url = process.env.Invincible_AADHAAR_URL;
    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Invincible-Api-Key ${process.env.Invincible_API_KEY}`
    };
    return await apiCall(url, data, headers);
}
async function faceMatch(data) {
    const url = process.env.Invincible_FACE_URL;
    const headers = {
        "Authorization": `Invincible-Api-Key ${process.env.Invincible_API_KEY}`
    };

    return await apiCall(url, data, headers);
}
async function verifyBank(data) {
    const url = process.env.Invincible_BANK_URL;
    const headers = {
        "Authorization": `Invincible-Api-Key ${process.env.Invincible_API_KEY}`
    };

    return await apiCall(url, data, headers);
}
async function verifyAadhaarMasked(data) {
    const url = process.env.Invincible_AADHAAR_URL || "https://api.invincibleocean.com/invincible/aadhaarToMaskPanLite";
    const headers = {
        "Content-Type": "application/json",
        "clientId": process.env.INVINCIBLE_CLIENT_ID,
        "secretKey": process.env.INVINCIBLE_SECRET_KEY,
    };

    console.log("verifyAadhaarMasked triggered with data:", data);

    return await apiCall(url, data, headers);
}
async function verifyFaceComparison(data) {
    const url = process.env.Invincible_FACE_COMPARE_URL || "https://api.invincibleocean.com/invincible/faceComparison";
    const headers = {
        "Content-Type": "application/json",
        "clientId": process.env.INVINCIBLE_CLIENT_ID,
        "secretKey": process.env.INVINCIBLE_SECRET_KEY,
    };
    console.log("verifyFaceComparison triggered with data:", data);
    return await apiCall(url, data, headers);
}

// vishnu
async function verifyGstin(data) {
    const url = "https://api.invincibleocean.com/invincible/gstinDetailSearch";
    const headers = {
        accept: "application/json",
        clientId: process.env.INVINCIBLE_CLIENT_ID,
        "content-type": "application/json",
        secretKey: process.env.INVINCIBLE_SECRET_KEY,
    };
    const apiresponse = await apiCall(url, data, headers);
    const gstnData = data?.business_gstin_number
    const gstinData = {
        gstinNumber: gstnData?.gstin,
        serviceRes: 'INVINCIBLE',
        response: apiresponse,
        companyName: apiresponse?.result?.result?.gstnDetailed?.legalNameOfBusiness,
        createdDate: new Date().toLocaleDateString(),
        createdTime: new Date().toLocaleTimeString()
    };
    console.log('VerifyGSTin Response data is', JSON.stringify(gstinData));
    return gstinData;

}
async function shopEstablishment(data) {
    const url = `https://api.invincibleocean.com/invincible/shopEstablishment`;
    const headers = {
        accept: "application/json",
        clientId: process.env.INVINCIBLE_CLIENT_ID,
        "content-type": "application/json",
        secretKey: process.env.INVINCIBLE_SECRET_KEY,
    };
    console.log('in ShopEstabishment provider called', url, data, headers)
    const apiResponse = await apiCall(url, data, headers);
    return apiResponse;
}



module.exports = {
    verifyPanInvincible,
    verifyAadhaar,
    faceMatch,
    verifyBank,
    verifyAadhaarMasked,
    verifyFaceComparison,
    verifyGstin,
    shopEstablishment
};
