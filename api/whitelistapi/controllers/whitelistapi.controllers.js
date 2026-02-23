const Whitelistapi = require('../models/whitelistapi.models');
const { commonLogger } = require("../../Logger/logger");

// Helper function to validate IP address format
const isValidIP = (ip) => {
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])(\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])){3}$/;
    return typeof ip === "string" && ipRegex.test(ip.trim());
};

const addWhitelistApi = async (req, res, next) => {
    commonLogger.info(`Add white List API ===> ${JSON.stringify(req.body)}`);
    try {
        const { MerchatID, ip_address, comments } = req.body;
        commonLogger.debug(`merchantid and whitelist: ${MerchatID}, ${ip_address}, ${comments}`);
        if (!ip_address) {
            return res.status(400).json({ message: "Whitelist IP is required", success: false });
        }

        if (!isValidIP(ip_address)) {
            return res.status(400).json({ message: "Invalid IP address format", success: false });
        }

        const updateIP = { ipAddress: ip_address, comments, Active: true, date: new Date() };
        let merchantWhitelist = await Whitelistapi.findOne({ merchantId: MerchatID });
        if (!merchantWhitelist) {
            merchantWhitelist = await Whitelistapi.create({
                merchantId: MerchatID,
                IP: [updateIP],
            });
            return res.status(201).json({ message: "Whitelist API added successfully", success: true });
        }

        if (merchantWhitelist.IP.length >= 10) {
            return res.status(400).json({ message: "Maximum number of whitelisted IPs reached", success: false });
        }

        const existingIP = merchantWhitelist.IP.find((ip) => ip.ipAddress === ip_address);
        if (existingIP) {
            return res.status(400).json({ message: "IP address already whitelisted", success: false });
        }

        const WhiteListData = await Whitelistapi.findOneAndUpdate(
            { merchantId: MerchatID },
            { $push: { IP: updateIP } },
            { new: true }
        );
        // merchantWhitelist.IP.push(updateIP);
        // await merchantWhitelist.save();
        return res.status(200).json({ message: "Whitelist API updated successfully", success: true, WhiteListData: WhiteListData?.IP });
    } catch (error) {
        commonLogger.error(`Error adding whitelist: ${error.message}`);
        return next({ message: "Failed to add IP to whitelist", statusCode: 500 });
    }
};

const GetWhitelistApi = async (req, res, next) => {
    commonLogger.debug(`get white list ip are ==> ${JSON.stringify(req.params)}`);
    try {
        const { MerchatId } = req.params;
        if (!MerchatId) {
            return res.status(400).json({ message: "Merchant ID is required", success: false });
        }

        const whitelistIP = await Whitelistapi.findOne({ merchantId: MerchatId });

        if (!whitelistIP) {
            return res.status(404).json({ message: "Merchant Not Found", success: false });
        }

        return res.status(200).json({
            message: "Success",
            success: true,
            whitelistIP: whitelistIP.IP
        });
    } catch (error) {
        commonLogger.error(`Error in GetWhitelistApi: ${error.message}`);
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

        commonLogger.info(`Delete request for whitelist IP: ${JSON.stringify({ merchantId, ipAddress })}`);

        if (!ipAddress) {
            return res.status(400).json({ message: 'IP Address is required', success: false });
        }
        const merchant = await Whitelistapi.findOne({ merchantId });

        if (!merchant) {
            return res.status(404).json({ message: 'Merchant ID not found', success: false });
        }

        const existingIP = merchant.IP.find(ip => ip.ipAddress === ipAddress);
        if (!existingIP) {
            return res.status(404).json({ message: 'IP Address not found in whitelist', success: false });
        }

        await Whitelistapi.updateOne({ merchantId }, { $pull: { IP: { ipAddress } } });

        return res.status(200).json({ message: 'IP deleted successfully', success: true });
    } catch (error) {
        commonLogger.error(`Error in DeleteWhitelistApi: ${error.message}`);
        return next({
            message: "Internal Server Error",
            success: false,
            error: error.message,
            statusCode: 500
        });
    }
};

module.exports = { addWhitelistApi, GetWhitelistApi, DeleteWhitelistApi };
