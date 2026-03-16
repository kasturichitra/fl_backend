const express = require('express');
const contactRouter = express.Router();

const { handleMobileToPanVerify } = require('../controllers/contactController');

contactRouter.post('/verify', handleMobileToPanVerify);

module.exports = contactRouter;
