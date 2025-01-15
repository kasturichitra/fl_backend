const mongoose = require("mongoose");

const RazorpaySettlementSchema = new mongoose.Schema(
  {
    settlement_id: {
      type: String,
      required: true, 
      unique: true, 
    },
    amount_requested :{
      type: String
    },
    amount_settled :{
      type: String
    },
    amount_pending :{
      type: String
    },
    amount_reversed :{
      type: String
    },
    tax:{
      type: String
    },
    fees:{
      type: String
    },
    created_date :{
      type :String
    },
    reinitiated_date :{
      type :String
    },
    
    created_settlement: {
      type: Object,
      
    },
    AllSettlement: {
      type: Array,
      default: [], 
    },
    SettlementBySettlementId: {
      type: Object,
      default: {},
    },
    SettlementWithPayouts: {
      type: Object,
      default: {}, 
    },
    status: {
      type: String,

    },
    response :{
      type:Object
    }
  },
  { timestamps: true } 
);

module.exports = mongoose.model("RazorpaySettlement", RazorpaySettlementSchema);
