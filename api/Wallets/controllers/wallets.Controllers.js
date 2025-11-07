const WalletSchemamodal = require('../models/Wallets.models');


const HandileGetWallet = async (req, res) => {
    try {
        const merchantId = req.merchantId
        console.log('merchant id from wallet is ', merchantId)
        const wallet = await WalletSchemamodal.findOne({MerchantId:merchantId})
        if (!wallet) {
            return res.status(404).json({ message: 'Wallet not found' })
        }
        return res.status(200).json({message: 'Wallet found', wallet, success: true })
    } catch (error) {
        console.log('Internal server error', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

module.exports = {HandileGetWallet};