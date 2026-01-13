const { generateTransactionId } = require("../truthScreen/callTruthScreen");
const { default: axios } = require("axios");

const IfscActiveServiceResponse = async (data, services, index = 0) => {
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return IfscActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(`Trying service:`, newService);

  try {
    const res = await ifscApiCall(data, serviceName, 0);

    if (res?.success) {
      return res.data;
    }

    console.log(`${serviceName} responded failure → trying next`);
    return IfscActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(`Error from ${serviceName}:`, err.message);
    return IfscActiveServiceResponse(data, services, index + 1);
  }
};

const ifscApiCall = async (data, service) => {

  const ApiData = {
    RAPID: {
      url: `https://ifsc-lookup-api.p.rapidapi.com/`,
      header: {
        "x-rapidapi-key": RapidApiKey,
        "x-rapidapi-host": RapidApiBankHost,
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
    const urlWithCard = `${config.url}${data}`;
    ApiResponse = await axios.get(urlWithCard, { headers: config.header });
    console.log("Api response success ===>", ApiResponse.data);
  } catch (error) {
    console.log("Api Response ==>", error);
    return { success: false, data: null }; // fallback trigger
  }

  const obj = ApiResponse.data;
  console.log("obj ==>", obj);
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

  switch (service) {
    case "RAPID":
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
      responseOfService: obj?.result,
      service: service,
    },
  };
};

module.exports = {
  IfscActiveServiceResponse,
};
