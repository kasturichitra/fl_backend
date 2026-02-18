
const { generateTransactionId, callTruthScreenAPI } = require("../truthScreen/callTruthScreen");
const crypto = require("crypto");
const axios = require("axios");

const EASEBUZZ_KEY = process.env.EASEBUZZ_KEY;
const EASEBUZZ_SALT = process.env.EASEBUZZ_SALT;

const accountPennyLessSerciveResponse = async (data, services=[], index = 0) => {
    console.log('accountPennyLessSerciveResponse called');
    if (index >= services.length) {
        return { success: false, message: "All services failed" };
    }

    const newService = services.find((ser) => ser.priority === index + 1);

    if (!newService) {
        console.log(`No service with priority ${index + 1}, trying next`);
        return accountPennyLessSerciveResponse(data, services, index + 1);
    }

    const serviceName = newService.providerId || "";
    console.log(`[accountPennyLessSerciveResponse] Trying service with priority ${index + 1}:`, newService);

    try {
        const res = await accountPennyLessApiCall(data, serviceName);

        if (res?.success) {
            return res.data;
        }

        console.log(`[accountPennyLessSerciveResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`);
        return accountPennyLessSerciveResponse(data, services, index + 1);

    } catch (err) {
        console.log(`[accountPennyLessSerciveResponse] Error from ${serviceName}:`, err.message);
        return accountPennyLessSerciveResponse(data, services, index + 1);
    }
};

const accountPennyLessApiCall = async (data, service) => {
    const tskId = await generateTransactionId(12);
    const { account_no, ifsc } = data;
    const hashString = `${EASEBUZZ_KEY}|${account_no}|${ifsc}|${EASEBUZZ_SALT}`;

    console.log("hashString ===>>", hashString);
    const hash = crypto.createHash("sha512").update(hashString).digest("hex");
    console.log("hash ===>>", hash);

    const ApiData = {
        "INVINCIBLE": {
            BodyData: {
                bankAccount: account_no,
                ifsc: ifsc,
            },
            url: process.env.INVINCIBLE_ACC_PENNYLESS_URL,
            header: {
                accept: "application/json",
                clientId: process.env.INVINCIBLE_CLIENT_ID,
                secretKey: process.env.INVINCIBLE_SECRET_KEY,
            }
        },
        "TRUTHSCREEN": {
            BodyData: {
                transID: tskId,
                docType: "92",
                beneAccNo: account_no,
                ifsc: ifsc,
            },
            url: process.env.TRUTNSCREEN_ACC_PENNYLESS_URL,
            header: {
                username: process.env.TRUTHSCREEN_USERNAME,
                password: process.env.TRUTHSCREEN_TOKEN
            }
        }
    };


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
                password: config.header.password
            });
        } else {
            ApiResponse = await axios.post(
                config.url,
                config.BodyData,
                { headers: config.header }
            );
        }

    } catch (error) {
        console.log(`[accountPennyLessApiCall] API Error in ${service}:`, error.message);
        return { success: false, data: null };
    }

    const obj = ApiResponse?.data || ApiResponse;
    console.log(`[accountPennyLessApiCall] ${service} Response Object:`, JSON.stringify(obj));


    // If truthscreen/others return invalid code
    if (obj?.response_code === "101") {
        return {
            success: false,
            data: {
                result: {},
                message: "Invalid",
                responseOfService: obj,
                service: service,
            }
        };
    }

    /** -------------------------
     *  RESULT NORMALIZATION
     * ------------------------- */

    let returnedObj = {};

    switch (service) {

        case "INVINCIBLE":
            returnedObj = {
                name: obj?.result?.data?.nameAtBank || null,
                status: obj?.result?.accountStatus || null,
                success: obj?.result?.subCode === 200,
                message:
                    obj?.result?.message ||
                    ApiResponse.message ||
                    "Transaction Successful",
                account_no: account_no || null,
                ifsc: ifsc || null,
            };
            break;

        case "TRUTHSCREEN":
            returnedObj = {
                name: ApiResponse?.msg.name || null,
                status: ApiResponse?.msg.status || null,
                success:
                    (ApiResponse?.status === 1 &&
                        ApiResponse?.msg?.description?.toLowerCase().includes("success")) ||
                    false,
                message: ApiResponse?.msg?.description || "Transaction Successful",
                account_no: account_no || null,
                ifsc: ifsc || null,
            };
            break;
    }

    return {
        success: true,
        data: {
            result: returnedObj,
            message: "Valid",
            responseOfService: obj,
            service: service,
        }
    };
};

module.exports = {
    accountPennyLessSerciveResponse
};
