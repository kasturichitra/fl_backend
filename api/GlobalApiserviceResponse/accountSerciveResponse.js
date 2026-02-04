
const { generateTransactionId, callTruthScreenAPI } = require("../truthScreen/callTruthScreen");
const crypto = require("crypto");
const axios = require("axios");
const EASEBUZZ_KEY = process.env.EASEBUZZ_KEY;
const EASEBUZZ_SALT = process.env.EASEBUZZ_SALT;
const ZOOPClientId = process.env.ZOOP_APP_ID;
const ZOOP_API_KEY = process.env.ZOOP_API_KEY;

const accountActiveServiceResponse = async (data, services, index = 0) => {
    if (index >= services?.length) {
        return { success: false, message: "All services failed" };
    }

    const newService = services?.find((ser) => ser.priority === index + 1);

    if (!newService) {
        console.log(`[accountActiveServiceResponse] No service with priority ${index + 1}, trying next`);
        return accountActiveServiceResponse(data, services, index + 1);
    }

    const serviceName = newService.providerId || "";
    console.log(`[accountActiveServiceResponse] Trying service with priority ${index + 1}:`, newService);

    try {
        const res = await accountApiCall(data, serviceName);

        if (res?.success) {
            return res.data;
        }

        console.log(`[accountActiveServiceResponse] ${serviceName} responded failure. Data: ${JSON.stringify(res)} → trying next service`);
        return accountActiveServiceResponse(data, services, index + 1);

    } catch (err) {
        return accountActiveServiceResponse(data, services, index + 1);
    }
};

const accountApiCall = async (data, service) => {
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
            url: process.env.INVINCIBLE_ACC_URL,
            header: {
                accept: "application/json",
                clientId: process.env.INVINCIBLE_CLIENT_ID,
                secretKey: process.env.INVINCIBLE_SECRET_KEY,
            }
        },
        "ZOOP": {
            BodyData: {
                mode: "sync",
                data: {
                    account_number: account_no,
                    ifsc: ifsc,
                    consent: "Y",
                    consent_text:
                        "I hereby declare my consent agreement for fetching my information via ZOOP API",
                },
                task_id: tskId,
            },
            url: process.env.ZOOP_ACCOUNTVERIFY_URL,
            header: {
                "app-id": ZOOPClientId,
                "api-key": ZOOP_API_KEY,
                "Content-Type": "application/json",
            }
        },
        "CASHFREE": {
            BodyData: {
                bank_account: account_no,
                ifsc: ifsc,
            },
            url: process.env.CASHFREE_ACC_URL,
            header: {
                "x-client-id": process.env.CASHFREE_CLIENT_ID_AC_VERIFY,
                "x-client-secret": process.env.CASHFREE_CLIENT_SECRET_AC_VERIFY,
                "Content-Type": "application/json",
            }
        },
        "EASEBUZZ": {
            BodyData: {
                key: EASEBUZZ_KEY,
                account_no: account_no,
                ifsc: ifsc,
            },
            url: process.env.EASEBUZZ_ACC_URL,
            header: {
                headers: {
                    Authorization: hash,
                },
            }
        },
        "TRUTHSCREEN": {
            BodyData: {
                transID: tskId,
                docType: "92",
                beneAccNo: account_no,
                ifsc: ifsc,
            },
            url: process.env.TRUTNSCREEN_ACC_URL,
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
        console.log(`[accountApiCall] API Error in ${service}:`, error.message);
        return { success: false, data: null };
    }

    const obj = ApiResponse?.data || ApiResponse;
    console.log(`[accountApiCall] ${service} Response Object:`, JSON.stringify(obj));


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

        case "ZOOP":
            returnedObj = {
                name: obj?.result.beneficiary_name || null,
                status: obj?.result.verification_status || null,
                success: obj.success === true && obj.response_code === "100",
                message:
                    obj.response_message ||
                    obj?.result.transaction_remark ||
                    "Transaction Successful",
                account_no: account_no || null,
                ifsc: ifsc || null,
            };
            break;

        case "EASEBUZZ":
            returnedObj = {};
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
        case "CASHFREE":
            returnedObj = {
                name: obj.name_at_bank || null,
                status: obj.account_status || null,
                success: true,
                message: "Transaction Successful",
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
    accountActiveServiceResponse
};
