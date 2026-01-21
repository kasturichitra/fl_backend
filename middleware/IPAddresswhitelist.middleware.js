const Whitelistapi = require('../api/whitelistapi/models/whitelistapi.models');
const requestIp = require('request-ip');

const checkWhitelist = async (req, res, next) => {
    try {
        let ip = requestIp.getClientIp(req); // Extract IP correctly
        ip = ip.includes("::ffff:") ? ip.split("::ffff:")[1] : ip; // Normalize IPv4-mapped IPv6
        if (ip === "::1") ip = "127.0.0.1"; // Convert localhost IPv6

        console.log("Request IP:", ip);
        const isWhitelisted = await Whitelistapi.findOne({
            IP: { $elemMatch: { ipAddress: ip, Active: true } }
        });

        if (!isWhitelisted) {
            return res.status(403).json({ message: "Access denied. Your IP is not whitelisted." });
        }
        next();
    } catch (error) {
        console.error("Error in checkWhitelist middleware:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
};

module.exports = checkWhitelist;
