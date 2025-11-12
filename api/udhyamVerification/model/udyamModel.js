const mongoose = require("mongoose")

const udhyamVerificationSchema = new mongoose.Schema({
   udhyamNumber:{
    type: String,
   },
   responseData:{
    type:Object
   },
   serviceName:{
    type:String,
   },
   serviceResponse:{
    type: Object
   },
    createdTime:{
        type:String
    },
    createdDate:{
        type:String
    }
},{timestamps:true})

const udhyamVerify = mongoose.model("udhyamVerification" , udhyamVerificationSchema)

module.exports = udhyamVerify