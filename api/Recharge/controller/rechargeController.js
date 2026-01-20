const { ERROR_CODES } = require("../../../utlis/errorCodes");
const { selectService } = require("../../service/serviceSelector");
const ambika = require('../../service/provider.ambika.js');
const reachargeModel = require("../model/reachargeModel.js");
const { rechargeOperatorActiveServiceResponse } = require("../../GlobalApiserviceResponse/recharbeServiceResp.js");

// Fetch Operators
const FetchOperators = async (req, res) => {
    const { mobileNumber } = req.body;
    try {
        if (!mobileNumber) {
            return res.status(400).json(ERROR_CODES.BAD_REQUEST)
        }
        const service = await selectService('RECHARGE');
        console.log("----active service for Recharge Verify is ----", service);

        let result = await rechargeOperatorActiveServiceResponse({ MobileNumber: mobileNumber }, service, 'OPERATORS');

        if (!result || !result.success) {
            return res.status(400).json({
                message: result?.message || "Failed to fetch Details",
                success: false
            });
        }

        if (result?.message === 'Valid') {
            const dataToSave = { Mobile: result?.Mobile, ...result };
            const UpdateinDB = await reachargeModel.create(dataToSave);
            console.log('data to Save', UpdateinDB)
            return res.status(200).json({ message: 'Success', data: result?.result, success: true })
        }
    } catch (error) {
        console.log('Error While Fetch Operators', error);
        res.status(500).json(ERROR_CODES?.SERVER_ERROR)
    }

}

// fetch New plans
const FetchPlans = async (req, res) => {
    const { operatorcode, cricle } = req.body;
    try {
        if (!cricle || !operatorcode) {
            return res.status(400).json(ERROR_CODES.BAD_REQUEST)
        }


        const service = await selectService('RECHARGE');
        console.log("----active service for Recharge Verify is ----", service);

        let result = await rechargeOperatorActiveServiceResponse({ operatorcode, cricle }, service, 'PLANS');

        if (!result || !result.success) {
            return res.status(400).json({
                message: result?.message || "Failed to fetch Plans",
                success: false
            });
        }

        return res.status(200).json({ message: 'Success', data: result, success: true })

    } catch (error) {
        console.log('Error While Fetch Operators', error);
        res.status(500).json(ERROR_CODES?.SERVER_ERROR)
    }
}

// Get Offers
const FetchOffers = async (req, res) => {
    const { operator_code, mobile_no } = req.body;
    try {
        if (!operator_code || !mobile_no) {
            return res.status(400).json(ERROR_CODES.BAD_REQUEST)
        }
        const service = await selectService('RECHARGE');
        console.log('Activer service in reacharge is ==>', service);

        let result = await rechargeOperatorActiveServiceResponse({ operator_code, mobile_no }, service, 'OFFERS');

        if (!result || !result.success) {
            return res.status(400).json({
                message: result?.message || "Failed to fetch Offers",
                success: false
            });
        }
        return res.status(200).json({ message: 'Success', data: result, success: true })
    } catch (error) {
        console.log('Error While Fetch Operators', error);
        res.status(500).json(ERROR_CODES?.SERVER_ERROR)
    }
}

// Old plans
const FetchOldPlans = async (req, res) => {
    const { operatorcode, cricle } = req.body;
    try {
        if (!operatorcode || !cricle) {
            return res.status(400).json(ERROR_CODES.BAD_REQUEST)
        }
        const service = await selectService('RECHARGE');
        console.log('Activer service in reacharge is ==>', service);

        let result = await rechargeOperatorActiveServiceResponse({ operatorcode, cricle }, service, 'OLD_PLANS');

        if (!result || !result.success) {
            return res.status(400).json({
                message: result?.message || "Failed to fetch Old Plans",
                success: false
            });
        }
        return res.status(200).json({ message: 'Success', data: result, success: true })
    } catch (error) {
        console.log('Error While Fetch Operators', error);
        res.status(500).json(ERROR_CODES?.SERVER_ERROR)
    }
}

// Final Reacharge
const RechargeURL = async (req, res) => {
    // let pincode = "500070"
    const { account, actualAmount, spKey, transactionId, geoCode, customerNumber, pincode } = req.body;
    try {
        if (!account || !actualAmount || !spKey || !transactionId || !geoCode || !customerNumber || !pincode) {
            return res.status(400).json(ERROR_CODES.BAD_REQUEST)
        };
        const service = await selectService('RECHARGE');
        console.log('Activer service in reacharge is ==>', service);
        const Paramdata = { account, actualAmount, spKey, transactionId, geoCode, customerNumber, pincode };
        let result = await rechargeOperatorActiveServiceResponse(Paramdata, service, 'RECHARGE');

        if (!result || !result.success) {
            return res.status(400).json({
                message: result?.message || "Recharge Failed",
                success: false
            });
        }
        return res.status(200).json({ message: 'Success', data: result, success: true });
    } catch (error) {
        console.log('Error While Fetch Operators', error);
        res.status(500).json(ERROR_CODES?.SERVER_ERROR)
    }
}





module.exports = {
    FetchOperators,
    FetchPlans,
    FetchOffers,
    RechargeURL,
    FetchOldPlans
}