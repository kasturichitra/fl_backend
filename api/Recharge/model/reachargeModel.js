const mongoose = require('mongoose');
const ReachargeOperatorandCode = new mongoose.Schema({

    Mobile:{
        type: String,
        required:true
    },
    result:{
        type: Object
    },
    message:{
        type: Object
    },
    responseOfService:{
        type: Object
    },
    service:{
        type: Object
    },
})

module.exports = mongoose.model('ReachargeOperatorandCircleCode',ReachargeOperatorandCode);