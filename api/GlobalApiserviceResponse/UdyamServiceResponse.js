const { generateTransactionId } = require("../truthScreen/callTruthScreen")
const { default: axios } = require("axios");

const udyamActiveServiceResponse = async (data, services, index = 0) => {
    if (index >= services?.length) {
        return { success: false, message: "All services failed" };
    }

    const newService = services?.find((ser) => ser.priority === index + 1);

    if (!newService) {
        console.log(`No service with priority ${index + 1}, trying next`);
        return udyamActiveServiceResponse(data, services, index + 1);
    }

    const serviceName = newService.providerId || "";
    console.log(`Trying service:`, newService);

    try {
        const res = await udyamApiCall(data, serviceName, 0);

        if (res?.success) {
            return res.data;
        }

        console.log(`${serviceName} responded failure → trying next`);
        return udyamActiveServiceResponse(data, services, index + 1);

    } catch (err) {
        console.log(`Error from ${serviceName}:`, err.message);
        return udyamActiveServiceResponse(data, services, index + 1);
    }
};

const udyamApiCall = async (data, service) => {
    const transID = generateTransactionId(12);

    const ApiData = {
        "INVINCIBLE": {
            BodyData: { udyamNumber: data },
            url: "https://api.invincibleocean.com/invincible/msmeUdyamDetails",
            header: {
                accept: "application/json",
                clientId: process.env.INVINCIBLE_CLIENT_ID,
                secretKey: process.env.INVINCIBLE_SECRET_KEY,
            }
        },
        "TRUTHSCREEN": {
            BodyData: {
                transID,
                docType: 435,
                udyamNumber: data,
            },
            url: "https://www.truthscreen.com/UdyamApi/idsearch",
        }
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
        ApiResponse = await axios.post(
            config.url,
            config.BodyData,
            { headers: config.header }
        );
    } catch (error) {
        console.log('error Response===>', error)
        return { success: false, data: null }; // fallback trigger
    }

    const obj = ApiResponse.data;
    console.log('obj ==>', obj)

    let returnedObj = {};

    if (obj.response_code === "101") {
        return {
            success: false,
            data: {
                result: "NoDataFound",
                message: "Invalid",
                responseOfService: {},
                service: service,
            }
        };
    }

    switch (service) {
        case "INVINCIBLE":
            returnedObj = {
                udyam: data,
                "Date of Commencement of Production/Business":
                    obj?.result["Date of Commencement of Production/Business"],
                "Date of Incorporation": obj?.result["Date of Incorporation"],
                "Date of Udyam Registration": obj?.result["Date of Udyam Registration"],
                "MSME-DFO": obj?.result["MSME-DFO"],
                "Major Activity": obj?.result["Major Activity"],
                "Name of Enterprise": obj?.result["Name of Enterprise"],
                "Organisation Type": obj?.result["Organisation Type"],
                "Social Category": obj?.result["Social Category"],
                "Enterprise Type": obj?.result["Enterprise Type"]?.map((item) => ({
                    "Classification Date": item["Classification Date"],
                    "Classification Year": item["Classification Year"],
                    "Enterprise Type": item["Enterprise Type"],
                })),
                "National Industry Classification Code(S)": obj?.result[
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
                        obj?.result["Official address of Enterprise"]?.["Flat/Door/Block No."] ||
                        null,
                    "Name of Premises/ Building":
                        obj?.result["Official address of Enterprise"]?.[
                        "Name of Premises/ Building"
                        ] || null,
                    "Village/Town":
                        obj?.result["Official address of Enterprise"]?.["Village/Town"] || null,
                    Block: obj?.result["Official address of Enterprise"]?.["Block"] || null,
                    "Road/Street/Lane":
                        obj?.result["Official address of Enterprise"]?.["Road/Street/Lane"] ||
                        null,
                    City: obj?.result["Official address of Enterprise"]?.["City"] || null,
                    State: obj?.result["Official address of Enterprise"]?.["State"] || null,
                    District:
                        obj?.result["Official address of Enterprise"]?.["District"] || null,
                    Mobile: obj?.result["Official address of Enterprise"]?.["Mobile"] || null,
                    Email: obj?.result["Official address of Enterprise"]?.["Email"] || null,
                },
            };
            break;
        case "TRUTHSCREEN":
            returnedObj = {
                udyam: udyamNumber,
                "Date of Commencement of Production/Business":
                    obj?.udyamData["Date of Commencement of Production/Business"],
                "Date of Incorporation": obj?.udyamData["Date of Incorporation"],
                "Date of Udyam Registration": obj?.udyamData["Date of Udyam Registration"],
                "MSME-DFO": obj?.udyamData["MSME-DFO"],
                "Major Activity": obj?.udyamData["Major Activity"],
                "Name of Enterprise": obj?.udyamData["Name of Enterprise"],
                "Organisation Type": obj?.udyamData["Organisation Type"],
                "Social Category": obj?.udyamData["Social Category"],
                "Enterprise Type": obj?.udyamData["Enterprise Type"]?.map((item) => ({
                    "Classification Date": item["Classification Date"],
                    "Classification Year": item["Classification Year"],
                    "Enterprise Type": item["Enterprise Type"],
                })),
                "National Industry Classification Code(S)": obj?.udyamData[
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
                        obj?.udyamData["Official address of Enterprise"]?.[
                        "Flat/Door/Block No"
                        ] || null,
                    "Name of Premises/ Building":
                        obj?.udyamData["Official address of Enterprise"]?.[
                        "Name of Premises/ Building"
                        ] || null,
                    "Village/Town":
                        obj?.udyamData["Official address of Enterprise"]?.["Village/Town"] ||
                        null,
                    Block: obj?.udyamData["Official address of Enterprise"]?.["Block"] || null,
                    "Road/Street/Lane":
                        obj?.udyamData["Official address of Enterprise"]?.["Road/Street/Lane"] ||
                        null,
                    City: obj?.udyamData["Official address of Enterprise"]?.["City"] || null,
                    State: obj?.udyamData["Official address of Enterprise"]?.["State"] || null,
                    District:
                        obj?.udyamData["Official address of Enterprise"]?.["District"] || null,
                    Mobile:
                        obj?.udyamData["Official address of Enterprise"]?.["Mobile"] || null,
                    Email: obj?.udyamData["Official address of Enterprise"]?.["Email"] || null,
                },
            }
            break;
    }
    return {
        success: true,
        data: {
            udyamNumber: data || "",
            result: returnedObj,
            message: "Valid",
            responseOfService: obj,
            service: service,
        }
    };
};

module.exports = {
    udyamActiveServiceResponse,
}
