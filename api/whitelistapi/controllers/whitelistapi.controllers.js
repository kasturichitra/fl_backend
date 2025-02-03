const { response } = require('express');
const Whitelistapi = require('../models/whitelistapi.models')
const loginAndSms = require('../../loginAndSms/model/loginAndSmsModel')


//add whitelist api to whitelistMerchant
const addWhitelistApi = async (req, res, next) => {
    try {
        const { whitelist } = req.body;

        console.log("Response form the Whitelistapi controllers ---> ", whitelist);
        const merchantId = req.merchantId;
        console.log('MerchantID is --->', merchantId);

        // Validate input
        if (!whitelist) {
            return res.status(400).json({ message: "Whitelist IP is required", success: false });
        }

        // Check if the merchant exists
        const merchantWhitelist = await Whitelistapi.findOne({ merchantId:merchantId });
        console.log(
            "MerchantWhitelist is --->", merchantWhitelist
        )
        if (!merchantWhitelist) {
            return res.status(404).json({ message: "Merchant ID not found", success: false });
        }

        // Ensure IP is an array
        if (!Array.isArray(merchantWhitelist.IP)) {
            merchantWhitelist.IP = [];
        }
        // Check it  the maximum limit
        if(merchantWhitelist.IP  && merchantWhitelist.IP.length >= 10){
            return res.status(400).json({ message: "Maximum number of whitelisted IPs reached", success: false });
        }
        // Add new IP and save
        merchantWhitelist.IP.push(whitelist);
        await merchantWhitelist.save();

        return res.json({ message: "Whitelist API added successfully", success: true });

    } catch (error) {
        console.error("Error adding whitelist:", error);
        return next({ message: "Failed to add IP to whitelist", statusCode: 500 });
    }
};

module.exports = { addWhitelistApi };
