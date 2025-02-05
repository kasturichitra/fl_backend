const mongoose = require('mongoose');
const WhitelistSchema = new mongoose.Schema({
    IP: [
        {
            ipAddress: { type: String, unique: true },
            date: { type: Date, default: Date.now }
        }
    ],
    merchantId: {
        type: String
    }
},{timestamps:true});

const Whitelistapi = mongoose.model('Whitelistapis', WhitelistSchema);

module.exports = Whitelistapi