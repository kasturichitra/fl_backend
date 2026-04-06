const { bankServiceLogger } = require("../../Logger/logger");
const {
  generateTransactionId,
  callTruthScreenAPI,
} = require("../../truthScreen/callTruthScreen");
const { default: axios } = require("axios");

const IfscActiveServiceResponse = async (
  data,
  services = [],
  index = 0,
  client,
) => {
  console.log("IfscActiveServiceResponse called");
  bankServiceLogger.info(`IfscActiveServiceResponse called for this client: ${client}`);
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return IfscActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[IfscActiveServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await ifscApiCall(data, serviceName, client);

    if (res?.data) {
      return res.data;
    }

    console.log(
      `[IfscActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return IfscActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[IfscActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return IfscActiveServiceResponse(data, services, index + 1);
  }
};

const ifscApiCall = async (data, service, CID) => {
  const tskId = await generateTransactionId(12);
  const ApiData = {
    RAPID: {
      url: RAPID_IFSC_SEARCH,
      header: {
        "x-rapidapi-key": process.env.RAPID_API_KEY,
        "x-rapidapi-host": process.env.RAPID_API_BANK_HOST,
      },
    },
    TRUTHSCREEN: {
      BodyData: {
        transID: tskId,
        docType: 123,
        docNumber: data,
      },
      url: process.env.TRUTHSCREEN_IFSC_SEARCH, // DIN URL is similar to the Tin
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
        cId: CID,
      });
      console.log(
        "[ifscApiCall] TruthScreen API response:",
        JSON.stringify(ApiResponse),
      );
    } else {
      const urlWithCard = `${config.url}${data}`;
      ApiResponse = await axios.get(urlWithCard, { headers: config.header });
      console.log(
        `[ifscApiCall] ${service} API response success:`,
        JSON.stringify(ApiResponse.data),
      );
    }
  } catch (error) {
    console.log(`[ifscApiCall] API Error in ${service}:`, error.message);
    return { success: false, data: null }; // fallback trigger
  }

  const obj = ApiResponse.data || ApiResponse;
  console.log(`[ifscApiCall] ${service} Response Object:`, JSON.stringify(obj));
  // Format responses by provider
  let returnedObj = {};

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

  if (obj.status != 1) {
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

  switch (service) {
    case "RAPID":
      returnedObj = {
        panNumber: data,
        aadhaarNumber: obj?.result?.aadhaar,
        response: obj,
      };
      break;

    case "TRUTHSCREEN":
      returnedObj = {
        panNumber: data,
        aadhaarNumber: obj?.result?.aadhaar,
        response: obj,
      };
      break;
  }

  return {
    success: true,
    data: {
      result: returnedObj,
      message: "Valid",
      responseOfService: obj?.result || obj,
      service: service,
    },
  };
};

module.exports = {
  IfscActiveServiceResponse,
};
