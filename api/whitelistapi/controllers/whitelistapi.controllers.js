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

        // Validate input
        if (!whitelist) {
            return res.status(400).json({ message: "Whitelist IP is required", success: false });
        }

        if (!isValidIP(whitelist)) {
            return res.status(400).json({ message: "Invalid IP address format", success: false });
        }

        const updateIP = { ipAddress: whitelist, date: new Date() };

        // Find merchant's whitelist record
        let merchantWhitelist = await Whitelistapi.findOne({ merchantId });
        if (!merchantWhitelist) {
            // If merchant doesn't exist, create a new entry
            merchantWhitelist = new Whitelistapi({
                merchantId,
                IP: [updateIP],
            });

            await merchantWhitelist.save();
            return res.status(201).json({ message: "Whitelist API added successfully", success: true });
        }

        // Check if maximum limit is reached (e.g., 10 IPs)
        if (merchantWhitelist.IP.length >= 10) {
            return res.status(400).json({ message: "Maximum number of whitelisted IPs reached", success: false });
        }

        // Check if IP is already whitelisted
        const existingIP = merchantWhitelist.IP.find((ip) => ip.ipAddress === whitelist);
        if (existingIP) {
            return res.status(400).json({ message: "IP address already whitelisted", success: false });
        }

        // Update the whitelist
        await Whitelistapi.findOneAndUpdate(
            { merchantId },
            { $push: { IP: updateIP } },
            { new: true }
        );

        return res.json({ message: "Whitelist API added successfully", success: true });

    } catch (error) {
        console.error("Error adding whitelist:", error);
        return next({ message: "Failed to add IP to whitelist", statusCode: 500 });
    }
};

const GetWhitelistApi = async (req, res, next) => {
    try{
        const merchantId = req.merchantId;
        const whitelistIP = await Whitelistapi.findOne({ merchantId });


    }catch(error){
        console.error("Get request Error Call",error)
        return res.send(500).json({message:'Server Error !', success:false})
    }
}

module.exports = { addWhitelistApi };
