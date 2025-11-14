const { ERROR_CODES } = require("../../../utlis/errorCodes");
const { selectService } = require("../../service/serviceSelector");
const ambika = require('../../service/provider.ambika.js');
const reachargeModel = require("../model/reachargeModel.js");

// Fetch Operators
const FetchOperators = async (req, res) => {
    const { mobileNumber } = req.body;
    try {
        if (!mobileNumber) {
            return res.status(400).json(ERROR_CODES.BAD_REQUEST)
        }
        // const existingOperator = await reachargeModel.findOne({ Mobile: mobileNumber });
        // if (existingOperator) {
        //     return res.status(200).json({ message: 'Success', data: existingOperator?.response, success: true });
        // }
        const service = await selectService('RECHARGE');
        console.log('Activer service in reacharge is ==>', service);
        if (!service?.serviceFor) {
            return res.status(400).json({ message: 'No Active Services', httpCode: 400 })
        }

        let result;
        switch (service?.serviceFor) {
            case "AMBIKA":
                result = await ambika?.GetOperator(mobileNumber)
                break;
        }
         const dataToSave = {
            Mobile:result?.Mobile,
            response:result
        };
        const UpdateinDB = await reachargeModel.create(dataToSave);
        console.log('data to Save',UpdateinDB)
        return res.status(200).json({ message: 'Success', data: result,success:true })
    } catch (error) {
        console.log('Error While Fetch Operators', error);
        res.status(500).json(ERROR_CODES?.SERVER_ERROR)
    }
}

// fetch New plans
const FetchPlans = async (req, res) => {
    const { operatorcode,cricle } = req.body;
    try {
        if (!cricle || !operatorcode) {
            return res.status(400).json(ERROR_CODES.BAD_REQUEST)
        }

        const service = await selectService('RECHARGE');
        console.log('Activer service infetch plans reacharge is ==>', service);
        if (!service?.serviceFor) {
            return res.status(400).json({ message: 'No Active Services', httpCode: 400 })
        }

        let result;
        switch (service?.serviceFor) {
            case "AMBIKA":
                result = await ambika?.GetPlans(operatorcode,cricle)
                break;
        }

       
        return res.status(200).json({ message: 'Success', data: result,success:true })

    } catch (error) {
        console.log('Error While Fetch Operators', error);
        res.status(500).json(ERROR_CODES?.SERVER_ERROR)
    }
}

// Get Offers
const FetchOffers = async (req, res) => {
    const { operator_code,mobile_no } = req.body;
    try {
        if (!operator_code || !mobile_no) {
            return res.status(400).json(ERROR_CODES.BAD_REQUEST)
        }
        const service = await selectService('RECHARGE');
        console.log('Activer service in reacharge is ==>', service);
        if (!service?.serviceFor) {
            return res.status(400).json({ message: 'No Active Services', httpCode: 400 })
        }

        let result;
        switch (service?.serviceFor) {
            case "AMBIKA":
                result = await ambika?.GetOffers(operator_code,mobile_no )
                break;
        }
        return res.status(200).json({ message: 'Success', data: result,success:true })
    } catch (error) {
        console.log('Error While Fetch Operators', error);
        res.status(500).json(ERROR_CODES?.SERVER_ERROR)
    }
}

// Old plans
const FetchOldPlans = async (req, res) => {
    const { operatorcode,cricle } = req.body;
    try {
        if (!operatorcode || !cricle) {
            return res.status(400).json(ERROR_CODES.BAD_REQUEST)
        }
        const service = await selectService('RECHARGE');
        console.log('Activer service in reacharge is ==>', service);
        if (!service?.serviceFor) {
            return res.status(400).json({ message: 'No Active Services', httpCode: 400 })
        }

        let result;
        switch (service?.serviceFor) {
            case "AMBIKA":
                result = await ambika?.GetOldPlan(operatorcode,cricle)
                break;
        }
        return res.status(200).json({ message: 'Success', data: result,success:true })
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
        if (!service?.serviceFor) {
            return res.status(400).json({ message: 'No Active Services', httpCode: 400 })
        };
        const Paramdata = { account, actualAmount, spKey, transactionId, geoCode, customerNumber, pincode};
        let result;
        switch (service?.serviceFor) {
            case "AMBIKA":
                result = await ambika?.RECHARGE(Paramdata)
                break;
        }
        return res.status(200).json({ message: 'Success', data: result,success:true });
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