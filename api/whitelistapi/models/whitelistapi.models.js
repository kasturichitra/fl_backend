const mongoose = require('mongoose');


const WhitelistSchema = new mongoose.Schema({
    IP:{
        type:Array,
        unique:true
    },
    date:{
        type: Date,
        default:Date.now()
    },
    merchantId:{
        type:String,
    }
})

const Whitelistapi = mongoose.model('Whitelistapis', WhitelistSchema);

module.exports = Whitelistapi