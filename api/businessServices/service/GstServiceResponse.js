const { businessServiceLogger } = require("../../Logger/logger");
const {
  generateTransactionId,
  callTruthScreenAPI,
} = require("../../truthScreen/callTruthScreen");
const { default: axios } = require("axios");

const GSTActiveServiceResponse = async (
  data,
  services,
  index = 0,
  TxnID = "",
) => {
  console.log("GSTActiveServiceResponse called");
  businessServiceLogger.info(`GSTActiveServiceResponse called for this with value: ${data?.slice(-4)}`);
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return GSTActiveServiceResponse(data, services, index + 1, TxnID);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[GSTActiveServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await GSTApiCall(data, serviceName, TxnID);

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[GSTActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return GSTActiveServiceResponse(data, services, index + 1, TxnID);
  } catch (err) {
    console.log(
      `[GSTActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return GSTActiveServiceResponse(data, services, index + 1, TxnID);
  }
};

const GSTApiCall = async (data, service, TxnID = "") => {
  const tskId = TxnID;

  const ApiData = {
    ZOOP: {
      BodyData: {
        mode: "sync",
        data: {
          business_gstin_number: data,
          consent: "Y",
          consent_text:
            "I hereby declare my consent agreement for fetching my information via ZOOP API",
        },
      },
      url: process.env.ZOOP_GSTIN_URL,
      header: {
        "app-id": process.env.ZOOP_APP_ID,
        "api-key": process.env.ZOOP_API_KEY,
        "content-type": "application/json",
      },
    },
    INVINCIBLE: {
      BodyData: JSON.stringify({
        gstin: data,
      }),
      url: process.env.INVINCIBLE_GSTIN_URL,
      header: {
        accept: "application/json",
        clientId: process.env.INVINCIBLE_CLIENT_ID,
        "content-type": "application/json",
        secretKey: process.env.INVINCIBLE_SECRET_KEY,
      },
    },
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: 23,
        docNumber: data,
      },
      url: process.env.TRUTHSCREEN_API_URL,
      header: {
        username: process.env.TRUTHSCREEN_USERNAME,
        token: process.env.TRUTHSCREEN_TOKEN,
      },
    },
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
    if (service == "TRUTHSCREEN") {
      ApiResponse = await callTruthScreenAPI({
        url: config.url,
        payload: config.BodyData,
        username: config.header.username,
        password: config.header.token,
        logger:businessServiceLogger
      });
      console.log(
        "[PanApiCall] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    } else {
      ApiResponse = await axios.post(config.url, config.BodyData, {
        headers: config.header,
      });
    }
  } catch (error) {
    console.log(`[GSTApiCall] API Error in ${service}:`, error.message);
        if (service?.toLowerCase() == "invincible" && error.status == 404) {
      return {
        success: false,
        data: {
          result: "No Data Found",
          message: "Invalid",
          responseOfService: error || {},
          service,
        },
      };
    } else {
      return { success: false, data: null };
    }
  }

  const obj = ApiResponse.data || ApiResponse;
  console.log(`[GSTApiCall] ${service} Response Object:`, JSON.stringify(obj));
  businessServiceLogger.info(
    `[GSTApiCall] with service: ${service} Response Object: ${JSON.stringify(obj)}`
  );

  let returnedObj = {};

  switch (service) {
    case "ZOOP":
      if (obj.response_code === "101") {
        return {
          success: false,
          data: {
            result: "NoDataFound",
            message: "Invalid",
            responseOfService: {},
            service: service,
          },
        };
      }
      returnedObj = {
        gstinNumber: obj?.result?.gstin,
        business_constitution: obj?.result?.business_constitution,
        central_jurisdiction: obj?.central_jurisdiction,
        gstin: obj?.gstin,
        companyName: obj?.result?.legal_name,
        other_business_address: obj?.result?.other_business_address,
        register_cancellation_date: obj?.result?.register_cancellation_date,
        state_jurisdiction: obj?.result?.state_jurisdiction,
        tax_payer_type: obj?.result?.tax_payer_type,
        trade_name: obj?.result?.trade_name,
        primary_business_address: obj?.result?.primary_business_address,
      };
      break;
    case "INVINCIBLE":
      returnedObj = {
        gstinNumber: obj?.result?.essentials?.gstin || "",
        business_constitution:
          obj?.result?.result?.gstnDetailed?.constitutionOfBusiness || "",
        central_jurisdiction:
          obj?.result?.result?.gstnDetailed?.centreJurisdiction || "",
        gstin: obj?.result?.result?.gstnDetailed?.gstinStatus || "",
        companyName: obj?.result?.result?.gstnDetailed?.gstinStatus || "",
        other_business_address:
          obj?.result?.result?.gstnDetailed?.principalPlaceAddress?.address ||
          "",
        register_cancellation_date:
          obj?.result?.result?.gstnDetailed?.cancellationDate || "",
        state_jurisdiction:
          obj?.result?.result?.gstnDetailed?.stateJurisdiction || "",
        tax_payer_type: obj?.result?.result?.gstnDetailed?.taxPayerType || "",
        trade_name:
          obj?.result?.result?.gstnDetailed?.tradeNameOfBusiness || "",
        primary_business_address:
          obj?.result?.result?.gstnDetailed?.principalPlaceAddress?.address ||
          "",
      };
      break;
    case "TRUTHSCREEN":
      if (
        obj?.status === 0 &&
        typeof obj?.msg === "string" &&
        obj.msg.toLowerCase().includes("no record")
      ) {
        employmentServiceLogger.info(
          `[${service}] no record`,
        );
        return {
          success: false,
          data: {
            result: "NoDataFound",
            message: "NO RECORD FOUND",
            responseOfService: obj,
            service,
          },
        };
      }

      if (obj?.status !== 1) {
        console.log(`[${service}] Invalid status received → fallback`);
        console.log(
          `[${service}] Invalid status received → fallback`,
        );
        return { success: false, data: null };
      }
      returnedObj = {
        gstinNumber: obj?.result?.essentials?.gstin || "",
        business_constitution:
          obj?.result?.result?.gstnDetailed?.constitutionOfBusiness || "",
        central_jurisdiction:
          obj?.result?.result?.gstnDetailed?.centreJurisdiction || "",
        gstin: obj?.result?.result?.gstnDetailed?.gstinStatus || "",
        companyName: obj?.result?.result?.gstnDetailed?.gstinStatus || "",
        other_business_address:
          obj?.result?.result?.gstnDetailed?.principalPlaceAddress?.address ||
          "",
        register_cancellation_date:
          obj?.result?.result?.gstnDetailed?.cancellationDate || "",
        state_jurisdiction:
          obj?.result?.result?.gstnDetailed?.stateJurisdiction || "",
        tax_payer_type: obj?.result?.result?.gstnDetailed?.taxPayerType || "",
        trade_name:
          obj?.result?.result?.gstnDetailed?.tradeNameOfBusiness || "",
        primary_business_address:
          obj?.result?.result?.gstnDetailed?.principalPlaceAddress?.address ||
          "",
      };
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
    },
  };
};

const GSTtoPANActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  TxnID = "",
) => {
  console.log(
    "GSTtoPANActiveServiceResponse called",
    JSON.stringify(services),
    data,
    index,
  );
  if (index >= services?.length) {
    console.log(
      "index increased in gst to pan verify ====>>>",
      index,
      services?.length,
    );
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return GSTtoPANActiveServiceResponse(data, services, index + 1, TxnID);
  }

  const serviceName = newService.providerId || "";
  console.log(`Trying service:`, newService);

  try {
    const res = await GSTToPANApiCall(data, serviceName, TxnID);

    if (res?.data) {
      return res.data;
    }

    console.log(`${serviceName} responded failure → trying next`);
    return GSTtoPANActiveServiceResponse(data, services, index + 1, TxnID);
  } catch (err) {
    console.log(`Error from ${serviceName}:`, err.message);
    return GSTtoPANActiveServiceResponse(data, services, index + 1, TxnID);
  }
};

const GSTToPANApiCall = async (data, service, TxnID = "") => {
  const tskId = TxnID;

  const ApiData = {
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: 47,
        docNumber: data,
      },
      url: process.env.TRUTHSCREEN_API_URL,
      header: {
        username: process.env.TRUTHSCREEN_USERNAME,
        token: process.env.TRUTHSCREEN_TOKEN,
      },
    },
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
    if (service === "TRUTHSCREEN") {
      ApiResponse = await callTruthScreenAPI({
        url: config.url,
        payload: config.BodyData,
        username: config.header.username,
        password: config.header.token,
        logger:businessServiceLogger
      });
      console.log(
        "[gst to Pan Api Call] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    }
  } catch (error) {
    console.log("error gst:", error);
    return { success: false, data: null }; // fallback trigger
  }

  const obj = ApiResponse.data || ApiResponse;
  console.log("obj ==>", obj);
  businessServiceLogger.info(
    `[gst to pan api call] service: ${service} API response: ${JSON.stringify(obj)}`,
  );

  let returnedObj = {};

  if (
    obj?.status == 0 &&
    typeof obj?.msg === "string" &&
    obj.msg.toLowerCase().includes("no record")
  ) {
    employmentServiceLogger.info(
      `[${service}] no record`,
    );
    return {
      success: false,
      data: {
        result: "NoDataFound",
        message: "NO RECORD FOUND",
        responseOfService: obj,
        service,
      },
    };
  }

  if (obj?.status !== 1) {
    console.log(`[${service}] Invalid status received → fallback`);
    console.log(
      `[${service}] Invalid status received → fallback`,
    );
    return { success: false, data: null };
  }

  switch (service) {
    case "TRUTHSCREEN":
      returnedObj = {
        gstinNumber: obj?.result?.essentials?.gstin || "",
      };
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
    },
  };
};

module.exports = {
  GSTActiveServiceResponse,
  GSTtoPANActiveServiceResponse,
};
