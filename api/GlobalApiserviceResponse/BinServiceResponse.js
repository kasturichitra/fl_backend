const axios = require("axios");

const BinActiveServiceResponse = async (data, services, index = 0) => {
  console.log('BinActiveServiceResponse called');
  if (index >= services.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return BinActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(`[BinActiveServiceResponse] Trying service with priority ${index + 1}:`, newService);

  try {
    const res = await BinApiCall(data, serviceName);

    if (res?.success) {
      return res.data;
    }

    console.log(`[BinActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`);
    return BinActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(`[BinActiveServiceResponse] Error from ${serviceName}:`, err.message);
    return BinActiveServiceResponse(data, services, index + 1);
  }
};

// =======================================
//         BIN API CALL (ALL SERVICES)
// =======================================

const BinApiCall = async (data, service) => {
  const ApiData = {
    RAPID: {
      params: {
        bin: data,
      },
      url: process.env.RAPID_BINVERIFICATION_URL,
      header: {
        "x-rapidapi-key": process.env.RAPID_API_KEY,
        "x-rapidapi-host": process.env.RAPID_API_BIN_HOST,
      },
      method: "GET",
    },

    RAPID2: {
      params: {
        binNumber: data,
      },
      url: process.env.INVINCIBLE_BINVERIFICATION_URL,
      header: {
        clientId: process.env.INVINCIBLE_CLIENT_ID,
        secretKey: process.env.INVINCIBLE_SECRET_KEY,
      },
      method: "GET",
    },

    INSTANTPAY: {
      BodyData: {
        binNumber: data,
        latitude: "38.8951",
        longitude: "77.0364",
        externalRef: `REF-${Date.now()}`,
      },
      url: process.env.INSTANTPAY_BINVERIFICATION_URL,
      header: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Ipay-Auth-Code": process.env.IPAY_AUTH_CODE,
        "X-Ipay-Client-Id": process.env.IPAY_CLIENT_ID,
        "X-Ipay-Client-Secret": process.env.IPAY_CLIENT_SECRET,
        "X-Ipay-Endpoint-Ip": process.env.CLIENT_IP,
      },
      method: "POST",
    },
  };

  // Empty provider fallback
  if (!service?.trim()) {
    service = Object.keys(ApiData)[0];
    console.log("Empty provider → defaulting to:", service);
  }

  const config = ApiData[service];
  if (!config) throw new Error(`Invalid service: ${service}`);

  let ApiResponse;

  try {
    if (service?.toUpperCase() === "INSTANTPAY") {
      ApiResponse = await axios.post(config.url, config.BodyData, {
        headers: config.header,
      });
    } else {
      ApiResponse = await axios.get(config.url, {
        headers: config.header,
        params: config.params,
      });
    }
  } catch (error) {
    console.log(`[BinApiCall] API Error in ${service}:`, error.message);
    return { success: false };
  }

  const obj = ApiResponse?.data || ApiResponse;
  console.log(`[BinApiCall] ${service} Response Object:`, JSON.stringify(obj));

  // =======================================
  //      UNIFIED RESULT NORMALIZATION
  // =======================================

  let returnedObj = {};

  // ------------------------
  // INSTANTPAY RESPONSE
  // ------------------------
  if (service === "INSTANTPAY") {
    if (!obj?.success) {
      return invalidResponse(service, obj);
    }

    returnedObj = {
      BIN: obj?.data?.binNumber,
      Scheme: obj?.data?.scheme,
      CardType: obj?.data?.cardType,
      Bank: obj?.data?.bankName,
      Country: obj?.data?.country,
    };
  }

  // ------------------------
  // RAPID RESPONSE
  // ------------------------
  if (service === "RAPID") {
    if (!obj?.bin) return invalidResponse(service, obj);

    returnedObj = {
      BIN: obj.bin,
      Scheme: obj.brand,
      CardType: obj.type,
      CardLevel: obj.level,
      Bank: obj.bank,
      Country: obj.country,
      CountryCode: obj.countrycode,
    };
  }

  // ------------------------
  // RAPID2 RESPONSE
  // ------------------------
  if (service === "RAPID2") {
    const msg = obj?.msg || obj;

    if (!msg || msg?.STATUS === "INVALID") {
      return invalidResponse(service, msg);
    }

    returnedObj = {
      BIN: msg?.binNumber || data,
      Scheme: msg?.scheme,
      CardType: msg?.cardType,
      Bank: msg?.bankName,
      Country: msg?.country,
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
      responseOfService: obj,
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
  BinActiveServiceResponse,
};
