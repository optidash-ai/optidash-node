/**
* Module dependencies
*/

const fs = require("fs");
const once = require("once");
const stream = require("stream");
const crypto = require("crypto");
const request = require("request");


/**
* Client class
*/

const client = {

    /**
    * Sends a HTTP request to the Optidash API
    *
    * @param {Object} options
    * @param {Function} cb
    * @api private
    */

    sendRequest: (options, cb) => {
        if (options.errorMessage) {
            return cb(new Error(options.errorMessage, null, null));
        }

        const reqOptions = {
            json: true,
            strictSSL: false,
            auth: {
                user: options.key,
                pass: ""
            }
        };


        /**
        * Use a buffer for HTTP response body when using toBuffer(fn)
        */

        if (options.toBuffer) {
            reqOptions.encoding = null;
        }


        /**
        * Additonally inform the API about binary responses
        * via a custom header
        */

        if (options.toFile || options.toBuffer) {
            reqOptions.headers = {
                "X-Optidash-Binary": 1
            };
        }


        /**
        * Set HTTP proxy
        */

        if (options.proxy) {
            reqOptions.proxy = options.proxy;
        }


        /**
        * Make sure the callback will only be called once
        */

        cb = once(cb);


        /**
        * Use Multipart form when dealing with upload() requests
        * or standard JSON request when using the fetch() method
        */

        if (options.withUpload) {
            let file;

            if (options.file instanceof stream.Stream) {
                file = options.file;
            } else if (Buffer.isBuffer(options.file)) {
                file = {
                    value: options.file,
                    options: {
                        filename: crypto.randomBytes(8).toSting("hex")
                    }
                };
            } else {
                file = fs.createReadStream(options.file);
            }


            /**
            * Guard against file I/O errors
            */

            file.on("error", (err) => {
                return cb(err);
            });


            /**
            * Add Multipart form to the request
            */

            reqOptions.url = "https://api.optidash.ai/1.0/upload";

            reqOptions.formData = {
                file: file,
                data: JSON.stringify(options.request)
            };
        } else {
            reqOptions.url = "https://api.optidash.ai/1.0/fetch";
            reqOptions.body = options.request;
        }


        /**
        * When dealing with toJSON(fn) execute the request
        * and immediately return the response to the client...
        */

        if (options.toJSON) {
            request.post(reqOptions, (err, res, body) => {
                if (!cb.called) {
                    if (body && body.message) {
                        return cb(new Error(body.message), body);
                    }

                    return cb(err, body);
                }
            });
        } else {

            /**
            * ...or when dealing with toFile(fn) or toBuffer(fn)
            * stream the response to disk or return a buffer
            */

            let req = {};

            try {
                req = request.post(reqOptions);
            } catch (err) {
                return cb(err, null, null);
            }


            /**
            * Request has to be paused first so that event listeners can be
            * set up and a basic check for status code performed
            */

            req.pause();


            /**
            * Listen for error events
            */

            req.on("error", (err) => {
                if (!cb.called) {
                    return cb(err);
                }
            });


            /**
            * Listen for response event and stream the binary to disk
            * or return a buffer when toBuffer(fn) is in use
            */

            req.on("response", (res) => {
                let meta = {};


                /**
                * Try to parse metadata header
                */

                if (res.headers && res.headers["x-optidash-meta"]) {
                    try {
                        meta = JSON.parse(res.headers["x-optidash-meta"]);
                    } catch (e) {
                        if (!cb.called) {
                            return cb(new Error("Unable to parse JSON response from the Optidash API"));
                        }
                    }
                } else {
                    meta = {};
                }


                /**
                * Immediately return if the status code is not 200 OK
                */

                if (meta.success === false && !cb.called) {
                    return cb(new Error(meta.message), meta);
                }


                /**
                * When toFile(string|stream, fn) is in use
                * pipe the response to disk
                */

                if (options.toFile) {
                    let ws;

                    if (options.outputFile instanceof stream.Stream) {
                        ws = options.outputFile;
                    } else {
                        ws = fs.createWriteStream(options.outputFile);
                    }


                    /**
                    * Guard against file I/O errors
                    */

                    ws.on("error", (err) => {
                        if (!cb.called) {
                            return cb(err, meta);
                        }
                    });

                    ws.on("finish", () => {
                        if (!cb.called) {
                            return cb(null, meta);
                        }
                    });

                    req.pipe(ws);
                }


                /**
                * When toBuffer(fn) is in use append the data to an array
                * and return the buffer to the user
                */

                if (options.toBuffer) {
                    const buff = [];

                    res.on("data", (data) => {
                        buff.push(data);
                    });

                    res.on("end", () => {
                        if (!cb.called) {
                            return cb(null, meta, Buffer.concat(buff));
                        }
                    });
                }


                /**
                * Resume the request after all the checks have been set up
                */

                req.resume();
            });
        }
    }
};


/**
* Export client
*/

module.exports = client;