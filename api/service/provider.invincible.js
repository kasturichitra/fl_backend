const axios = require("axios");
const logger = require("../Logger/logger");

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
async function verifyBankAccountInvincible(data) {
  const { account_no, ifsc } = data;
  const url =
    "https://api.invincibleocean.com/invincible/bankAccountValidation/v1";
  const headers = {
    accept: "application/json",
    clientId: process.env.INVINCIBLE_CLIENT_ID,
    secretKey: process.env.INVINCIBLE_SECRET_KEY,
  };

  const apiData = {
    bankAccount: account_no,
    ifsc: ifsc,
  };

  try {
    const BankResponseInvincible = await apiCall(url, apiData, headers);
    console.log("ResponseInvincible ===>>>", BankResponseInvincible);

    if (
      BankResponseInvincible?.result?.status?.toLowerCase() === "success" &&
      BankResponseInvincible?.code === 200
    ) {
      const result = BankResponseInvincible.result || {};
      const dataObj = result.data || {};

      const returnedObj = {
        name: dataObj.nameAtBank || null,
        status: result.accountStatus || result.status || null,
        success: BankResponseInvincible.code === 200,
        message:
          BankResponseInvincible.message ||
          result.message ||
          "Transaction Successful",
        account_no: account_no || null,
        ifsc: ifsc || null,
      };

      return {
        result: returnedObj,
        message: "Valid",
        responseOfService: BankResponseInvincible,
        service: "Invincible",
      };
    } else {
      return {
        result: {},
        message: "Invalid",
        responseOfService: BankResponseInvincible,
        service: "Invincible",
      };
    }
  } catch (err) {
    console.log(
      `Error while getting response in verifyBankAccountInvincible ===>> ${err}`
    );
    throw err;
  }
}
async function verifyBankInvincible(data) {
  const { account_no, ifsc } = data;
  const url =
    "https://api.invincibleocean.com/invincible/BAVpennyless";
  const headers = {
    accept: "application/json",
    clientId: process.env.INVINCIBLE_CLIENT_ID,
    secretKey: process.env.INVINCIBLE_SECRET_KEY,
  };

  const apiData = {
    accountNumber: account_no,
    ifscCode: ifsc,
  };

  try {
    const BankResponseInvincible = await apiCall(url, apiData, headers);
    console.log("ResponseInvincible ===>>>", BankResponseInvincible);

    if (
      BankResponseInvincible?.result?.status?.toLowerCase() === "success" &&
      BankResponseInvincible?.code === 200
    ) {
      const result = BankResponseInvincible.result || {};
      const dataObj = result.data || {};

      const returnedObj = {
        name: dataObj.nameAtBank || null,
        status: result.accountStatus || result.status || null,
        success: BankResponseInvincible.code === 200,
        message:
          BankResponseInvincible.message ||
          result.message ||
          "Transaction Successful",
        account_no: account_no || null,
        ifsc: ifsc || null,
      };

      return {
        result: returnedObj,
        message: "Valid",
        responseOfService: BankResponseInvincible,
        service: "Invincible",
      };
    } else {
      return {
        result: {},
        message: "Invalid",
        responseOfService: BankResponseInvincible,
        service: "Invincible",
      };
    }
  } catch (err) {
    console.log(
      `Error while getting response in verifyBankAccountInvincible ===>> ${err}`
    );
    throw err;
  }
}
async function verifyCinInvincible(data) {
  const url = "https://api.invincibleocean.com/invincible/get/companyDetailsV1";
  const headers = {
    accept: "application/json",
    clientId: process.env.INVINCIBLE_CLIENT_ID,
    secretKey: process.env.INVINCIBLE_SECRET_KEY,
  };

  try {
    const cinResponseInvincible = await apiCall(url, data, headers);

    console.log("cinResponseInvincible ===>>>", cinResponseInvincible);

    if (cinResponseInvincible?.result?.message?.toLowerCase() == "valid") {
      const cinResponseToSend = {
        message: "Valid",
        success: true,
        result: cinResponseInvincible?.result,
      };
    } else {
      const cinResponseToSend = {
        message: "InValid",
        success: false,
      };
    }
  } catch (error) {
    console.log(
      `Error while getting response in cin invincible ===>> ${error}`
    );
  }
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
    verifyBankAccountInvincible,
    verifyBankInvincible,
    verifyCinInvincible,
    verifyAadhaar,
    verifyAadhaarMasked,
    verifyFaceComparison,
    verifyGstin,
    shopEstablishment
};
