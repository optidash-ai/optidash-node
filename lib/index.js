/**
* Constructor
*
* @param {String} key
* @throws {Error} invalid parameters
*/

const Optidash = module.exports = function (key) {
    if (!(this instanceof Optidash)) {
        return new Optidash(key);
    }

    if (typeof key !== "string") {
        throw new Error("Optidash constructor requires a valid API Key");
    }

    this.options = {
        key: key,
        request: {}
    };
};


/**
* Extend the prototype with available operations
*/

require("./operations")(Optidash);


/**
* Export Optidash
*/

module.exports = Optidash;