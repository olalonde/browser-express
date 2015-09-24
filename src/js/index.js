var async = require("async");

var prouter = require("./prouter"); // waiting for pull request to be accepted
var Router = prouter.Router;

module.exports = function(options) {

  var options = options || {};

  var store = {};

  var stack = [];

  var engines = {};

  var linkHandler = function(event) {
    var sameHost = event.target.host ? document.location.host == event.target.host : true;
    var pathname, search, protocol, hash;
    if (event.target.pathname) {
      pathname = event.target.pathname;
      search = event.target.search;
      protocol = event.target.protocol;
      hash = event.target.hash;
    }
    else {
      var findInParent = function(element) {
        var _parentElement = element.parentElement
        if (_parentElement) {
          if (_parentElement.pathname) {
            pathname = _parentElement.pathname;
            search = _parentElement.search;
            protocol = _parentElement.protocol;
            hash = _parentElement.hash;
          }
          else {
            findInParent(_parentElement);
          }
        }
      }
      findInParent(event.target);
    }
    if (pathname && sameHost && (protocol === "http:" || protocol === "https:")) {
      event.preventDefault();
      var navigated = Router.navigate(pathname + search + hash);
      // it would be nice if it only preventedDefault and returned false if it actually hit a route!
      return false;
    }
  }

  if (options.interceptLinks) {
    options.document.body.addEventListener("click", linkHandler, true);
  }

  var res = {
    send: function(content) {
      return options.document.body.innerHTML = content;
    },
    render: function(view, locals) {
      if (store["view engine"]) {
        var engineFunction = engines[store["view engine"]];
        engineFunction(view, locals, options);
      }
    },
    setHeader: function() {}
  };

  var app = {
    get: function(route, handler) {
      if (arguments.length == 1 && typeof(route) == "string") {
        var key = route;
        return store[key];
      }
      Router.get(route, function(req) {
        async.each(stack, function(fn, callback) {
          fn(req, res, callback);
        }, function() {
          handler(req, res);
        });
      });
    },
    post: function(action, handler) {
      Router.post(action, function(req) {
        async.each(stack, function(fn, callback) {
          fn(req, res, callback);
        }, function() {
          handler(req, res);
        }); 
      });
    },
    set: function(key, value) {
      store[key] = value;
    },
    engine: function(engineKey, fn) {
      engines[engineKey] = fn;
    },
    use: function(fn) {
      stack.push(fn);
    },
    listen: function(callback) {
      var router = Router.listen({
        root: "/", // base path for the handlers.
        usePushState: true, // is pushState of history API desired?
        hashChange: true, // is hashChange desired?
        silent: false, // don't try to load handlers for the current path?
        usePost: options.interceptFormSubmit || false // should listen for all submit events on post?
      });
      if (callback) {
        callback();
      }
      return {
        close: function() {
          Router.stop();
          if (options.interceptLinks) {
            options.document.body.removeEventListener("click", linkHandler, true);
          }
        }
      }
    },
    navigate: function(route) {
      Router.navigate(route);
    },
    submit: function(action, body) {
      Router.submit(action, body);
    }
  }

  return app;

};