const registeration = require("../../registeration/model/registerationModel");


const FetchUserDetails = async (req,res)=>{
    const {mobileNumber} = req.body;
    try{
        const IsMerchant = await registeration.findOne(mobileNumber);
        if(!IsMerchant){
            return res.status(404).json({httpsCode:404,data:'',message:'User Not Found',})
        }

    }catch(error){
        console.log('Fetch User Details ===>', error);
        return res.status(500).json({message:'Server Error',data:'',status:500,httpsCode:500});
    }
}