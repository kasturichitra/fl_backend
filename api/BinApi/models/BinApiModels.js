const mongoose = require("mongoose");

const RapidBinModel = mongoose.Schema({
    bin : {
        type:String
    },
    response :{
        type :Object
    },
      createdTime: {
      type: String,
      default: Date.now,
    },
    createdDate: {
      type: String,
      default: Date.now,
    },

},{timestamps : true})


module.exports = mongoose.model("binCardValidation",RapidBinModel);
