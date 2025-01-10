const mongoose = require("mongoose");

const RapidApiBankModel = mongoose.Schema({
    Ifsc : {
        type:String
    },
    response :{
        type :Object
    }

},{timestamps : true})


module.exports = mongoose.model("RapidApiBankModel",RapidApiBankModel);