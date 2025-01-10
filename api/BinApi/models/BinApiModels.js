const mongoose = require("mongoose");

const RapidApiModel = mongoose.Schema({
    bin : {
        type:String
    },
    response :{
        type :Object
    }

},{timestamps : true})


module.exports = mongoose.model("RapidApiModel",RapidApiModel);