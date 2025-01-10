const jwt = require("jsonwebtoken")
const dotenv = require("dotenv")
dotenv.config();

const jwtSecret = process.env.JWTSECRET

const tokenVerify = (token) =>{
    var status;
    jwt.verify(token , jwtSecret , (err , decoded)=>{
        if (err) {
            status = { status: 404, error: err.message };
          } else {
            status = { status: 200, details: decoded };
          }
    })

    return status
}

module.exports = tokenVerify;



