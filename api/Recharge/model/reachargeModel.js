const mongoose = require('mongoose');
const ReachargeOperatorandCode = new mongoose.Schema({
    Mobile:{
        type: String,
        required:true
    },
    response:{
        type: Object,
        required: true
    }
})

module.exports = mongoose.model('ReachargeOperatorandCircleCode',ReachargeOperatorandCode);