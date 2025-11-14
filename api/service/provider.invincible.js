const axios = require("axios");
const logger = require("../Logger/logger");
const { updateFailure } = require("./serviceSelector");

const API_TIMEOUT = 8000;
const MAX_RETRY = 2;

async function apiCall(url, body, headers,service) {
    console.log('Api call triggred in invincible', url, headers)
    // logger.info(`Api call triggred in invincible, url: ${url} body: ${JSON.stringify(body)} headers: ${headers}`);
    try {
        const res = await axios.post(url, body, { headers });
        console.log('Api Call response in invincible ===>', res?.data);
        return res?.data;

    } catch (err) {
        await updateFailure(service);
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

async function verifyGstin(data, service) {
    const url = process.env.INVINCIBLE_GSTIN_URL;
    const headers = {
        accept: "application/json",
        clientId: process.env.INVINCIBLE_CLIENT_ID,
        "content-type": "application/json",
        secretKey: process.env.INVINCIBLE_SECRET_KEY,
    };
    const apiresponse = await apiCall(url, data, headers, service);
    console.log(
        "Invincible verifyGsting Response ===>>>",
        apiresponse?.result
    );
    logger.info(
        `Invincible verifyGsting Response: : ${JSON.stringify(apiresponse?.response)}`
    );
    const returnedObj = {
        gstinNumber: apiresponse?.result?.essentials?.gstin || "",
        business_constitution: apiresponse?.result?.result?.gstnDetailed?.constitutionOfBusiness || "",
        central_jurisdiction: apiresponse?.result?.result?.gstnDetailed?.centreJurisdiction || "",
        gstin: apiresponse?.result?.result?.gstnDetailed?.gstinStatus || "",
        companyName: apiresponse?.result?.result?.gstnDetailed?.gstinStatus || "",
        other_business_address: apiresponse?.result?.result?.gstnDetailed?.principalPlaceAddress?.address || "",
        register_cancellation_date: apiresponse?.result?.result?.gstnDetailed?.cancellationDate || "",
        state_jurisdiction: apiresponse?.result?.result?.gstnDetailed?.stateJurisdiction || "",
        tax_payer_type: apiresponse?.result?.result?.gstnDetailed?.taxPayerType || "",
        trade_name: apiresponse?.result?.result?.gstnDetailed?.tradeNameOfBusiness || "",
        primary_business_address: apiresponse?.result?.result?.gstnDetailed?.principalPlaceAddress?.address || ""
    }
    return {
        gstinNumber: apiresponse?.result?.essentials?.gstin || "",
        result: returnedObj,
        message: "Valid",
        responseOfService: apiresponse,
        service: "INVINCIBLE",
    };

}
async function shopEstablishment(data, service) {
    const url = process.env.INVINCIBLE_SHOP_URL;
    const headers = {
        accept: "application/json",
        clientId: process.env.INVINCIBLE_CLIENT_ID,
        "content-type": "application/json",
        secretKey: process.env.INVINCIBLE_SECRET_KEY,
    };
    console.log('in ShopEstabishment provider called', url, data, headers)
    const apiResponse = await apiCall(url, data, headers, service);
    console.log("Invincible ShopEstablishment Response ===>", apiResponse);
    logger.info(`Invincible ShopEstablishment Response: ${JSON.stringify(apiResponse)}`
    );
    const returnedObj = {
        registrationNumber: data?.registrationNumber,
        state: data?.state,
        shopName: data?.result?.result?.nameOfTheShop,
        shopAddress: data?.result?.result?.address
    }
    console.log('ShopEstablishmenten Response data is', JSON.stringify(returnedObj));

    return {
        registrationNumber: data?.registrationNumber,
        result: returnedObj,
        message: "Valid",
        responseOfService: apiResponse,
        service: "INVINCIBLE",
    };
}
async function faceMatch(data, service) {
    const url = process.env.INVINCIBLE_FACEMATCH_URL;
    const headers = {
        accept: "application/json",
        "content-type": "application/json",
        clientId: process.env.INVINCIBLE_CLIENT_ID,
        secretKey: process.env.INVINCIBLE_SECRET_KEY,
    };
    const dataToSend = JSON.stringify({
        sourceImage: data?.userImage,
        targetImage: data?.aadhaarImage
    });

    const resData =  await apiCall(url, dataToSend, headers, service);
    console.log("Face Match Invincible Response ===>", resData);
      logger.info(`Face Match Invincible Response: ${JSON.stringify(resData)}`);
      const returnedObj = {
        success: resData?.success,
        response_code: resData?.response_code,
        response_message: resData?.response_message,
        result: resData?.result
      }
      console.log('facematch Response data is', JSON.stringify(returnedObj));
      return {
        result: returnedObj,
        message: "Valid",
        responseOfService: resData,
        service: "Invincible",
      };
}

module.exports = {
    verifyPanInvincible,
    verifyAadhaar,
    faceMatch,
    verifyBank,
    verifyAadhaarMasked,
    verifyGstin,
    shopEstablishment
};
