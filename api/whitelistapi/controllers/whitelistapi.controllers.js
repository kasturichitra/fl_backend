const Whitelistapi = require('../models/whitelistapi.models');

// Helper function to validate IP address format
const isValidIP = (ip) => {
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])(\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])){3}$/;
    return typeof ip === "string" && ipRegex.test(ip.trim());
};

// Add whitelist API to whitelistMerchant
const addWhitelistApi = async (req, res, next) => {
    try {
        const { whitelist, Comment } = req.body;
        const merchantId = req.merchantId;
        console.log('merchantid and whitelist', merchantId, whitelist, Comment);
        // Validate input
        if (!whitelist) {
            return res.status(400).json({ message: "Whitelist IP is required", success: false });
        }

        if (!isValidIP(whitelist)) {
            return res.status(400).json({ message: "Invalid IP address format", success: false });
        }

        const updateIP = { ipAddress: whitelist, Comment, Active: true, date: new Date() };  // Active is update hear

        // Find merchant's whitelist record
        let merchantWhitelist = await Whitelistapi.findOne({ merchantId });
        if (!merchantWhitelist) {
            // If merchant doesn't exist, create a new entry
            merchantWhitelist = await Whitelistapi.create({
                merchantId,
                IP: [updateIP],
            });
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
        // merchantWhitelist.IP.push(updateIP);
        // await merchantWhitelist.save();
        return res.status(200).json({ message: "Whitelist API updated successfully", success: true });

        // return res.json({ message: "Whitelist API added successfully", success: true });

    } catch (error) {
        console.error("Error adding whitelist:", error);
        return next({ message: "Failed to add IP to whitelist", statusCode: 500 });
    }
};

const GetWhitelistApi = async (req, res, next) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId) {
            return res.status(400).json({ message: "Merchant ID is required", success: false });
        }

        const whitelistIP = await Whitelistapi.findOne({ merchantId });

        if (!whitelistIP) {
            return res.status(404).json({ message: "Merchant Not Found", success: false });
        }

        return res.status(200).json({
            message: "Success",
            success: true,
            whitelistIP: whitelistIP.IP
        });
    } catch (error) {
        console.error("Error in GetWhitelistApi:", error);
        return res.status(500).json({
            message: "Internal Server Error",
            success: false,
            error: error.message
        });
    }
};

const DeleteWhitelistApi = async (req, res, next) => {
    try {
        const merchantId = req.merchantId;
        const { ipAddress } = req.query;

        console.log('Delete request for whitelist IP:', { merchantId, ipAddress,req });

        // Validate request body
        if (!ipAddress) {
            return res.status(400).json({ message: 'IP Address is required', success: false });
        }

        // Find the merchant's whitelist
        const merchant = await Whitelistapi.findOne({ merchantId });

        if (!merchant) {
            return res.status(404).json({ message: 'Merchant ID not found', success: false });
        }

        // Check if the IP exists in the whitelist
        const existingIP = merchant.IP.find(ip => ip.ipAddress === ipAddress);
        if (!existingIP) {
            return res.status(404).json({ message: 'IP Address not found in whitelist', success: false });
        }

        // Remove the IP from the whitelist using $pull
        await Whitelistapi.updateOne({ merchantId }, { $pull: { IP: { ipAddress } } });

        return res.status(200).json({ message: 'IP deleted successfully', success: true });
    } catch (error) {
        console.error("Error in DeleteWhitelistApi:", error);
        return next({
            message: "Internal Server Error",
            success: false,
            error: error.message,
            statusCode: 500
        });
    }
};



module.exports = { addWhitelistApi, GetWhitelistApi,DeleteWhitelistApi };
