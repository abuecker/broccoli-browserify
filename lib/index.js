var fs = require('fs');
var path = require('path');
var RSVP = require('rsvp');
var mkdirp = require('mkdirp');
var browserify = require('browserify')
var Writer = require('broccoli-writer');
var assign = require('object-assign');

function BrowserifyWriter(inputTree, options) {
  if (!(this instanceof BrowserifyWriter)) {
    return new BrowserifyWriter(inputTree, options);
  }

  options = options || {};

  this.entries = options.entries || [];
  this.outputFile = options.outputFile || '/browserify.js';
  this.browserifyOptions = options.browserify || {};
  this.requireOptions = options.require || {};
  this.inputTree = inputTree;
  this.transform = options.transform || [];

  if (fs.existsSync('package.json')) {

    var pkg = require(path.join(process.cwd(), 'package.json'));

    if (pkg.browserify) {
      this.browserifyOptions = assign(pkg.browserify, this.browserifyOptions);
    }

    if (this.browserifyOptions.transform &&
        this.browserifyOptions.transform.length) {

      this.browserifyOptions.transform.forEach(function (tfm, idx) {

        var obj = {};
        obj[tfm] = {}
        // get any transform options for package.json
        if (pkg[tfm]) {
          obj[tfm] = pkg[tfm];
        }
        this.transform.push(obj);

      }.bind(this));

    }

  }

}

BrowserifyWriter.prototype = Object.create(Writer.prototype);
BrowserifyWriter.prototype.constructor = BrowserifyWriter;

BrowserifyWriter.prototype.write = function (readTree, destDir) {
  var entries = this.entries;
  var outputFile = this.outputFile;
  var browserifyOptions = this.browserifyOptions;
  var bundleOptions = this.bundleOptions;
  var requireOptions = this.requireOptions;
  var transform = this.transform;

  return readTree(this.inputTree).then(function (srcDir) {
    mkdirp.sync(path.join(destDir, path.dirname(outputFile)));

    browserifyOptions.basedir = srcDir;
    var b = browserify(browserifyOptions);

    for (var i = 0; i < entries.length; i++) {
      b.add(entries[i]);
    }
    for(var i = 0; i < requireOptions.length; i++){
      b.require.apply(b, requireOptions[i]);
    }

    return new RSVP.Promise(function (resolve, reject) {

      // process transforms
      if (transform.length) {

        // step through the transforms
        transform.forEach(function (tfm) {

          Object.keys(tfm).forEach(function (key) {
            if (typeof tfm[key] === 'object') {
              b.transform(key, tfm[key]);
            } else {
              b.transform(key);
            }
          });

        });

      }

      b.bundle(function (err, data) {
        if (err) {
          reject(err);
        } else {
          fs.writeFileSync(path.join(destDir, outputFile), data);
          resolve(destDir);
        }
      });
    });
  });
};

module.exports = BrowserifyWriter;
// vim: ts=2 sw=2 expandtab:
