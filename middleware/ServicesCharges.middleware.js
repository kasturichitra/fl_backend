const NominalChargesModel = require('../api/NominalCharges/Model/NominalChargesModel');
const WalletSchemamodal = require('../api/Wallets/models/Wallets.models');
const TransactionSchemamodal = require('../api/Wallets/models/Transaction.models');
const { v4: uuidv4 } = require('uuid');

const HandileCharges = async (req, res, next) => {
    try {
        const serviceName = req.baseUrl.replace(/^\/+/, '');
        const merchantId = req.merchantId;
        console.log('Call HandileCharges --->', merchantId, serviceName);
        let TransactionID = ''
        for (let i = 0; i < 12; i++) {
            TransactionID = uuidv4();
        }

        // Fetch nominal charges
        const nominalCharges = await NominalChargesModel.findOne({ service: serviceName });
        if (!nominalCharges) {
            return res.status(400).json({ message: 'Service not found' });
        }
        const { chargeFee = 0, chargePercentage = 0 } = nominalCharges;

        // Fetch wallet details
        const wallet = await WalletSchemamodal.findOne({ MerchantId:merchantId });
        if (!wallet) {
            return res.status(400).json({ message: 'Wallet not found' });
        }

        const walletBalance = Number(wallet?.unSettledAmount);
        console.log('Wallet Balance --->', walletBalance);

        // Calculate charge amount
        let chargeAmount = Number(walletBalance) - Number(chargeFee);
        if (chargePercentage > 0) {
            chargeAmount -= (Number(walletBalance) * Number(chargeFee)) / 100;
        }

        if (chargeAmount < 0) {
            return res.status(400).json({ message: 'Insufficient Balance' });
        }

        // Update wallet
        const updatedWallet = await WalletSchemamodal.findOneAndUpdate(
            { MerchantId:merchantId },
            {
                $set: {
                    unSettledAmount: Number(chargeAmount),
                    transactionDate: new Date(),
                    transactionTime: new Date().toLocaleTimeString(),
                },
                $inc: { settledAmount: Number(chargeFee) },
            },
            { new: true, runValidators: true }
        );

        // Add transaction record
        const updatedTransaction = new TransactionSchemamodal({
            MerchantId:merchantId,
            unSettledAmount: Number(chargeAmount),
            transactionDate: new Date(),
            transactionTime: new Date().toLocaleTimeString(),
            settledAmount: (Number(wallet?.settledAmount) + Number(chargeFee))  || (wallet?.settledAmount + (walletBalance * chargePercentage) / 100),
            transactionId: TransactionID, // You may want to replace this with a real transaction ID
            mobileNumber: wallet?.mobileNumber,
            service: serviceName,
        });
        await updatedTransaction.save();

        console.log('Updated Wallet --->', updatedWallet);
        next();
    } catch (error) {
        console.error('Handle service charges error --->', error);
        return next(error);
    }
};

module.exports = HandileCharges;
