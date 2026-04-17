const dotenv = require("dotenv");
const axios = require("axios");
const { ERROR_CODES } = require("../../../utils/errorCodes");
const WalletModel = require("../Model.js/WalletModel");
const { walletTopupLogger } = require("../../Logger/logger");
const moment = require("moment")
const CLIENT_CODE = process.env.CLIENT_CODE;
const SECRET_KEY = process.env.SECRET_KEY;
const KVB_URL = process.env.KVB_URL;
const KVB_TOKEN_URL = process.env.KVB_TOKEN_URL;
const STATICQR_URL = process.env.STATICQR_URL
const DYNAMICQR_URL = process.env.DYNAMICQR_URL
const clientID = CLIENT_CODE;

console.log("STATICQR_URL", STATICQR_URL)
// exports.GenerateToken = async(req,res)=>{
const GenerateToken = async () => {
    try {
        const clientID = CLIENT_CODE;
        console.log("clientId:", clientID);

        walletTopupLogger.info("GenerateToken function called", { clientID });
        const existingToken = await WalletModel.findOne({
            type: "TOKEN",
            clientID,
        }).sort({ createdAt: -1 });

        console.log("existingToken:", existingToken);

        if (existingToken && existingToken.expiresAt) {
            const expiresAtSeconds = Math.floor(existingToken.expiresAt.getTime() / 1000);
            const nowSeconds = Math.floor(Date.now() / 1000);
            if (expiresAtSeconds - 60 > nowSeconds) {
                console.log("Using existing token");
                return existingToken.accessToken;
            }
        }

        console.log("Generating new token");
        const base64Auth = Buffer.from(`${CLIENT_CODE}:${SECRET_KEY}`).toString("base64");
        const response = await axios.post(
            KVB_TOKEN_URL,
            "grant_type=client_credentials",
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: `Basic ${base64Auth}`,
                },
            }
        );

        const apiData = response.data;
        console.log("Token API response:", apiData);
        const expiresAt = new Date(Date.now() + apiData.expiresIn * 1000);
        console.log("expiresAt", expiresAt)
        const tokenDetails = {
            clientID,
            type: "TOKEN",
            accessToken: apiData.accessToken,
            tokenType: apiData.tokenType,
            expiresAt,
            status: "SUCCESS",
        };
        const datasaved = await WalletModel.findOneAndUpdate(
            { type: "TOKEN", clientID },
            tokenDetails,
            { new: true, upsert: true }
        );

        console.log("Token saved:", datasaved._id);
        walletTopupLogger.info("Token stored/updated", { datasaved });

        return datasaved.accessToken;

    } catch (error) {
        console.error("GenerateToken Error:", error.response?.data || error.message);
        walletTopupLogger.error("GenerateToken failed", {
            error: error.response?.data || error.message,
        });
        throw error;
    }
};
exports.GenerateStaticQr = async (req, res) => {
    try {
        console.log("========== STATIC QR API START ==========");

        const clientID = process.env.CLIENT_CODE || CLIENT_CODE;
        console.log("ClientID (from env):", clientID);

        walletTopupLogger.info("Static QR API called", { clientID });

        if (!clientID) {
            console.log("Missing clientID in environment");

            return res.status(400).json({
                success: false,
                message: "clientID is required in environment",
            });
        }

        console.log("Fetching access token...");
        const accessToken = await GenerateToken();
        console.log("accessToken:", accessToken);
        console.log("Access Token fetched");

        console.log("Calling KVB Static QR API...");

        const response = await axios.post(
            STATICQR_URL,
            { clientId: clientID },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const apiData = response.data;
        console.log("response in staticQR:", apiData);

        console.log("KVB Response Status:", apiData.status);
        console.log("KVB Message:", apiData.responseMessage);

        walletTopupLogger.info("Static QR API response", { apiData });

        if (apiData.status !== 1) {
            console.log("Static QR generation failed");

            walletTopupLogger.warn("Static QR failed from provider", { apiData });

            return res.status(400).json({
                success: false,
                message: apiData.responseMessage || "Static QR failed",
            });
        }

        const qrDetails = {
            clientID,
            type: "STATIC_QR",
            merchantId: apiData.data?.merchantId,
            payeeAddress: apiData.data?.payeeAddress,
            payeeName: apiData.data?.payeeName,
            qrCode: apiData.data?.qrCode,
            status: "SUCCESS",
        };

        console.log("Preparing DB object...");
        console.log("MerchantId:", qrDetails.merchantId);
        console.log("Payee:", qrDetails.payeeName);

        const datasaved = await WalletModel.findOneAndUpdate(
            { type: "STATIC_QR", clientID },
            qrDetails,
            { new: true, upsert: true }
        );

        console.log("Saved to DB with ID:", datasaved._id);

        walletTopupLogger.info("Static QR saved in DB", { datasaved });

        console.log("========== STATIC QR SUCCESS ==========\n");
        return res.status(200).json({
            success: true,
            message: "Static QR generated successfully",
            data: apiData.data,
        });

    } catch (error) {
        console.log("========== STATIC QR ERROR ==========");

        console.error("Error Message:", error.message);

        if (error.response) {
            console.error("API Error Response:", error.response.data);
        }

        walletTopupLogger.error("Static QR failed", {
            error: error.response?.data || error.message,
        });

        console.log("=====================================\n");

        return res.status(500).json({
            success: false,
            message: "Failed to generate static QR",
            error: error.response?.data || error.message,
        });
    }
};
exports.GenerateDynamicQr = async (req, res) => {

    try {
        console.log("========== DYNAMIC QR API START ==========");
        const clientID = process.env.CLIENT_CODE || CLIENT_CODE;
        console.log("ClientID (from env):", clientID);

        console.log("Request Body:", req.body);

        walletTopupLogger.info("Dynamic QR API called", {
            clientID,
            body: req.body,
        });

        const { amount, geo_code, geo_location } = req.body;

        if (!amount) {
            return res.status(400).json({ success: false, message: "amount is required" });
        }
        console.log("amount", amount)
        const accessToken = await GenerateToken();
        console.log("accessToken in geneartedynamicQr", accessToken)


        const dynamicQrPayload = {
            amount: Number(amount),
            currency: "INR",
            geo_code: geo_code || "",
            geo_location: geo_location || ""
        };

        const response = await axios.post(DYNAMICQR_URL, dynamicQrPayload, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            }
        });

        const apiData = response.data;
        console.log("response dynamicQR:", apiData);

        console.log("KVB Response Status:", apiData.status);
        console.log("KVB Message:", apiData.responseMessage);

        walletTopupLogger.info("Dynamic QR API response", { apiData });

        if (apiData.status !== 1) {
            console.log("Dynamic QR failed from provider");

            walletTopupLogger.warn("Dynamic QR failed from API", { apiData });

            return res.status(400).json({
                success: false,
                message: apiData.responseMessage || "Dynamic QR failed",
            });
        }

        const qrDetails = {
            clientID,
            type: "DYNAMIC_QR",
            amount: Number(amount),
            currency: "INR",
            orderId: apiData.data?.orderId,
            payeeAddress: apiData.data?.payeeAddress,
            payeeName: apiData.data?.payeeName,
            qrCode: apiData.data?.qrCode,
            status: "PENDING", // important
            geo_code: geo_code || "",
            geo_location: geo_location || "",
            rawResponse: apiData,
        };

        console.log("Preparing DB object...");
        console.log("OrderId:", qrDetails.orderId);
        console.log("Amount:", qrDetails.amount);

        const datasaved = await WalletModel.create(qrDetails);

        console.log("Saved Dynamic QR in DB:", datasaved._id);

        walletTopupLogger.info("Dynamic QR saved in DB", { datasaved });

        console.log("========== DYNAMIC QR SUCCESS ==========\n");
        return res.status(200).json({
            success: true,
            message: "Dynamic QR generated successfully",
            data: apiData.data,

        });

    } catch (error) {
        console.log("========== DYNAMIC QR ERROR ==========");
        console.log("error", error)
        console.error("Error Message:", error.message);

        if (error.response) {
            console.error("API Error Response:", error.response.data);
        }

        walletTopupLogger.error("Dynamic QR failed", {
            error: error.response?.data || error.message,
        });

        console.log("=====================================\n");

        return res.status(500).json({
            success: false,
            message: "Failed to generate dynamic QR",
            error: error.response?.data || error.message,
        });
    }
};
exports.webhookForupi = async (req, res) => {
  console.log("========== WEBHOOK HIT ==========");

  try {
    console.log("Headers:", req.headers);
    console.log("Request Body:", req.body);
    const { txnId, status, amount } = req.body;

    console.log("Transaction Details:");
    console.log("Txn ID:", txnId);
    console.log("Status:", status);
    console.log("Amount:", amount);

    console.log("========== WEBHOOK SUCCESS ==========\n");

    return res.status(200).json({
      success: true,
      message: "Webhook received"
    });

  } catch (error) {
    console.log("========== WEBHOOK ERROR ==========");
    console.error(" Error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Webhook failed"
    });
  }
};

