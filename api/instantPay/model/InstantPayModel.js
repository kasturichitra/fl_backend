const mongoose = require("mongoose")

const instantPaySchema = new mongoose.Schema({
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

const InstantPayModel = mongoose.model("InstantPayDetails" , instantPaySchema)

module.exports = InstantPayModel