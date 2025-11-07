const checkingOfLength = (reqData, length)=>{
    if(!reqData?.trim()){
        return true
    }

    if(reqData?.trim() > length || reqData?.trim() < length){
        return true
    }
}

module.exports = {
    checkingOfLength
}