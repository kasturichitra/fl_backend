const Whitelistapi = require('../models/whitelistapi.models');

// Helper function to validate IP address format
const isValidIP = (ip) => {
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])(\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])){3}$/;
    return typeof ip === "string" && ipRegex.test(ip.trim());
};
// Add whitelist API to whitelistMerchant
const addWhitelistApi = async (req, res, next) => {
    try {
        const { whitelist } = req.body;
        const merchantId = req.merchantId;
        console.log('Response from addWhitelistApi:', whitelist,merchantId);

        // Validate input
        if (!whitelist) {
            return res.status(400).json({ message: "Whitelist IP is required", success: false });
        }
        if (!isValidIP(whitelist)) {
            return res.status(400).json({ message: "Invalid IP address format", success: false });
        }

        const updateIP = { ipAddress: whitelist, date: new Date() };

        // Use findOneAndUpdate to insert or update in one query
        const updatedWhitelist = await Whitelistapi.findOneAndUpdate(
            { merchantId },
            {
                $setOnInsert: { merchantId },
                $push: { IP: updateIP },
            },
            { new: true, upsert: true }
        );

        // Check if the IP was already present
        const existingIP = updatedWhitelist.IP.find((ip) => ip.ipAddress === whitelist);
        if (existingIP) {
            return res.status(400).json({ message: "IP address already whitelisted", success: false });
        }

        // Check max IP limit
        if (updatedWhitelist.IP.length > 10) {
            return res.status(400).json({ message: "Maximum number of whitelisted IPs reached", success: false });
        }

        return res.json({ message: "Whitelist API added successfully", success: true });

    } catch (error) {
        console.error("Error adding whitelist:", error);
        return next({ message: "Failed to add IP to whitelist", statusCode: 500 });
    }
};

module.exports = { addWhitelistApi };
