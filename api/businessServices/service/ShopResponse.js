const { generateTransactionId } = require("../../truthScreen/callTruthScreen");
const { default: axios } = require("axios");

const shopActiveServiceResponse = async (
  data,
  services,
  index = 0,
  client = "",
) => {
  console.log("shopActiveServiceResponse called");
  if (index >= services?.length) {
    return { success: false, message: "All services failed" };
  }

  const newService = services?.find((ser) => ser.priority === index + 1);

  if (!newService) {
    console.log(`No service with priority ${index + 1}, trying next`);
    return shopActiveServiceResponse(data, services, index + 1);
  }

  const serviceName = newService.providerId || "";
  console.log(
    `[shopActiveServiceResponse] Trying service with priority ${index + 1}:`,
    newService,
  );

  try {
    const res = await shopApiCall(data, serviceName, (client = ""));

    if (res?.success) {
      return res.data;
    }

    console.log(
      `[shopActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`,
    );
    return shopActiveServiceResponse(data, services, index + 1);
  } catch (err) {
    console.log(
      `[shopActiveServiceResponse] Error from ${serviceName}:`,
      err.message,
    );
    return shopActiveServiceResponse(data, services, index + 1);
  }
};

const stateList = {
  DELHI: 1,
  HARYANA: 2,
  KARNATAKA: 3,
  TELANGANA: 4,
  UTTRAKHAND: 6,
  "UTTAR PRADESH": 7,
  "ANDAMAN & NICOBAR": 9,
};

const getState = (state) => {
  const upperState = state?.toUpperCase();
  const foundState = stateList[upperState];
  return foundState;
};

const shopApiCall = async (data, service, CID = "") => {
  const tskId = await generateTransactionId(12);

  console.log("data in active service for shop establishment ===>>", data)

  const ApiData = {
    INVINCIBLE: {
      BodyData: data,
      url: process.env.INVINCIBLE_SHOP_URL,
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
        docType: 20,
        docNumber: data?.registrationNumber,
        state: getState(data?.state),
      },
      url: process.env.TRUTNSCREEN_UTILITY_URL,
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
    console.log("all call started with priorities")
    if (service == "TRUTHSCREEN") {
      ApiResponse = await callTruthScreenAPI({
        url: config.url,
        payload: config.BodyData,
        username: config.header.username,
        password: config.header.token,
        cId: CID
      });
    } else {
      ApiResponse = await axios.post(config.url, config.BodyData, {
        headers: config.header,
      });
    }
  } catch (error) {
    return { success: false, data: null }; // fallback trigger
  }

  console.log(`[shopApiCall] ${service} Response Object:`, JSON.stringify(ApiResponse));
  const obj = ApiResponse.data || ApiResponse;
  console.log(`[shopApiCall] ${service} Response Object:`, JSON.stringify(obj));

  let returnedObj = {};

  switch (service) {
    case "INVINCIBLE":
      returnedObj = {
        nameOfShop: obj?.result || "",
        business_constitution:
          obj?.result?.result?.gstnDetailed?.constitutionOfBusiness || "",
        central_jurisdiction: obj?.result?.result,
      };
      break;
    case "TRUTHSCREEN":
      returnedObj = {
        nameOfShop: obj?.result || "",
        business_constitution:
          obj?.result?.result?.gstnDetailed?.constitutionOfBusiness || "",
      };
      break;
  }
  return {
    success: true,
    data: {
      registrationNumber: data || "",
      result: returnedObj,
      message: "Valid",
      responseOfService: obj,
      service: service,
    },
  };
};

module.exports = {
  shopActiveServiceResponse,
};
