const requestIp = require('request-ip');
const redisClient = require('../utils/redis');
const { commonLogger } = require('../api/Logger/logger');
const axios = require('axios');
require('dotenv').config();

const SUPERADMIN_URL = process.env.SUPERADMIN_URL;

const jwt = require("jsonwebtoken");

const clientValidation = async (req, res, next) => {
    const accessToken = req.headers["secret_token"];
    commonLogger.info(`Client Validation (Whitelist) called with token:`);
    try {
        // 1. Extract IP
        let ip = requestIp.getClientIp(req);
        ip = ip.includes("::ffff:") ? ip.split("::ffff:")[1] : ip;
        if (ip === "::1") ip = "127.0.0.1";

        if (!accessToken) {
            commonLogger.warn(`IP Check: Missing secret_token for IP ${ip}`);
            return res.status(400).json({ message: "Missing secret_token header." });
        }

        // Decode token to get clientId
        const decodedToken = jwt.verify(accessToken, process.env.JWT_SECRET_KEY);
        const { clientId, clientSecret,
            //  environment 
        } = decodedToken;

        if (!clientId || !clientSecret) {
            commonLogger.warn("Invalid token structure.")
            return res.status(400).json({ message: "Invalid token structure." });
        }
        console.log('Accesstoken decode value  ---->',clientId,'   ****     ',clientSecret)

        const redisKey = `client:${clientId}`;

        // 2. Check Redis Cache
        let isWhitelisted = false;
        try {
            const cachedData = await redisClient.get(redisKey);
            console.log('cachedDataObj', cachedData)
            if (cachedData) {
                const cachedDataObj = JSON.parse(cachedData);
                const ips = Array.isArray(cachedDataObj) ? cachedDataObj : (cachedDataObj.allIps || []);
                if (cachedDataObj?.allIps?.includes(ip)) {
                    isWhitelisted = true;
                    if (!Array.isArray(cachedDataObj)) {
                        req.isKycCompleted = cachedDataObj.isKycCompleted;
                        req.isKycApproved = cachedDataObj.isKycApproved;
                        req.environment = cachedDataObj.environment;
                        if (cachedDataObj.client_id) {
                            req.clientId = cachedDataObj.client_id; // Billing/Parent ID
                        }
                    }
                }
            }
        } catch (cacheErr) {
            commonLogger.error(`Redis Cache Error: ${cacheErr.message}`);
        }

        console.log('req.clientId',req.clientId)

        if (isWhitelisted) {
            return next();
        }

        // 3. Cache Miss / IP Not Found -> Call Super Admin
        commonLogger.info(`IP ${ip} not in cache for client ${clientId}. Calling Super Admin...`);

        try {
            const response = await axios.post(`${SUPERADMIN_URL}/api/v1/client/authorize-ip`,
        {
                client_id: clientId,
                client_secret: clientSecret,
                ip
            });
            console.log('response data ==>', response.data.data)

            if (response.data?.success) {
                const data = response.data.data;
                req.isKycCompleted = data.isKycCompleted;
                req.isKycApproved = data.isKycApproved;
                req.environment = data.environment;

                // Set billing client ID (B2B parent) for controllers
                if (data.client_id) {
                    req.clientId = data.client_id; // Billing/Parent ID
                }

                commonLogger.info(`Super Admin authorized IP ${ip} for client ${clientId}`);
                return next();
            } else {
                commonLogger.warn(`Access denied for IP ${ip} - Authorization failed.`);
                return res.status(403).json({ message: "Access denied. IP authorization failed." });
            }

        } catch (apiError) {
            commonLogger.error(`Super Admin API Error: ${apiError.message}`);
            return res.status(403).json({ message: "Access denied. IP validation service unavailable." });
        }

    } catch (error) {
        commonLogger.error(`Error in clientValidation middleware: ${error.message}`);
        return res.status(500).json({ message: "Internal server error during Client validation." });
    }
};

module.exports = clientValidation;

