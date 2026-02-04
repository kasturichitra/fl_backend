const VoterIdRouter = require("express").Router();
const { handleVerifyVoterId } = require("./voter.controller");

VoterIdRouter.use("/verifyVoterId", handleVerifyVoterId);

module.exports = VoterIdRouter;