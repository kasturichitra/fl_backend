const express = require('express');
const { FetchPublickey } = require('./keysapi.controller');
const keysApiroutes = express.Router();


keysApiroutes.get('/key/Publickey',FetchPublickey)


module.exports = {
    keysApiroutes
}