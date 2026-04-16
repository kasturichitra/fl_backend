const { panServiceLogger } = require("../../Logger/logger");
const {
  generateTransactionId,
  callTruthScreenAPI,
} = require("../../truthScreen/callTruthScreen");
const axios = require("axios");

const PanActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  clientId = "",
) => {
  const client = clientId || "UN_KNOWN";
  const fn = "PanActiveServiceResponse"
  panServiceLogger.info(
    `[${fn}] request started for this client: ${client}===>>`,
  );
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);
  panServiceLogger.info(
    `[${fn}] incoming data: ${data?.slice(-4)} for this client: ${client}===>>`
  );

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    panServiceLogger.info(
      `No service with priority ${index + 1}, trying next for this client: ${client}`,
    );
    return PanActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[${fn}] Trying service with priority ${index + 1}:`,
    newService,
  );
  panServiceLogger.info(
    `[${fn}] Trying service ${serviceName} with priority index: ${index + 1} for this client: ${client}`
  );

  try {
    const res = await PanApiCall(data, serviceName, client);

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[PanActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    panServiceLogger.info(
      `[PanActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return PanActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[PanActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    panServiceLogger.info(
      `[PanActiveServiceResponse] Error for this client: ${client} from service: ${serviceName}:`,
      err.message,
    );
    return PanActiveServiceResponse(data, services, index + 1);
  }
};

// =======================================
//         PAN API CALL (ALL SERVICES)
// =======================================

const PanApiCall = async (data, service, CID = "") => {
  const tskId = await generateTransactionId(12);
  const ApiData = {
    ZOOP: {
      BodyData: {
        mode: "sync",
        data: {
          customer_pan_number: data,
          consent: "Y",
          consent_text:
            "I consent to this information being shared with zoop.one",
        },
        task_id: tskId,
      },
      url: process.env.ZOOP_PANVERFICATON_URL,
      header: {
        "app-id": process.env.ZOOP_APP_ID,
        "api-key": process.env.ZOOP_API_KEY,
        "Content-Type": "application/json",
      },
    },
    INVINCIBLE: {
      BodyData: data,
      url: process.env.INVINCIBLE_PANVERIFICATION_URL,
      header: {
        clientId: process.env.INVINCIBLE_CLIENT_ID,
        secretKey: process.env.INVINCIBLE_SECRET_KEY,
      },
    },
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: 2,
        docNumber: data,
      },
      url: process.env.TRUTNSCREEN_PANVERIFICATION_URL,
      header: {
        username: process.env.TRUTHSCREEN_USERNAME,
        token: process.env.TRUTHSCREEN_TOKEN,
      },
    },
  };

  // Empty provider fallback
  if (!service?.trim()) {
    service = Object.keys(ApiData)[0];
    console.log("Empty provider → defaulting to:", service);
    panServiceLogger.info(
      `Empty provider → defaulting to first service: ${service} for this client: ${CID} with value: ${data?.slice(-4)}`,
    );
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
        cId: CID,
        logger: panServiceLogger
      });
    } else {
      ApiResponse = await axios.post(config.url, config.BodyData, {
        headers: config.header,
      });
    }
  } catch (error) {
    console.log(`[PanApiCall] API Error in ${service}:`, error.message);
    console.log(
      `[PanApiCall] API Error Response in ${service}:`,
      error.response,
    );
    console.log(
      `[PanApiCall] API Error Response in ${service}:`,
      JSON.stringify(error.response),
    );
    panServiceLogger.info(
      `[PanApiCall] API Error Response in with service: ${service} for this client: ${CID}`,
      error.response,
    );
    return { success: false };
  }

  const obj = ApiResponse?.data || ApiResponse;
  panServiceLogger.info(
    `[PanApiCall] service: ${service} API response: ${JSON.stringify(obj)} for this client: ${CID} with value: ${data?.slice(-4)}`,
  );

  // =======================================
  //      UNIFIED RESULT NORMALIZATION
  // =======================================

  let returnedObj = {};

  // ------------------------
  // ZOOP RESPONSE
  // ------------------------
  if (service === "ZOOP") {
    if (obj?.response_code === "101" || !obj?.success) {
      panServiceLogger.info(
        `[PanApiCall] [FAILED] service: ${service} with value: ${data?.slice(-4)} for this client: ${CID}`,
      );
      return invalidResponse(service, obj?.result);
    }
    returnedObj = {
      PAN: obj?.result?.pan_number || null,
      Name: obj?.result?.user_full_name || null,
      PAN_Status: obj?.result?.pan_status || null,
      PAN_Holder_Type: obj?.result?.pan_type || null,
    };
  }

  // ------------------------
  // INVINCIBLE RESPONSE
  // ------------------------
  if (service === "INVINCIBLE") {
    if (!obj?.success) return invalidResponse(service, obj?.result);

    returnedObj = {
      PAN: obj?.result?.pan_number || null,
      Name: obj?.result?.user_full_name || null,
      PAN_Status: obj?.result?.pan_status || null,
      PAN_Holder_Type: obj?.result?.pan_type || null,
    };
  }

  panServiceLogger.info(
    `[PanApiCall] service: ${service} API response formatted: ${returnedObj} for this client: ${CID}`,
  );

  // ------------------------
  // TRUTHSCREEN RESPONSE
  // ------------------------
  if (service === "TRUTHSCREEN") {
    const msg = obj?.msg;

    if (
      obj?.status == 9 &&
      typeof obj?.msg === "string" &&
      (obj.msg.toLowerCase().includes("no record") ||
        obj.msg.toLowerCase().includes("invalid"))
    ) {
      panServiceLogger.info(`[${service}] no record for this client: ${CID}`);
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

    if (
      obj?.status == 0 &&
      obj?.msg?.toLowerCase().includes("something went")
    ) {
      console.log(`[${service}] Invalid status received → fallback`);
      panServiceLogger.info(
        `[${service}] Invalid status received → fallback for this client: ${CID}`,
      );
      return { success: false, data: null };
    }

    returnedObj = {
      PAN: msg?.PanNumber || null,
      Name: msg?.Name || null,
      PAN_Status: msg?.STATUS || null,
      PAN_Holder_Type: msg?.panHolderStatusType || null,
    };

    panServiceLogger.info(
      `[PanApiCall] service: ${service} API response formatted for this client: ${CID}`,
    );

    return {
      success: true,
      data: {
        result: returnedObj,
        message: "Valid",
        responseOfService: msg,
        service,
      },
    };
  }

  // ===========================
  // DEFAULT VALID RETURN
  // ===========================
  return {
    success: true,
    data: {
      result: returnedObj,
      message: "Valid",
      responseOfService: obj?.result,
      service,
    },
  };
};

// =======================================
// INVALID RESPONSE HANDLER (REUSABLE)
// =======================================

const invalidResponse = (service, raw) => ({
  success: false,
  data: {
    result: "NoDataFound",
    message: "Invalid",
    responseOfService: raw || {},
    service,
  },
});

module.exports = {
  PanActiveServiceResponse,
};