const requestIp = require('request-ip');
const redisClient = require('../utlis/redis');
const { commonLogger } = require('../api/Logger/logger');
const axios = require('axios');
require('dotenv').config();

const SUPERADMIN_URL = process.env.SUPERADMIN_URL;

const checkWhitelist = async (req, res, next) => {
    console.log("checkWhitelist is called ===>", req.headers["client_id"]);
    try {
        // 1. Extract IP and Client ID
        let ip = requestIp.getClientIp(req);
        ip = ip.includes("::ffff:") ? ip.split("::ffff:")[1] : ip;
        if (ip === "::1") ip = "127.0.0.1";

        const clientId = req.headers["client_id"]

        if (!clientId) {
            commonLogger.warn(`IP Check: Missing client_id for IP ${ip}`);
            // Depending on policy, we might allow or block. 
            // For now, let's block as whitelisting implies strict access.
            return res.status(400).json({ message: "Missing client_id header for IP validation." });
        }

        const redisKey = `whitelist:${clientId}`;

        // 2. Check Redis Cache (Shared with Super Admin)
        let isWhitelisted = false;
        try {
            const cachedData = await redisClient.get(redisKey);
            if (cachedData) {
                const whitelistedIps = JSON.parse(cachedData);
                if (whitelistedIps.includes(ip)) {
                    isWhitelisted = true;
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
                clientId,
                ip
            });

            if (response.data?.success) {
                // If Super Admin authorized it, they have ALREADY updated Redis.
                // We can proceed safely.
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
