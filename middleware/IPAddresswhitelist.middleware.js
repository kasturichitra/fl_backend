const requestIp = require('request-ip');
const redisClient = require('../utlis/redis');
const { commonLogger } = require('../api/Logger/logger');
const axios = require('axios');
require('dotenv').config();

const SUPERADMIN_URL = process.env.SUPERADMIN_URL;

const jwt = require("jsonwebtoken");

const checkWhitelist = async (req, res, next) => {
    const accessToken = req.headers["secret_token"];
    console.log('check whiltelist is called ', accessToken)
    try {
        // 1. Extract IP
        let ip = requestIp.getClientIp(req);
        ip = ip.includes("::ffff:") ? ip.split("::ffff:")[1] : ip;
        if (ip === "::1") ip = "127.0.0.1";

        // const accessToken = req.headers["secret_token"];

        if (!accessToken) {
            commonLogger.warn(`IP Check: Missing secret_token for IP ${ip}`);
            return res.status(400).json({ message: "Missing secret_token header." });
        }

        // Decode token to get clientId (signature verification happens in AuthValidation later)
        const decodedToken = jwt.verify(accessToken, process.env.JWT_SECRET_KEY);
        // Token has camelCase fields based on user sample
        const { clientId, clientSecret } = decodedToken;
        if (!clientId || !clientSecret) {
            return res.status(400).json({ message: "Invalid token structure." });
        }

        // Map to snake_case for Super Admin consistency if needed, 
        // but Redis key uses clientId
        const redisKey = `whitelist:${clientId}`;

        // 2. Check Redis Cache (Shared with Super Admin)
        let isWhitelisted = false;
        try {
            const cachedData = await redisClient.get(redisKey);
            if (cachedData) {
                const cachedDataObj = JSON.parse(cachedData);
                const ips = Array.isArray(cachedDataObj) ? cachedDataObj : (cachedDataObj.ips || []);
                if (ips.includes(ip)) {
                    isWhitelisted = true;
                    if (!Array.isArray(cachedDataObj)) {
                        req.isKycCompleted = cachedDataObj.isKycCompleted;
                        req.isKycApproved = cachedDataObj.isKycApproved;
                        req.environment = cachedDataObj.environment;
                    }
                }
            }
        } catch (cacheErr) {
            console.error("Redis Cache Error:", cacheErr);
            // On cache error, we proceed to call Super Admin as fallback
        }

        if (isWhitelisted) {
            return next();
        }

        // 3. Cache Miss / IP Not Found -> Call Super Admin to Authorize/Verify
        console.log(`IP ${ip} not in cache for client ${clientId}. Calling Super Admin...`);

        try {
            const response = await axios.post(`${SUPERADMIN_URL}/api/v1/client/authorize-ip`, {
                client_id: clientId,
                client_secret: clientSecret,
                ip
            });

            if (response.data?.success) {
                const data = response.data.data;
                // Update req with details from Super Admin response
                req.isKycCompleted = data.isKycCompleted;
                req.isKycApproved = data.isKycApproved;
                req.environment = data.environment;

                console.log(`Super Admin authorized IP ${ip} for client ${clientId}`);
                return next();
            } else {
                return res.status(403).json({ message: "Access denied. IP authorization failed." });
            }

        } catch (apiError) {
            console.error("Super Admin API Error:", apiError.message);
            // If Super Admin is down or returns error, we must deny access for security
            return res.status(403).json({ message: "Access denied. IP validation service unavailable." });
        }

    } catch (error) {
        console.error("Error in checkWhitelist middleware:", error);
        return res.status(500).json({ message: "Internal server error during IP validation." });
    }
};

module.exports = checkWhitelist;
