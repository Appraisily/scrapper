// This file is no longer needed as we use storage.js directly
// Importing the storage module for backward compatibility
const storage = require('./storage');
module.exports = { saveHtmlToFile: storage.saveHtml.bind(storage) };