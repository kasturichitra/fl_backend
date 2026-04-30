const axios = require("axios");
const { bankServiceLogger } = require("../../Logger/logger");

const BinActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  clientId,
) => {
  console.log("BinActiveServiceResponse called");
  if (index > services.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    bankServiceLogger.info(
      `No service with priority ${index + 1}, trying next for this client: ${clientId}`,
    );
    return BinActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  bankServiceLogger.info(
    `[BinActiveServiceResponse] Trying service with priority ${index + 1}:`,
    serviceName,
  );

  try {
    const res = await BinApiCall(data, serviceName, clientId);

    bankServiceLogger.info(
      `[Bin Active Service Response] response from active priority service ${JSON.stringify(res)}`,
    );

    if (res?.data) {
      return res.data;
    }

    bankServiceLogger.info(
      `[BinActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return BinActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    bankServiceLogger.info(
      `[BinActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return BinActiveServiceResponse(data, services, index + 1);
  }
};

// =======================================
//         BIN API CALL (ALL SERVICES)
// =======================================

const BinApiCall = async (data, service, CID) => {
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
        bin: data,
      },
      url: process.env.RAPID2_BINVERIFICATION_URL,
      headers: {
        "x-rapidapi-key": process.env.RAPID_API_KEY,
        "x-rapidapi-host": "bin-ip-checker.p.rapidapi.com",
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
    bankServiceLogger.info(`[BinApiCall] API Error in ${service}:`, error?.reponse);
    return { success: false };
  }

  const obj = ApiResponse?.data || ApiResponse;
  console.log(`[BinApiCall] ${service} Response Object:`, JSON.stringify(obj));

  // =======================================
  //      UNIFIED RESULT NORMALIZATION
  // =======================================

  let returnedObj = {};

  const getValid = (...values) => {
  for (let v of values) {
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
};

  switch (service) {
    case "INSTANTPAY": {
      const data = obj?.data?.binDetails;

      returnedObj = {
        bin: data?.bin,
        card_network: data?.cardNetwork,
        card_type: data?.cardType,
        card_level: data?.cardLevel
          ? data.cardLevel.replace(data.cardNetwork, "").trim()
          : null,
        country: data?.isoCountryName,
        country_iso2: data?.isoCountryA2,
        issuer_bank: data?.issuerBank,
        issuer_phone: getValid(data?.issuerPhone),
        issuer_website: getValid(data?.issuerWebsite),
      };
      break;
    }

    case "RAPID": {
      returnedObj = {
        bin: obj?.bin,
        card_network: obj?.brand,
        card_type: obj?.type,
        card_level: obj?.category || obj?.level,
        country: obj?.country,
        country_iso2: obj?.iso2,
        issuer_bank: obj?.issuer,
        issuer_phone: getValid(obj?.issuer_phone),
        issuer_website: getValid(obj?.issuer_url),
      };
      break;
    }

    case "RAPID2": {
      returnedObj = {
        bin: obj?.bin,
        card_network: obj?.brand,
        card_type: obj?.type,
        card_level: obj?.category || obj?.level,
        country: obj?.country,
        country_iso2: obj?.iso2,
        issuer_bank: obj?.issuer,
        issuer_phone: getValid(obj?.issuer_phone),
        issuer_website: getValid(obj?.issuer_url),
      };
      break;
    }
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
