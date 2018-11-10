const nodeDBHelper = require("./nodejs/nodeDBHelper");
const rnDBHelper = require("./react-native/rnDBHelper");

function initDBHelper(dbprovider) {

    if (dbprovider.type == 'node') {
        return new nodeDBHelper(dbprovider.config);
    } else {
        return new rnDBHelper(dbprovider.config);
    }
}

module.exports = {
  initDBHelper
};