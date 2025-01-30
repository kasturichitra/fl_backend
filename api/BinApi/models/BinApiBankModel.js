const mongoose = require("mongoose");

const RapidApiBankModel = mongoose.Schema({
    Ifsc : {
        type:String
    },
    response :{
        type :Object
    },
    token:{
        type: String
    },
    MerchantId:{
        type:String
    }

},{timestamps : true})


module.exports = mongoose.model("RapidApiBankModel",RapidApiBankModel);