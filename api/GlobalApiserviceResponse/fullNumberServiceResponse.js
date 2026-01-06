const axios = require("axios");
const { findingInValidResponses } = require("../../utlis/InvalidResponses");

const fullNumberServiceResponse = async (data, services, index = 0) => {
  if (index >= services.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return fullNumberServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(`Trying service:`, newService);

  try {
    const res = await FullNumberApiCall(data, serviceName);

    if (res?.success) {
      return res.data;
    }

    console.log(`${serviceName} responded failure → trying next`);
    return fullNumberServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(`Error from ${serviceName}:`, err.message);
    return fullNumberServiceResponse(data, services, index + 1);
  }
};

// =======================================
//         BIN API CALL (ALL SERVICES)
// =======================================

const FullNumberApiCall = async (data, service) => {
  const ApiData = {
    RAPID: {
      url: process.env.RAPID_FULLCARDVERIFICATION_URL,
      header: {
        "x-rapidapi-key": process.env.RAPID_API_KEY,
        "x-rapidapi-host": "cardverify.p.rapidapi.com",
      },
      method: "GET",
    },
    INVINCIBLE: {
      BodyData: { card_num: data },
      url: process.env.INVINCIBLE_FULLCARDVERIFICATION_URL,
      header: {
        clientId: process.env.INVINCIBLE_CLIENT_ID,
        secretKey: process.env.INVINCIBLE_SECRET_KEY,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  };

  if (!service?.trim()) {
    service = Object.keys(ApiData)[0];
    console.log("Empty provider → defaulting to:", service);
  }

  const config = ApiData[service];
  if (!config) throw new Error(`Invalid service: ${service}`);

  let ApiResponse;

  try {
    if (config.method === "POST") {
      ApiResponse = await axios.post(config.url, config.BodyData, {
        headers: config.header,
      });
    } else {
      const urlWithCard = `${config.url}${data}`;
      ApiResponse = await axios.get(urlWithCard, { headers: config.header });
    }
  } catch (error) {
    console.log("API Error:", error);
    if(service?.toLowerCase() == "invincible" && error.status == 404){
      return {
        success: false,
        data: {
          result: findingInValidResponses("fullCard"),
          message: "Invalid",
          responseOfService: raw || {},
          service,
        },
      };
    } else{
      throw error;
    }
  }

  const obj = ApiResponse?.data || ApiResponse;
  console.log(`Response—${service}:`, obj);

  // ===============================
  //  Conditional invalid handling
  // ===============================
  if (service === "RAPID") {
    if (!obj?.is_valid) return invalidResponse(service, obj);
    return {
      success: true,
      data: {
        result: {
          cardNumber: obj?.card_number || "",
          is_Valid: obj?.is_valid,
          Brand: obj?.issuer_info?.Brand || "",
          Type: obj?.issuer_info?.Type || "",
          Category:
            obj?.issuer_info?.Category || obj?.brand?.split(" ")[1] || "",
          CountryName: obj?.issuer_info?.CountryName || obj?.country || "",
          Issuer: obj?.issuer_info?.Issuer || "",
        },
        message: "Valid",
        responseOfService: obj,
        service,
      },
    };
  }

  if (service === "INVINCIBLE") {
    if (!obj?.result?.is_verified) return invalidResponse(service, obj);
    return {
      success: true,
      data: {
        result: {
          cardNumber: obj?.result?.card || "",
          is_Verified: obj?.result?.is_verified,
          Brand: obj?.result?.brand || obj?.result?.provider || "",
          Type: obj?.result?.type || "",
          Category: obj?.result?.brand?.split(" ")[1] || "",
          CountryName: obj?.result?.country || "",
          Issuer: "",
        },
        message: "Valid",
        responseOfService: obj,
        service,
      },
    };
  }

  // fallback for unknown service
  return invalidResponse(service, obj);
};

// =======================================
// INVALID RESPONSE HANDLER (REUSABLE)
// =======================================
const invalidResponse = (service, raw) => ({
  success: false,
  data: {
    result: findingInValidResponses("fullCard"),
    message: "Invalid",
    responseOfService: raw || {},
    service,
  },
});

module.exports = {
  fullNumberServiceResponse,
};
