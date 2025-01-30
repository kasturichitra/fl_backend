const mongoose = require("mongoose");

const RapidApiModel = mongoose.Schema({
    bin : {
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


module.exports = mongoose.model("RapidApiModel",RapidApiModel);