// exports.GenerateToken = async (req, res) => {
//     const clientID = req.clientId
//     console.log("clientID in token",clientID)
//     try {
//         walletTopupLogger.info("GenerateToken API called");
//         console.log("GenerateToken API called")
//         const base64Auth = Buffer.from(`${CLIENT_CODE}:${SECRET_KEY}`).toString("base64");
//         console.log("base64Auth==>", base64Auth)
//         const response = await axios.post(
//             `http://10.1.1.155:3000/inboundpayments/oauth/accesstoken/api/v1`,
//             "grant_type=client_credentials",
//             {
//                 headers: {
//                     "Content-Type": "application/x-www-form-urlencoded",
//                      Authorization: `Basic ${base64Auth}`,
//                 },
//             }
//         );
//         console.log("response", response)
//         console.log("responsedata", response.data)
//         const apiData = response.data;

//         walletTopupLogger.info("Token API response received", { apiData });
//               const expiresAt = new Date(Date.now() + apiData.expiresIn * 1000);

//         const tokendetails = {
//             clientID,
//             type: "TOKEN",
//             accessToken: apiData.accessToken,
//             tokenType: apiData.tokenType,
//             expiresAt,
//             status: "SUCCESS",
//         };

//         const datasaved = await WalletModel.create(tokendetails);
//         console.log("datasaved",datasaved)
//         walletTopupLogger.info("Token stored in DB", { datasaved });

