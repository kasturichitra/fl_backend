const axios = require("axios");
const logger = require("../Logger/logger");
const { updateFailure } = require("./serviceSelector");

async function apiCall(url, body, headers) {
  console.log("Api call triggred in invincible", url, body, headers);
  try {
    const res = await axios.post(url, body, {
      headers,
    });
    console.log("Api Call response in invincible ===>", res?.data);
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
    clientId: process.env.INVINCIBLE_CLIENT_ID,
    secretKey: process.env.INVINCIBLE_SECRET_KEY,
  };

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
    console.log("result in verify pan invincible====>>>", result);

    const firstName = result.FIRST_NAME || "";
    const middleName = result.MIDDLE_NAME || "";
    const lastName = result.LAST_NAME || "";
    const username = [firstName, middleName, lastName]
      .filter(Boolean)
      .join(" ");

    console.log("username in invincible ===>>>", username);

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
    Authorization: `Invincible-Api-Key ${process.env.Invincible_API_KEY}`,
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
  const url = "https://api.invincibleocean.com/invincible/BAVpennyless";
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
async function verifyUdhyamInvincible(data) {
  const { udyamNumber } = data;
  const url = "https://api.invincibleocean.com/invincible/msmeUdyamDetails";
  const headers = {
    accept: "application/json",
    clientId: process.env.INVINCIBLE_CLIENT_ID,
    secretKey: process.env.INVINCIBLE_SECRET_KEY,
  };

  const apiData = { udyamNumber };

  try {
    const udyamResponseInvincible = await apiCall(url, apiData, headers);
    console.log(
      "ResponseInvincible ===>>>",
      JSON.stringify(udyamResponseInvincible)
    );

    if (
      udyamResponseInvincible?.code === 200 &&
      udyamResponseInvincible?.message?.toLowerCase().includes("success")
    ) {
      const result = udyamResponseInvincible.result || {};

      const commonObject = {
        udyam: udyamNumber,
        "Date of Commencement of Production/Business":
          result["Date of Commencement of Production/Business"],
        "Date of Incorporation": result["Date of Incorporation"],
        "Date of Udyam Registration": result["Date of Udyam Registration"],
        "MSME-DFO": result["MSME-DFO"],
        "Major Activity": result["Major Activity"],
        "Name of Enterprise": result["Name of Enterprise"],
        "Organisation Type": result["Organisation Type"],
        "Social Category": result["Social Category"],
        "Enterprise Type": result["Enterprise Type"]?.map((item) => ({
          "Classification Date": item["Classification Date"],
          "Classification Year": item["Classification Year"],
          "Enterprise Type": item["Enterprise Type"],
        })),
        "National Industry Classification Code(S)": result[
          "National Industry Classification Code(S)"
        ]?.map((item) => ({
          Activity: item["Activity"],
          Date: item["Date"],
          "Nic 2 Digit": item["Nic 2 Digit"],
          "Nic 4 Digit": item["Nic 4 Digit"],
          "Nic 5 Digit": item["Nic 5 Digit"],
        })),
        "Official address of Enterprise": {
          "Flat/Door/Block No":
            result["Official address of Enterprise"]?.["Flat/Door/Block No."] ||
            null,
          "Name of Premises/ Building":
            result["Official address of Enterprise"]?.[
              "Name of Premises/ Building"
            ] || null,
          "Village/Town":
            result["Official address of Enterprise"]?.["Village/Town"] || null,
          Block: result["Official address of Enterprise"]?.["Block"] || null,
          "Road/Street/Lane":
            result["Official address of Enterprise"]?.["Road/Street/Lane"] ||
            null,
          City: result["Official address of Enterprise"]?.["City"] || null,
          State: result["Official address of Enterprise"]?.["State"] || null,
          District:
            result["Official address of Enterprise"]?.["District"] || null,
          Mobile: result["Official address of Enterprise"]?.["Mobile"] || null,
          Email: result["Official address of Enterprise"]?.["Email"] || null,
        },
      };

      return {
        result: commonObject,
        message: "Valid",
        responseOfService: udyamResponseInvincible,
        service: "Invincible",
      };
    } else {
      return {
        result: {},
        message: "Invalid",
        responseOfService: udyamResponseInvincible,
        service: "Invincible",
      };
    }
  } catch (err) {
    console.log(
      `Error while getting response in verifyUdhyamInvincible ===>> ${err}`
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
  const url =
    process.env.Invincible_AADHAAR_URL ||
    "https://api.invincibleocean.com/invincible/aadhaarToMaskPanLite";
  const headers = {
    "Content-Type": "application/json",
    clientId: process.env.INVINCIBLE_CLIENT_ID,
    secretKey: process.env.INVINCIBLE_SECRET_KEY,
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
    verifyBankInvincible,
    verifyUdhyamInvincible,
    verifyCinInvincible,
    verifyBankAccountInvincible,
    verifyAadhaarMasked,
    verifyGstin,
    shopEstablishment
};