//         return res.status(200).json({
//             success: true,
//             data: apiData,
//         });

//     } catch (error) {
//         console.log("server error",error)
//         walletTopupLogger.error("GenerateToken failed", {
//             error: error.response?.data || error.message,
//         });

//         return res.status(500).json({
//             success: false,
//             message: "Failed to generate token",
//             error: error.response?.data || error.message,
//         });
//     }
// };

// exports.GenerateToken = async (req, res) => {
//     const clientID = req.clientId;
//     console.log("clientId", clientID)
//     try {
//         walletTopupLogger.info("GenerateToken API called", { clientID });

//         const existingToken = await WalletModel.findOne({
//             type: "TOKEN",
//             clientID,
//         }).sort({ createdAt: -1 });
//         console.log("existing client", existingToken)
//         if (
//             existingToken &&
//             existingToken.expiresAt &&
//             new Date() < new Date(existingToken.expiresAt)
//         ) {
//             walletTopupLogger.info("Using existing valid token");
//             console.log("Using existing valid token")
//             return res.status(200).json({
//                 success: true,
//                 message: "Using existing token",
//                 data: {
//                     accessToken: existingToken.accessToken,
//                     tokenType: existingToken.tokenType,
//                     expiresAt: existingToken.expiresAt,
//                 },
//             });
//         }
//         walletTopupLogger.info("Generating new token");
//         const base64Auth = Buffer.from(`${CLIENT_CODE}:${SECRET_KEY}`).toString("base64");
//         console.log("base64Auth in generatetoken", base64Auth)
//         const response = await axios.post(
//             KVB_TOKEN_URL,
//             "grant_type=client_credentials",
//             {
//                 headers: {
//                     "Content-Type": "application/x-www-form-urlencoded",
//                     Authorization: `Basic ${base64Auth}`,
//                 },
//             }
//         );
//         console.log("response in generate", response)
//         console.log("response in generate data", response.data)
//         const apiData = response.data;
//         const expiresAt = new Date(apiData.expiresIn * 1000);
//         const createdAt = moment().format("YYYY-MM-DD HH:mm:ss");
//         const tokendetails = {
//             clientID,
//             type: "TOKEN",
//             accessToken: apiData.accessToken,
//             tokenType: apiData.tokenType,
//             expiresAt: new Date(apiData.expiresIn * 1000),
//             status: "SUCCESS",
//             createdAt
//         };

//         const datasaved = await WalletModel.findOneAndUpdate(
//             { type: "TOKEN", clientID },
//             tokendetails,
//             {
//                 new: true,
//                 upsert: true,
//             }
//         );
//         console.log("datasaved in generatetoken", datasaved)
//         walletTopupLogger.info("New token stored", { datasaved });

//         return res.status(200).json({
//             success: true,
//             message: "token generated",
//             data: apiData,
//         });

//     } catch (error) {
//         walletTopupLogger.error("GenerateToken failed", {
//             error: error.response?.data || error.message,
//         });

//         return res.status(500).json({
//             success: false,
//             message: "Failed to generate token",
//             error: error.response?.data || error.message,
//         });
//     }
// };