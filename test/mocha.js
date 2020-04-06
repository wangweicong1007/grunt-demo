(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
    (function (process,global){
    'use strict';
    
    /* eslint no-unused-vars: off */
    /* eslint-env commonjs */
    
    /**
     * Shim process.stdout.
     */
    
    process.stdout = require('browser-stdout')({label: false});
    
    var Mocha = require('./lib/mocha');
    
    /**
     * Create a Mocha instance.
     *
     * @return {undefined}
     */
    
    var mocha = new Mocha({reporter: 'html'});
    
    /**
     * Save timer references to avoid Sinon interfering (see GH-237).
     */
    
    var Date = global.Date;
    var setTimeout = global.setTimeout;
    var setInterval = global.setInterval;
    var clearTimeout = global.clearTimeout;
    var clearInterval = global.clearInterval;
    
    var uncaughtExceptionHandlers = [];
    
    var originalOnerrorHandler = global.onerror;
    
    /**
     * Remove uncaughtException listener.
     * Revert to original onerror handler if previously defined.
     */
    
    process.removeListener = function(e, fn) {
      if (e === 'uncaughtException') {
        if (originalOnerrorHandler) {
          global.onerror = originalOnerrorHandler;
        } else {
          global.onerror = function() {};
        }
        var i = uncaughtExceptionHandlers.indexOf(fn);
        if (i !== -1) {
          uncaughtExceptionHandlers.splice(i, 1);
        }
      }
    };
    
    /**
     * Implements uncaughtException listener.
     */
    
    process.on = function(e, fn) {
      if (e === 'uncaughtException') {
        global.onerror = function(err, url, line) {
          fn(new Error(err + ' (' + url + ':' + line + ')'));
          return !mocha.options.allowUncaught;
        };
        uncaughtExceptionHandlers.push(fn);
      }
    };
    
    // The BDD UI is registered by default, but no UI will be functional in the
    // browser without an explicit call to the overridden `mocha.ui` (see below).
    // Ensure that this default UI does not expose its methods to the global scope.
    mocha.suite.removeAllListeners('pre-require');
    
    var immediateQueue = [];
    var immediateTimeout;
    
    function timeslice() {
      var immediateStart = new Date().getTime();
      while (immediateQueue.length && new Date().getTime() - immediateStart < 100) {
        immediateQueue.shift()();
      }
      if (immediateQueue.length) {
        immediateTimeout = setTimeout(timeslice, 0);
      } else {
        immediateTimeout = null;
      }
    }
    
    /**
     * High-performance override of Runner.immediately.
     */
    
    Mocha.Runner.immediately = function(callback) {
      immediateQueue.push(callback);
      if (!immediateTimeout) {
        immediateTimeout = setTimeout(timeslice, 0);
      }
    };
    
/**
 * Function to allow assertion libraries to throw errors directly into mocha.
 * This is useful when running tests in a browser because window.onerror will
 * only receive the 'message' attribute of the Error.
 */
mocha.throwError = function(err) {
    uncaughtExceptionHandlers.forEach(function(fn) {
      fn(err);
    });
    throw err;
  };
  
  /**
   * Override ui to ensure that the ui functions are initialized.
   * Normally this would happen in Mocha.prototype.loadFiles.
   */
  
  mocha.ui = function(ui) {
    Mocha.prototype.ui.call(this, ui);
    this.suite.emit('pre-require', global, null, this);
    return this;
  };
  
  /**
   * Setup mocha with the given setting options.
   */
  
  mocha.setup = function(opts) {
    if (typeof opts === 'string') {
      opts = {ui: opts};
    }
    for (var opt in opts) {
      if (Object.prototype.hasOwnProperty.call(opts, opt)) {
        this[opt](opts[opt]);
      }
    }
    return this;
  };
  
  /**
   * Run mocha, returning the Runner.
   */
  
  mocha.run = function(fn) {
    var options = mocha.options;
    mocha.globals('location');
  
    var query = Mocha.utils.parseQuery(global.location.search || '');
    if (query.grep) {
      mocha.grep(query.grep);
    }
    if (query.fgrep) {
      mocha.fgrep(query.fgrep);
    }
    if (query.invert) {
      mocha.invert();
    }
  
    return Mocha.prototype.run.call(mocha, function(err) {
      // The DOM Document is not available in Web Workers.
      var document = global.document;
      if (
        document &&
        document.getElementById('mocha') &&
        options.noHighlighting !== true
      ) {
        Mocha.utils.highlightTags('code');
      }
      if (fn) {
        fn(err);
      }
    });
  };
  
  /**
   * Expose the process shim.
   * https://github.com/mochajs/mocha/pull/916
   */
  
  Mocha.process = process;
  
  /**
   * Expose mocha.
   */
  
  global.Mocha = Mocha;
  global.mocha = mocha;
  
  // this allows test/acceptance/required-tokens.js to pass; thus,
  // you can now do `const describe = require('mocha').describe` in a
  // browser context (assuming browserification).  should fix #880
  module.exports = global;
  
  }).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
  },{"./lib/mocha":14,"_process":69,"browser-stdout":41}],2:[function(require,module,exports){
  (function (process,global){
  'use strict';
  
  /**
   * Web Notifications module.
   * @module Growl
   */
  
  /**
   * Save timer references to avoid Sinon interfering (see GH-237).
   */
  var Date = global.Date;
  var setTimeout = global.setTimeout;
  var EVENT_RUN_END = require('../runner').constants.EVENT_RUN_END;
  
  /**
   * Checks if browser notification support exists.
   *
   * @public
   * @see {@link https://caniuse.com/#feat=notifications|Browser support (notifications)}
   * @see {@link https://caniuse.com/#feat=promises|Browser support (promises)}
   * @see {@link Mocha#growl}
   * @see {@link Mocha#isGrowlCapable}
   * @return {boolean} whether browser notification support exists
   */
  exports.isCapable = function() {
    var hasNotificationSupport = 'Notification' in window;
    var hasPromiseSupport = typeof Promise === 'function';
    return process.browser && hasNotificationSupport && hasPromiseSupport;
  };
  
  /**
   * Implements browser notifications as a pseudo-reporter.
   *
   * @public
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/notification|Notification API}
   * @see {@link https://developers.google.com/web/fundamentals/push-notifications/display-a-notification|Displaying a Notification}
   * @see {@link Growl#isPermitted}
   * @see {@link Mocha#_growl}
   * @param {Runner} runner - Runner instance.
   */
  exports.notify = function(runner) {
    var promise = isPermitted();
  
    /**
     * Attempt notification.
     */
    var sendNotification = function() {
      // If user hasn't responded yet... "No notification for you!" (Seinfeld)
      Promise.race([promise, Promise.resolve(undefined)])
        .then(canNotify)
        .then(function() {
          display(runner);
        })
        .catch(notPermitted);
    };
  
    runner.once(EVENT_RUN_END, sendNotification);
  };
  
  /**
   * Checks if browser notification is permitted by user.
   *
   * @private
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Notification/permission|Notification.permission}
   * @see {@link Mocha#growl}
   * @see {@link Mocha#isGrowlPermitted}
   * @returns {Promise<boolean>} promise determining if browser notification
   *     permissible when fulfilled.
   */
  function isPermitted() {
    var permitted = {
      granted: function allow() {
        return Promise.resolve(true);
      },
      denied: function deny() {
        return Promise.resolve(false);
      },
      default: function ask() {
        return Notification.requestPermission().then(function(permission) {
          return permission === 'granted';
        });
      }
    };
  
    return permitted[Notification.permission]();
  }
  /**
   * @summary
   * Determines if notification should proceed.
   *
   * @description
   * Notification shall <strong>not</strong> proceed unless `value` is true.
   *
   * `value` will equal one of:
   * <ul>
   *   <li><code>true</code> (from `isPermitted`)</li>
   *   <li><code>false</code> (from `isPermitted`)</li>
   *   <li><code>undefined</code> (from `Promise.race`)</li>
   * </ul>
   *
   * @private
   * @param {boolean|undefined} value - Determines if notification permissible.
   * @returns {Promise<undefined>} Notification can proceed
   */
  function canNotify(value) {
    if (!value) {
      var why = value === false ? 'blocked' : 'unacknowledged';
      var reason = 'not permitted by user (' + why + ')';
      return Promise.reject(new Error(reason));
    }
    return Promise.resolve();
  }
  
  /**
   * Displays the notification.
   *
   * @private
   * @param {Runner} runner - Runner instance.
   */
  function display(runner) {
    var stats = runner.stats;
    var symbol = {
      cross: '\u274C',
      tick: '\u2705'
    };
    var logo = require('../../package').notifyLogo;
    var _message;
    var message;
    var title;
  
    if (stats.failures) {
      _message = stats.failures + ' of ' + stats.tests + ' tests failed';
      message = symbol.cross + ' ' + _message;
      title = 'Failed';
    } else {
      _message = stats.passes + ' tests passed in ' + stats.duration + 'ms';
      message = symbol.tick + ' ' + _message;
      title = 'Passed';
    }
  
    // Send notification
    var options = {
      badge: logo,
      body: message,
      dir: 'ltr',
      icon: logo,
      lang: 'en-US',
      name: 'mocha',
      requireInteraction: false,
      timestamp: Date.now()
    };
    var notification = new Notification(title, options);
  
    // Autoclose after brief delay (makes various browsers act same)
    var FORCE_DURATION = 4000;
    setTimeout(notification.close.bind(notification), FORCE_DURATION);
  }
  
  /**
   * As notifications are tangential to our purpose, just log the error.
   *
   * @private
   * @param {Error} err - Why notification didn't happen.
   */
  function notPermitted(err) {
    console.error('notification error:', err.message);
  }
  
  }).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
  },{"../../package":90,"../runner":34,"_process":69}],3:[function(require,module,exports){
  'use strict';
  
  /**
   * Expose `Progress`.
   */
  
  module.exports = Progress;
  
  /**
   * Initialize a new `Progress` indicator.
   */
  function Progress() {
    this.percent = 0;
    this.size(0);
    this.fontSize(11);
    this.font('helvetica, arial, sans-serif');
  }
  
  /**
   * Set progress size to `size`.
   *
   * @public
   * @param {number} size
   * @return {Progress} Progress instance.
   */
  Progress.prototype.size = function(size) {
    this._size = size;
    return this;
  };
  
  /**
   * Set text to `text`.
   *
   * @public
   * @param {string} text
   * @return {Progress} Progress instance.
   */
  Progress.prototype.text = function(text) {
    this._text = text;
    return this;
  };
  
  /**
   * Set font size to `size`.
   *
   * @public
   * @param {number} size
   * @return {Progress} Progress instance.
   */
  Progress.prototype.fontSize = function(size) {
    this._fontSize = size;
    return this;
  };
  
  /**
   * Set font to `family`.
   *
   * @param {string} family
   * @return {Progress} Progress instance.
   */
  Progress.prototype.font = function(family) {
    this._font = family;
    return this;
  };
  
  /**
   * Update percentage to `n`.
   *
   * @param {number} n
   * @return {Progress} Progress instance.
   */
  Progress.prototype.update = function(n) {
    this.percent = n;
    return this;
  };
  
  /**
   * Draw on `ctx`.
   *
   * @param {CanvasRenderingContext2d} ctx
   * @return {Progress} Progress instance.
   */
  Progress.prototype.draw = function(ctx) {
    try {
      var percent = Math.min(this.percent, 100);
      var size = this._size;
      var half = size / 2;
      var x = half;
      var y = half;
      var rad = half - 1;
      var fontSize = this._fontSize;
  
      ctx.font = fontSize + 'px ' + this._font;
  
      var angle = Math.PI * 2 * (percent / 100);
      ctx.clearRect(0, 0, size, size);
  
      // outer circle
      ctx.strokeStyle = '#9f9f9f';
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, angle, false);
      ctx.stroke();
  
      // inner circle
      ctx.strokeStyle = '#eee';
      ctx.beginPath();
      ctx.arc(x, y, rad - 1, 0, angle, true);
      ctx.stroke();
  
      // text
      var text = this._text || (percent | 0) + '%';
      var w = ctx.measureText(text).width;
  
      ctx.fillText(text, x - w / 2 + 1, y + fontSize / 2 - 1);
    } catch (ignore) {
      // don't fail if we can't render progress
    }
    return this;
  };
  
  },{}],4:[function(require,module,exports){
  (function (global){
  'use strict';
  
  exports.isatty = function isatty() {
    return true;
  };
  
  exports.getWindowSize = function getWindowSize() {
    if ('innerHeight' in global) {
      return [global.innerHeight, global.innerWidth];
    }
    // In a Web Worker, the DOM Window is not available.
    return [640, 480];
  };
  
  }).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
  },{}],5:[function(require,module,exports){
  'use strict';
  /**
   * @module Context
   */
  /**
   * Expose `Context`.
   */
  
  module.exports = Context;
  
  /**
   * Initialize a new `Context`.
   *
   * @private
   */
  function Context() {}
  
/**
 * Set or get the context `Runnable` to `runnable`.
 *
 * @private
 * @param {Runnable} runnable
 * @return {Context} context
 */
Context.prototype.runnable = function(runnable) {
    if (!arguments.length) {
      return this._runnable;
    }
    this.test = this._runnable = runnable;
    return this;
  };
  
  /**
   * Set or get test timeout `ms`.
   *
   * @private
   * @param {number} ms
   * @return {Context} self
   */
  Context.prototype.timeout = function(ms) {
    if (!arguments.length) {
      return this.runnable().timeout();
    }
    this.runnable().timeout(ms);
    return this;
  };
  
  /**
   * Set test timeout `enabled`.
   *
   * @private
   * @param {boolean} enabled
   * @return {Context} self
   */
  Context.prototype.enableTimeouts = function(enabled) {
    if (!arguments.length) {
      return this.runnable().enableTimeouts();
    }
    this.runnable().enableTimeouts(enabled);
    return this;
  };
  
  /**
   * Set or get test slowness threshold `ms`.
   *
   * @private
   * @param {number} ms
   * @return {Context} self
   */
  Context.prototype.slow = function(ms) {
    if (!arguments.length) {
      return this.runnable().slow();
    }
    this.runnable().slow(ms);
    return this;
  };
  
  /**
   * Mark a test as skipped.
   *
   * @private
   * @throws Pending
   */
  Context.prototype.skip = function() {
    this.runnable().skip();
  };
  
  /**
   * Set or get a number of allowed retries on failed tests
   *
   * @private
   * @param {number} n
   * @return {Context} self
   */
  Context.prototype.retries = function(n) {
    if (!arguments.length) {
      return this.runnable().retries();
    }
    this.runnable().retries(n);
    return this;
  };
  
  },{}],6:[function(require,module,exports){
  'use strict';
  /**
   * @module Errors
   */
  /**
   * Factory functions to create throwable error objects
   */
  
  /**
   * Creates an error object to be thrown when no files to be tested could be found using specified pattern.
   *
   * @public
   * @param {string} message - Error message to be displayed.
   * @param {string} pattern - User-specified argument value.
   * @returns {Error} instance detailing the error condition
   */
  function createNoFilesMatchPatternError(message, pattern) {
    var err = new Error(message);
    err.code = 'ERR_MOCHA_NO_FILES_MATCH_PATTERN';
    err.pattern = pattern;
    return err;
  }
  
  /**
   * Creates an error object to be thrown when the reporter specified in the options was not found.
   *
   * @public
   * @param {string} message - Error message to be displayed.
   * @param {string} reporter - User-specified reporter value.
   * @returns {Error} instance detailing the error condition
   */
  function createInvalidReporterError(message, reporter) {
    var err = new TypeError(message);
    err.code = 'ERR_MOCHA_INVALID_REPORTER';
    err.reporter = reporter;
    return err;
  }
  
  /**
   * Creates an error object to be thrown when the interface specified in the options was not found.
   *
   * @public
   * @param {string} message - Error message to be displayed.
   * @param {string} ui - User-specified interface value.
   * @returns {Error} instance detailing the error condition
   */
  function createInvalidInterfaceError(message, ui) {
    var err = new Error(message);
    err.code = 'ERR_MOCHA_INVALID_INTERFACE';
    err.interface = ui;
    return err;
  }
  
  /**
   * Creates an error object to be thrown when a behavior, option, or parameter is unsupported.
   *
   * @public
   * @param {string} message - Error message to be displayed.
   * @returns {Error} instance detailing the error condition
   */
  function createUnsupportedError(message) {
    var err = new Error(message);
    err.code = 'ERR_MOCHA_UNSUPPORTED';
    return err;
  }
  
  /**
   * Creates an error object to be thrown when an argument is missing.
   *
   * @public
   * @param {string} message - Error message to be displayed.
   * @param {string} argument - Argument name.
   * @param {string} expected - Expected argument datatype.
   * @returns {Error} instance detailing the error condition
   */
  function createMissingArgumentError(message, argument, expected) {
    return createInvalidArgumentTypeError(message, argument, expected);
  }
  
  /**
   * Creates an error object to be thrown when an argument did not use the supported type
   *
   * @public
   * @param {string} message - Error message to be displayed.
   * @param {string} argument - Argument name.
   * @param {string} expected - Expected argument datatype.
   * @returns {Error} instance detailing the error condition
   */
  function createInvalidArgumentTypeError(message, argument, expected) {
    var err = new TypeError(message);
    err.code = 'ERR_MOCHA_INVALID_ARG_TYPE';
    err.argument = argument;
    err.expected = expected;
    err.actual = typeof argument;
    return err;
  }
  
  /**
   * Creates an error object to be thrown when an argument did not use the supported value
   *
   * @public
   * @param {string} message - Error message to be displayed.
   * @param {string} argument - Argument name.
   * @param {string} value - Argument value.
   * @param {string} [reason] - Why value is invalid.
   * @returns {Error} instance detailing the error condition
   */
  function createInvalidArgumentValueError(message, argument, value, reason) {
    var err = new TypeError(message);
    err.code = 'ERR_MOCHA_INVALID_ARG_VALUE';
    err.argument = argument;
    err.value = value;
    err.reason = typeof reason !== 'undefined' ? reason : 'is invalid';
    return err;
  }
  
  /**
   * Creates an error object to be thrown when an exception was caught, but the `Error` is falsy or undefined.
   *
   * @public
   * @param {string} message - Error message to be displayed.
   * @returns {Error} instance detailing the error condition
   */
  function createInvalidExceptionError(message, value) {
    var err = new Error(message);
    err.code = 'ERR_MOCHA_INVALID_EXCEPTION';
    err.valueType = typeof value;
    err.value = value;
    return err;
  }
  
  module.exports = {
    createInvalidArgumentTypeError: createInvalidArgumentTypeError,
    createInvalidArgumentValueError: createInvalidArgumentValueError,
    createInvalidExceptionError: createInvalidExceptionError,
    createInvalidInterfaceError: createInvalidInterfaceError,
    createInvalidReporterError: createInvalidReporterError,
    createMissingArgumentError: createMissingArgumentError,
    createNoFilesMatchPatternError: createNoFilesMatchPatternError,
    createUnsupportedError: createUnsupportedError
  };
  
  },{}],7:[function(require,module,exports){
  'use strict';
  
  var Runnable = require('./runnable');
  var inherits = require('./utils').inherits;
  
  /**
   * Expose `Hook`.
   */
  
module.exports = Hook;

/**
 * Initialize a new `Hook` with the given `title` and callback `fn`
 *
 * @class
 * @extends Runnable
 * @param {String} title
 * @param {Function} fn
 */
function Hook(title, fn) {
  Runnable.call(this, title, fn);
  this.type = 'hook';
}

/**
 * Inherit from `Runnable.prototype`.
 */
inherits(Hook, Runnable);

/**
 * Get or set the test `err`.
 *
 * @memberof Hook
 * @public
 * @param {Error} err
 * @return {Error}
 */
Hook.prototype.error = function(err) {
  if (!arguments.length) {
    err = this._error;
    this._error = null;
    return err;
  }

  this._error = err;
};

},{"./runnable":33,"./utils":38}],8:[function(require,module,exports){
'use strict';

var Test = require('../test');
var EVENT_FILE_PRE_REQUIRE = require('../suite').constants
  .EVENT_FILE_PRE_REQUIRE;

/**
 * BDD-style interface:
 *
 *      describe('Array', function() {
 *        describe('#indexOf()', function() {
 *          it('should return -1 when not present', function() {
 *            // ...
 *          });
 *
 *          it('should return the index when present', function() {
 *            // ...
 *          });
 *        });
 *      });
 *
 * @param {Suite} suite Root suite.
 */
module.exports = function bddInterface(suite) {
  var suites = [suite];

  suite.on(EVENT_FILE_PRE_REQUIRE, function(context, file, mocha) {
    var common = require('./common')(suites, context, mocha);

    context.before = common.before;
    context.after = common.after;
    context.beforeEach = common.beforeEach;
    context.afterEach = common.afterEach;
    context.run = mocha.options.delay && common.runWithSuite(suite);
    /**
     * Describe a "suite" with the given `title`
     * and callback `fn` containing nested suites
     * and/or tests.
     */

    context.describe = context.context = function(title, fn) {
      return common.suite.create({
        title: title,
        file: file,
        fn: fn
      });
    };

    /**
     * Pending describe.
     */

    context.xdescribe = context.xcontext = context.describe.skip = function(
      title,
      fn
    ) {
      return common.suite.skip({
        title: title,
        file: file,
        fn: fn
      });
    };

    /**
     * Exclusive suite.
     */

    context.describe.only = function(title, fn) {
      return common.suite.only({
        title: title,
        file: file,
        fn: fn
      });
    };

    /**
     * Describe a specification or test-case
     * with the given `title` and callback `fn`
     * acting as a thunk.
     */

    context.it = context.specify = function(title, fn) {
      var suite = suites[0];
      if (suite.isPending()) {
        fn = null;
      }
      var test = new Test(title, fn);
      test.file = file;
      suite.addTest(test);
      return test;
    };

    /**
     * Exclusive test-case.
     */

    context.it.only = function(title, fn) {
      return common.test.only(mocha, context.it(title, fn));
    };

    /**
     * Pending test case.
     */

    context.xit = context.xspecify = context.it.skip = function(title) {
      return context.it(title);
    };

    /**
     * Number of attempts to retry.
     */
    context.it.retries = function(n) {
      context.retries(n);
    };
  });
};

module.exports.description = 'BDD or RSpec style [default]';

},{"../suite":36,"../test":37,"./common":9}],9:[function(require,module,exports){
'use strict';

var Suite = require('../suite');
var errors = require('../errors');
var createMissingArgumentError = errors.createMissingArgumentError;

/**
 * Functions common to more than one interface.
 *
 * @param {Suite[]} suites
 * @param {Context} context
 * @param {Mocha} mocha
 * @return {Object} An object containing common functions.
 */
module.exports = function(suites, context, mocha) {
  /**
   * Check if the suite should be tested.
   *
   * @private
   * @param {Suite} suite - suite to check
   * @returns {boolean}
   */
  function shouldBeTested(suite) {
    return (
      !mocha.options.grep ||
      (mocha.options.grep &&
        mocha.options.grep.test(suite.fullTitle()) &&
        !mocha.options.invert)
    );
  }

  return {
    /**
     * This is only present if flag --delay is passed into Mocha. It triggers
     * root suite execution.
     *
     * @param {Suite} suite The root suite.
     * @return {Function} A function which runs the root suite
     */
    runWithSuite: function runWithSuite(suite) {
      return function run() {
        suite.run();
      };
    },

    /**
     * Execute before running tests.
     *
     * @param {string} name
     * @param {Function} fn
     */
    before: function(name, fn) {
      suites[0].beforeAll(name, fn);
    },

    /**
     * Execute after running tests.
     *
     * @param {string} name
     * @param {Function} fn
     */
    after: function(name, fn) {
      suites[0].afterAll(name, fn);
    },

    /**
     * Execute before each test case.
     *
     * @param {string} name
     * @param {Function} fn
     */
    beforeEach: function(name, fn) {
      suites[0].beforeEach(name, fn);
    },

    /**
     * Execute after each test case.
     *
     * @param {string} name
     * @param {Function} fn
     */
    afterEach: function(name, fn) {
      suites[0].afterEach(name, fn);
    },

    suite: {
      /**
       * Create an exclusive Suite; convenience function
       * See docstring for create() below.
       *
       * @param {Object} opts
       * @returns {Suite}
       */
      only: function only(opts) {
        opts.isOnly = true;
        return this.create(opts);
      },

      /**
       * Create a Suite, but skip it; convenience function
       * See docstring for create() below.
       *
       * @param {Object} opts
       * @returns {Suite}
       */
      skip: function skip(opts) {
        opts.pending = true;
        return this.create(opts);
      },

      /**
       * Creates a suite.
       *
       * @param {Object} opts Options
       * @param {string} opts.title Title of Suite
       * @param {Function} [opts.fn] Suite Function (not always applicable)
       * @param {boolean} [opts.pending] Is Suite pending?
       * @param {string} [opts.file] Filepath where this Suite resides
       * @param {boolean} [opts.isOnly] Is Suite exclusive?
       * @returns {Suite}
       */
      create: function create(opts) {
        var suite = Suite.create(suites[0], opts.title);
        suite.pending = Boolean(opts.pending);
        suite.file = opts.file;
        suites.unshift(suite);
        if (opts.isOnly) {
          if (mocha.options.forbidOnly && shouldBeTested(suite)) {
            throw new Error('`.only` forbidden');
          }

          suite.parent.appendOnlySuite(suite);
        }
        if (suite.pending) {
          if (mocha.options.forbidPending && shouldBeTested(suite)) {
            throw new Error('Pending test forbidden');
          }
        }
        if (typeof opts.fn === 'function') {
          opts.fn.call(suite);
          suites.shift();
        } else if (typeof opts.fn === 'undefined' && !suite.pending) {
          throw createMissingArgumentError(
            'Suite "' +
              suite.fullTitle() +
              '" was defined but no callback was supplied. ' +
              'Supply a callback or explicitly skip the suite.',
            'callback',
            'function'
          );
        } else if (!opts.fn && suite.pending) {
          suites.shift();
        }

        return suite;
      }
    },

    test: {
      /**
       * Exclusive test-case.
       *
       * @param {Object} mocha
       * @param {Function} test
       * @returns {*}
       */
      only: function(mocha, test) {
        test.parent.appendOnlyTest(test);
        return test;
      },

      /**
       * Pending test case.
       *
       * @param {string} title
       */
      skip: function(title) {
        context.test(title);
      },

      /**
       * Number of retry attempts
       *
       * @param {number} n
       */
      retries: function(n) {
        context.retries(n);
      }
    }
  };
};
},{"../errors":6,"../suite":36}],10:[function(require,module,exports){
'use strict';
var Suite = require('../suite');
var Test = require('../test');

/**
 * Exports-style (as Node.js module) interface:
 *
 *     exports.Array = {
 *       '#indexOf()': {
 *         'should return -1 when the value is not present': function() {
 *
 *         },
 *
 *         'should return the correct index when the value is present': function() {
 *
 *         }
 *       }
 *     };
 *
 * @param {Suite} suite Root suite.
 */
module.exports = function(suite) {
  var suites = [suite];

  suite.on(Suite.constants.EVENT_FILE_REQUIRE, visit);

  function visit(obj, file) {
    var suite;
    for (var key in obj) {
      if (typeof obj[key] === 'function') {
        var fn = obj[key];
        switch (key) {
          case 'before':
            suites[0].beforeAll(fn);
            break;
          case 'after':
            suites[0].afterAll(fn);
            break;
          case 'beforeEach':
            suites[0].beforeEach(fn);
            break;
          case 'afterEach':
            suites[0].afterEach(fn);
            break;
          default:
            var test = new Test(key, fn);
            test.file = file;
            suites[0].addTest(test);
        }
      } else {
        suite = Suite.create(suites[0], key);
        suites.unshift(suite);
        visit(obj[key], file);
        suites.shift();
      }
    }
  }
};

module.exports.description = 'Node.js module ("exports") style';

},{"../suite":36,"../test":37}],11:[function(require,module,exports){
'use strict';

exports.bdd = require('./bdd');
exports.tdd = require('./tdd');
exports.qunit = require('./qunit');
exports.exports = require('./exports');

},{"./bdd":8,"./exports":10,"./qunit":12,"./tdd":13}],12:[function(require,module,exports){
'use strict';

var Test = require('../test');
var EVENT_FILE_PRE_REQUIRE = require('../suite').constants
  .EVENT_FILE_PRE_REQUIRE;

/**
 * QUnit-style interface:
 *
 *     suite('Array');
 *
 *     test('#length', function() {
 *       var arr = [1,2,3];
 *       ok(arr.length == 3);
 *     });
 *
 *     test('#indexOf()', function() {
 *       var arr = [1,2,3];
 *       ok(arr.indexOf(1) == 0);
 *       ok(arr.indexOf(2) == 1);
 *       ok(arr.indexOf(3) == 2);
 *     });
 *
 *     suite('String');
 *
 *     test('#length', function() {
 *       ok('foo'.length == 3);
 *     });
 *
 * @param {Suite} suite Root suite.
 */
module.exports = function qUnitInterface(suite) {
  var suites = [suite];

  suite.on(EVENT_FILE_PRE_REQUIRE, function(context, file, mocha) {
    var common = require('./common')(suites, context, mocha);

    context.before = common.before;
    context.after = common.after;
    context.beforeEach = common.beforeEach;
    context.afterEach = common.afterEach;
    context.run = mocha.options.delay && common.runWithSuite(suite);
    /**
     * Describe a "suite" with the given `title`.
     */

    context.suite = function(title) {
      if (suites.length > 1) {
        suites.shift();
      }
      return common.suite.create({
        title: title,
        file: file,
        fn: false
      });
    };

    /**
     * Exclusive Suite.
     */

    context.suite.only = function(title) {
      if (suites.length > 1) {
        suites.shift();
      }
      return common.suite.only({
        title: title,
        file: file,
        fn: false
      });
    };

    /**
     * Describe a specification or test-case
     * with the given `title` and callback `fn`
     * acting as a thunk.
     */

    context.test = function(title, fn) {
      var test = new Test(title, fn);
      test.file = file;
      suites[0].addTest(test);
      return test;
    };

    /**
     * Exclusive test-case.
     */

    context.test.only = function(title, fn) {
      return common.test.only(mocha, context.test(title, fn));
    };

    context.test.skip = common.test.skip;
    context.test.retries = common.test.retries;
  });
};

module.exports.description = 'QUnit style';

},{"../suite":36,"../test":37,"./common":9}],13:[function(require,module,exports){
'use strict';

var Test = require('../test');
var EVENT_FILE_PRE_REQUIRE = require('../suite').constants
  .EVENT_FILE_PRE_REQUIRE;

/**
 * TDD-style interface:
 *
 *      suite('Array', function() {
 *        suite('#indexOf()', function() {
 *          suiteSetup(function() {
 *
 *          });
 *
 *          test('should return -1 when not present', function() {
 *
 *          });
 *
 *          test('should return the index when present', function() {
 *
 *          });
 *
 *          suiteTeardown(function() {
 *
 *          });
 *        });
 *      });
 *
 * @param {Suite} suite Root suite.
 */
module.exports = function(suite) {
  var suites = [suite];

  suite.on(EVENT_FILE_PRE_REQUIRE, function(context, file, mocha) {
    var common = require('./common')(suites, context, mocha);

    context.setup = common.beforeEach;
    context.teardown = common.afterEach;
    context.suiteSetup = common.before;
    context.suiteTeardown = common.after;
    context.run = mocha.options.delay && common.runWithSuite(suite);

    /**
     * Describe a "suite" with the given `title` and callback `fn` containing
     * nested suites and/or tests.
     */
    context.suite = function(title, fn) {
      return common.suite.create({
        title: title,
        file: file,
        fn: fn
      });
    };

    /**
     * Pending suite.
     */
    context.suite.skip = function(title, fn) {
      return common.suite.skip({
        title: title,
        file: file,
        fn: fn
      });
    };

    /**
     * Exclusive test-case.
     */
    context.suite.only = function(title, fn) {
      return common.suite.only({
        title: title,
        file: file,
        fn: fn
      });
    };

    /**
     * Describe a specification or test-case with the given `title` and
     * callback `fn` acting as a thunk.
     */
    context.test = function(title, fn) {
      var suite = suites[0];
      if (suite.isPending()) {
        fn = null;
      }
      var test = new Test(title, fn);
      test.file = file;
      suite.addTest(test);
      return test;
    };

    /**
     * Exclusive test-case.
     */

    context.test.only = function(title, fn) {
      return common.test.only(mocha, context.test(title, fn));
    };

    context.test.skip = common.test.skip;
    context.test.retries = common.test.retries;
  });
};

module.exports.description =
  'traditional "suite"/"test" instead of BDD\'s "describe"/"it"';

},{"../suite":36,"../test":37,"./common":9}],14:[function(require,module,exports){
(function (process,global){
'use strict';

/*!
 * mocha
 * Copyright(c) 2011 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

var escapeRe = require('escape-string-regexp');
var path = require('path');
var builtinReporters = require('./reporters');
var growl = require('./growl');
var utils = require('./utils');
var mocharc = require('./mocharc.json');
var errors = require('./errors');
var Suite = require('./suite');
var esmUtils = utils.supportsEsModules() ? require('./esm-utils') : undefined;
var createStatsCollector = require('./stats-collector');
var createInvalidReporterError = errors.createInvalidReporterError;
var createInvalidInterfaceError = errors.createInvalidInterfaceError;
var EVENT_FILE_PRE_REQUIRE = Suite.constants.EVENT_FILE_PRE_REQUIRE;
var EVENT_FILE_POST_REQUIRE = Suite.constants.EVENT_FILE_POST_REQUIRE;
var EVENT_FILE_REQUIRE = Suite.constants.EVENT_FILE_REQUIRE;
var sQuote = utils.sQuote;

exports = module.exports = Mocha;

/**
 * To require local UIs and reporters when running in node.
 */

if (!process.browser) {
  var cwd = process.cwd();
  module.paths.push(cwd, path.join(cwd, 'node_modules'));
}

/**
 * Expose internals.
 */

/**
 * @public
 * @class utils
 * @memberof Mocha
 */
exports.utils = utils;
exports.interfaces = require('./interfaces');
/**
 * @public
 * @memberof Mocha
 */
exports.reporters = builtinReporters;
exports.Runnable = require('./runnable');
exports.Context = require('./context');
/**
 *
 * @memberof Mocha
 */
exports.Runner = require('./runner');
exports.Suite = Suite;
exports.Hook = require('./hook');
exports.Test = require('./test');

/**
 * Constructs a new Mocha instance with `options`.
 *
 * @public
 * @class Mocha
 * @param {Object} [options] - Settings object.
 * @param {boolean} [options.allowUncaught] - Propagate uncaught errors?
 * @param {boolean} [options.asyncOnly] - Force `done` callback or promise?
 * @param {boolean} [options.bail] - Bail after first test failure?
 * @param {boolean} [options.checkLeaks] - Check for global variable leaks?
 * @param {boolean} [options.color] - Color TTY output from reporter?
 * @param {boolean} [options.delay] - Delay root suite execution?
 * @param {boolean} [options.diff] - Show diff on failure?
 * @param {string} [options.fgrep] - Test filter given string.
 * @param {boolean} [options.forbidOnly] - Tests marked `only` fail the suite?
 * @param {boolean} [options.forbidPending] - Pending tests fail the suite?
 * @param {boolean} [options.fullTrace] - Full stacktrace upon failure?
 * @param {string[]} [options.global] - Variables expected in global scope.
 * @param {RegExp|string} [options.grep] - Test filter given regular expression.
 * @param {boolean} [options.growl] - Enable desktop notifications?
 * @param {boolean} [options.inlineDiffs] - Display inline diffs?
 * @param {boolean} [options.invert] - Invert test filter matches?
 * @param {boolean} [options.noHighlighting] - Disable syntax highlighting?
 * @param {string|constructor} [options.reporter] - Reporter name or constructor.
 * @param {Object} [options.reporterOption] - Reporter settings object.
 * @param {number} [options.retries] - Number of times to retry failed tests.
 * @param {number} [options.slow] - Slow threshold value.
 * @param {number|string} [options.timeout] - Timeout threshold value.
 * @param {string} [options.ui] - Interface name.
 */
function Mocha(options) {
  options = utils.assign({}, mocharc, options || {});
  this.files = [];
  this.options = options;
  // root suite
  this.suite = new exports.Suite('', new exports.Context(), true);

  this.grep(options.grep)
    .fgrep(options.fgrep)
    .ui(options.ui)
    .reporter(
      options.reporter,
      options.reporterOption || options.reporterOptions // reporterOptions was previously the only way to specify options to reporter
    )
    .slow(options.slow)
    .global(options.global);

  // this guard exists because Suite#timeout does not consider `undefined` to be valid input
  if (typeof options.timeout !== 'undefined') {
    this.timeout(options.timeout === false ? 0 : options.timeout);
  }

  if ('retries' in options) {
    this.retries(options.retries);
  }

  [
    'allowUncaught',
    'asyncOnly',
    'bail',
    'checkLeaks',
    'color',
    'delay',
    'diff',
    'forbidOnly',
    'forbidPending',
    'fullTrace',
    'growl',
    'inlineDiffs',
    'invert'
  ].forEach(function(opt) {
    if (options[opt]) {
      this[opt]();
    }
  }, this);
}

/**
 * Enables or disables bailing on the first failure.
 *
 * @public
 * @see [CLI option](../#-bail-b)
 * @param {boolean} [bail=true] - Whether to bail on first error.
 * @returns {Mocha} this
 * @chainable
 */
Mocha.prototype.bail = function(bail) {
  this.suite.bail(bail !== false);
  return this;
};

/**
 * @summary
 * Adds `file` to be loaded for execution.
 *
 * @description
 * Useful for generic setup code that must be included within test suite.
 *
 * @public
 * @see [CLI option](../#-file-filedirectoryglob)
 * @param {string} file - Pathname of file to be loaded.
 * @returns {Mocha} this
 * @chainable
 */
Mocha.prototype.addFile = function(file) {
  this.files.push(file);
  return this;
};

/**
 * Sets reporter to `reporter`, defaults to "spec".
 *
 * @public
 * @see [CLI option](../#-reporter-name-r-name)
 * @see [Reporters](../#reporters)
 * @param {String|Function} reporter - Reporter name or constructor.
 * @param {Object} [reporterOptions] - Options used to configure the reporter.
 * @returns {Mocha} this
 * @chainable
 * @throws {Error} if requested reporter cannot be loaded
 * @example
 *
 * // Use XUnit reporter and direct its output to file
 * mocha.reporter('xunit', { output: '/path/to/testspec.xunit.xml' });
 */
Mocha.prototype.reporter = function(reporter, reporterOptions) {
  if (typeof reporter === 'function') {
    this._reporter = reporter;
  } else {
    reporter = reporter || 'spec';
    var _reporter;
    // Try to load a built-in reporter.
    if (builtinReporters[reporter]) {
      _reporter = builtinReporters[reporter];
    }
    // Try to load reporters from process.cwd() and node_modules
    if (!_reporter) {
      try {
        _reporter = require(reporter);
      } catch (err) {
        if (
          err.code !== 'MODULE_NOT_FOUND' ||
          err.message.indexOf('Cannot find module') !== -1
        ) {
          // Try to load reporters from a path (absolute or relative)
          try {
            _reporter = require(path.resolve(process.cwd(), reporter));
          } catch (_err) {
            _err.code !== 'MODULE_NOT_FOUND' ||
            _err.message.indexOf('Cannot find module') !== -1
              ? console.warn(sQuote(reporter) + ' reporter not found')
              : console.warn(
                  sQuote(reporter) +
                    ' reporter blew up with error:\n' +
                    err.stack
                );
          }
        } else {
          console.warn(
            sQuote(reporter) + ' reporter blew up with error:\n' + err.stack
          );
        }
      }
    }
    if (!_reporter) {
      throw createInvalidReporterError(
        'invalid reporter ' + sQuote(reporter),
        reporter
      );
    }
    this._reporter = _reporter;
  }
  this.options.reporterOption = reporterOptions;
  // alias option name is used in public reporters xunit/tap/progress
  this.options.reporterOptions = reporterOptions;
  return this;
};

/**
 * Sets test UI `name`, defaults to "bdd".
 *
 * @public
 * @see [CLI option](../#-ui-name-u-name)
 * @see [Interface DSLs](../#interfaces)
 * @param {string|Function} [ui=bdd] - Interface name or class.
 * @returns {Mocha} this
 * @chainable
 * @throws {Error} if requested interface cannot be loaded
 */
Mocha.prototype.ui = function(ui) {
  var bindInterface;
  if (typeof ui === 'function') {
    bindInterface = ui;
  } else {
    ui = ui || 'bdd';
    bindInterface = exports.interfaces[ui];
    if (!bindInterface) {
      try {
        bindInterface = require(ui);
      } catch (err) {
        throw createInvalidInterfaceError(
          'invalid interface ' + sQuote(ui),
          ui
        );
      }
    }
  }
  bindInterface(this.suite);

  this.suite.on(EVENT_FILE_PRE_REQUIRE, function(context) {
    exports.afterEach = context.afterEach || context.teardown;
    exports.after = context.after || context.suiteTeardown;
    exports.beforeEach = context.beforeEach || context.setup;
    exports.before = context.before || context.suiteSetup;
    exports.describe = context.describe || context.suite;
    exports.it = context.it || context.test;
    exports.xit = context.xit || (context.test && context.test.skip);
    exports.setup = context.setup || context.beforeEach;
    exports.suiteSetup = context.suiteSetup || context.before;
    exports.suiteTeardown = context.suiteTeardown || context.after;
    exports.suite = context.suite || context.describe;
    exports.teardown = context.teardown || context.afterEach;
    exports.test = context.test || context.it;
    exports.run = context.run;
  });

  return this;
};

/**
 * Loads `files` prior to execution. Does not support ES Modules.
 *
 * @description
 * The implementation relies on Node's `require` to execute
 * the test interface functions and will be subject to its cache.
 * Supports only CommonJS modules. To load ES modules, use Mocha#loadFilesAsync.
 *
 * @private
 * @see {@link Mocha#addFile}
 * @see {@link Mocha#run}
 * @see {@link Mocha#unloadFiles}
 * @see {@link Mocha#loadFilesAsync}
 * @param {Function} [fn] - Callback invoked upon completion.
 */
Mocha.prototype.loadFiles = function(fn) {
  var self = this;
  var suite = this.suite;
  this.files.forEach(function(file) {
    file = path.resolve(file);
    suite.emit(EVENT_FILE_PRE_REQUIRE, global, file, self);
    suite.emit(EVENT_FILE_REQUIRE, require(file), file, self);
    suite.emit(EVENT_FILE_POST_REQUIRE, global, file, self);
  });
  fn && fn();
};

/**
 * Loads `files` prior to execution. Supports Node ES Modules.
 *
 * @description
 * The implementation relies on Node's `require` and `import` to execute
 * the test interface functions and will be subject to its cache.
 * Supports both CJS and ESM modules.
 *
},{"../errors":6,"../suite":36}],10:[function(require,module,exports){
'use strict';
var Suite = require('../suite');
var Test = require('../test');

/**
 * Exports-style (as Node.js module) interface:
 *
 *     exports.Array = {
 *       '#indexOf()': {
 *         'should return -1 when the value is not present': function() {
 *
 *         },
 *
 *         'should return the correct index when the value is present': function() {
 *
 *         }
 *       }
 *     };
 *
 * @param {Suite} suite Root suite.
 */
module.exports = function(suite) {
    var suites = [suite];
  
    suite.on(Suite.constants.EVENT_FILE_REQUIRE, visit);
  
    function visit(obj, file) {
      var suite;
      for (var key in obj) {
        if (typeof obj[key] === 'function') {
          var fn = obj[key];
          switch (key) {
            case 'before':
              suites[0].beforeAll(fn);
              break;
            case 'after':
              suites[0].afterAll(fn);
              break;
            case 'beforeEach':
              suites[0].beforeEach(fn);
              break;
            case 'afterEach':
              suites[0].afterEach(fn);
              break;
            default:
              var test = new Test(key, fn);
              test.file = file;
              suites[0].addTest(test);
          }
        } else {
          suite = Suite.create(suites[0], key);
          suites.unshift(suite);
          visit(obj[key], file);
          suites.shift();
        }
      }
    }
  };
  
  module.exports.description = 'Node.js module ("exports") style';
  
  },{"../suite":36,"../test":37}],11:[function(require,module,exports){
  'use strict';
  
  exports.bdd = require('./bdd');
  exports.tdd = require('./tdd');
  exports.qunit = require('./qunit');
  exports.exports = require('./exports');
  
  },{"./bdd":8,"./exports":10,"./qunit":12,"./tdd":13}],12:[function(require,module,exports){
  'use strict';
  
  var Test = require('../test');
  var EVENT_FILE_PRE_REQUIRE = require('../suite').constants
    .EVENT_FILE_PRE_REQUIRE;
  
  /**
   * QUnit-style interface:
   *
   *     suite('Array');
   *
   *     test('#length', function() {
   *       var arr = [1,2,3];
   *       ok(arr.length == 3);
   *     });
   *
   *     test('#indexOf()', function() {
   *       var arr = [1,2,3];
   *       ok(arr.indexOf(1) == 0);
   *       ok(arr.indexOf(2) == 1);
   *       ok(arr.indexOf(3) == 2);
   *     });
   *
   *     suite('String');
   *
   *     test('#length', function() {
   *       ok('foo'.length == 3);
   *     });
   *
   * @param {Suite} suite Root suite.
   */
  module.exports = function qUnitInterface(suite) {
    var suites = [suite];
  
    suite.on(EVENT_FILE_PRE_REQUIRE, function(context, file, mocha) {
      var common = require('./common')(suites, context, mocha);
  
      context.before = common.before;
      context.after = common.after;
      context.beforeEach = common.beforeEach;
      context.afterEach = common.afterEach;
      context.run = mocha.options.delay && common.runWithSuite(suite);
      /**
       * Describe a "suite" with the given `title`.
       */
  
      context.suite = function(title) {
        if (suites.length > 1) {
          suites.shift();
        }
        return common.suite.create({
          title: title,
          file: file,
          fn: false
        });
      };
  
      /**
       * Exclusive Suite.
       */
  
      context.suite.only = function(title) {
        if (suites.length > 1) {
          suites.shift();
        }
        return common.suite.only({
          title: title,
          file: file,
          fn: false
        });
      };
  
      /**
       * Describe a specification or test-case
       * with the given `title` and callback `fn`
       * acting as a thunk.
       */
  
      context.test = function(title, fn) {
        var test = new Test(title, fn);
        test.file = file;
        suites[0].addTest(test);
        return test;
      };
  
      /**
       * Exclusive test-case.
       */
  
      context.test.only = function(title, fn) {
        return common.test.only(mocha, context.test(title, fn));
      };
  
      context.test.skip = common.test.skip;
      context.test.retries = common.test.retries;
    });
  };
  
  module.exports.description = 'QUnit style';
  
  },{"../suite":36,"../test":37,"./common":9}],13:[function(require,module,exports){
  'use strict';
  
  var Test = require('../test');
  var EVENT_FILE_PRE_REQUIRE = require('../suite').constants
    .EVENT_FILE_PRE_REQUIRE;
  
  /**
   * TDD-style interface:
   *
   *      suite('Array', function() {
   *        suite('#indexOf()', function() {
   *          suiteSetup(function() {
   *
   *          });
   *
   *          test('should return -1 when not present', function() {
   *
   *          });
   *
   *          test('should return the index when present', function() {
   *
   *          });
   *
   *          suiteTeardown(function() {
   *
   *          });
   *        });
   *      });
   *
   * @param {Suite} suite Root suite.
   */
  module.exports = function(suite) {
    var suites = [suite];
  
    suite.on(EVENT_FILE_PRE_REQUIRE, function(context, file, mocha) {
      var common = require('./common')(suites, context, mocha);
  
      context.setup = common.beforeEach;
      context.teardown = common.afterEach;
      context.suiteSetup = common.before;
      context.suiteTeardown = common.after;
      context.run = mocha.options.delay && common.runWithSuite(suite);
  
      /**
       * Describe a "suite" with the given `title` and callback `fn` containing
       * nested suites and/or tests.
       */
      context.suite = function(title, fn) {
        return common.suite.create({
          title: title,
          file: file,
          fn: fn
        });
      };
  
      /**
       * Pending suite.
       */
      context.suite.skip = function(title, fn) {
        return common.suite.skip({
          title: title,
          file: file,
          fn: fn
        });
      };
  
      /**
       * Exclusive test-case.
       */
      context.suite.only = function(title, fn) {
        return common.suite.only({
          title: title,
          file: file,
          fn: fn
        });
      };
  
      /**
       * Describe a specification or test-case with the given `title` and
       * callback `fn` acting as a thunk.
       */
      context.test = function(title, fn) {
        var suite = suites[0];
        if (suite.isPending()) {
          fn = null;
        }
        var test = new Test(title, fn);
        test.file = file;
        suite.addTest(test);
        return test;
      };
  
      /**
       * Exclusive test-case.
       */
  
      context.test.only = function(title, fn) {
        return common.test.only(mocha, context.test(title, fn));
      };
  
      context.test.skip = common.test.skip;
      context.test.retries = common.test.retries;
    });
  };
  
  module.exports.description =
    'traditional "suite"/"test" instead of BDD\'s "describe"/"it"';
  
  },{"../suite":36,"../test":37,"./common":9}],14:[function(require,module,exports){
  (function (process,global){
  'use strict';
  
  /*!
   * mocha
   * Copyright(c) 2011 TJ Holowaychuk <tj@vision-media.ca>
   * MIT Licensed
   */
  
  var escapeRe = require('escape-string-regexp');
  var path = require('path');
  var builtinReporters = require('./reporters');
  var growl = require('./growl');
  var utils = require('./utils');
  var mocharc = require('./mocharc.json');
  var errors = require('./errors');
  var Suite = require('./suite');
  var esmUtils = utils.supportsEsModules() ? require('./esm-utils') : undefined;
  var createStatsCollector = require('./stats-collector');
  var createInvalidReporterError = errors.createInvalidReporterError;
  var createInvalidInterfaceError = errors.createInvalidInterfaceError;
  var EVENT_FILE_PRE_REQUIRE = Suite.constants.EVENT_FILE_PRE_REQUIRE;
  var EVENT_FILE_POST_REQUIRE = Suite.constants.EVENT_FILE_POST_REQUIRE;
  var EVENT_FILE_REQUIRE = Suite.constants.EVENT_FILE_REQUIRE;
  var sQuote = utils.sQuote;
  
  exports = module.exports = Mocha;
  
  /**
   * To require local UIs and reporters when running in node.
   */
  
  if (!process.browser) {
    var cwd = process.cwd();
    module.paths.push(cwd, path.join(cwd, 'node_modules'));
  }
  
  /**
   * Expose internals.
   */
  
  /**
   * @public
   * @class utils
   * @memberof Mocha
   */
  exports.utils = utils;
  exports.interfaces = require('./interfaces');
  /**
   * @public
   * @memberof Mocha
   */
  exports.reporters = builtinReporters;
  exports.Runnable = require('./runnable');
  exports.Context = require('./context');
  /**
   *
   * @memberof Mocha
   */
  exports.Runner = require('./runner');
  exports.Suite = Suite;
  exports.Hook = require('./hook');
  exports.Test = require('./test');
  
  /**
   * Constructs a new Mocha instance with `options`.
   *
   * @public
   * @class Mocha
   * @param {Object} [options] - Settings object.
   * @param {boolean} [options.allowUncaught] - Propagate uncaught errors?
   * @param {boolean} [options.asyncOnly] - Force `done` callback or promise?
   * @param {boolean} [options.bail] - Bail after first test failure?
   * @param {boolean} [options.checkLeaks] - Check for global variable leaks?
   * @param {boolean} [options.color] - Color TTY output from reporter?
   * @param {boolean} [options.delay] - Delay root suite execution?
   * @param {boolean} [options.diff] - Show diff on failure?
   * @param {string} [options.fgrep] - Test filter given string.
   * @param {boolean} [options.forbidOnly] - Tests marked `only` fail the suite?
   * @param {boolean} [options.forbidPending] - Pending tests fail the suite?
   * @param {boolean} [options.fullTrace] - Full stacktrace upon failure?
   * @param {string[]} [options.global] - Variables expected in global scope.
   * @param {RegExp|string} [options.grep] - Test filter given regular expression.
   * @param {boolean} [options.growl] - Enable desktop notifications?
   * @param {boolean} [options.inlineDiffs] - Display inline diffs?
   * @param {boolean} [options.invert] - Invert test filter matches?
   * @param {boolean} [options.noHighlighting] - Disable syntax highlighting?
   * @param {string|constructor} [options.reporter] - Reporter name or constructor.
   * @param {Object} [options.reporterOption] - Reporter settings object.
   * @param {number} [options.retries] - Number of times to retry failed tests.
   * @param {number} [options.slow] - Slow threshold value.
   * @param {number|string} [options.timeout] - Timeout threshold value.
   * @param {string} [options.ui] - Interface name.
   */
  function Mocha(options) {
    options = utils.assign({}, mocharc, options || {});
    this.files = [];
    this.options = options;
    // root suite
    this.suite = new exports.Suite('', new exports.Context(), true);
  
    this.grep(options.grep)
      .fgrep(options.fgrep)
      .ui(options.ui)
      .reporter(
        options.reporter,
        options.reporterOption || options.reporterOptions // reporterOptions was previously the only way to specify options to reporter
      )
      .slow(options.slow)
      .global(options.global);
  
    // this guard exists because Suite#timeout does not consider `undefined` to be valid input
    if (typeof options.timeout !== 'undefined') {
      this.timeout(options.timeout === false ? 0 : options.timeout);
    }
  
    if ('retries' in options) {
      this.retries(options.retries);
    }
  
    [
      'allowUncaught',
      'asyncOnly',
      'bail',
      'checkLeaks',
      'color',
      'delay',
      'diff',
      'forbidOnly',
      'forbidPending',
      'fullTrace',
      'growl',
      'inlineDiffs',
      'invert'
    ].forEach(function(opt) {
      if (options[opt]) {
        this[opt]();
      }
    }, this);
  }
  
  /**
   * Enables or disables bailing on the first failure.
   *
   * @public
   * @see [CLI option](../#-bail-b)
   * @param {boolean} [bail=true] - Whether to bail on first error.
   * @returns {Mocha} this
   * @chainable
   */
  Mocha.prototype.bail = function(bail) {
    this.suite.bail(bail !== false);
    return this;
  };
  
  /**
   * @summary
   * Adds `file` to be loaded for execution.
   *
   * @description
   * Useful for generic setup code that must be included within test suite.
   *
   * @public
   * @see [CLI option](../#-file-filedirectoryglob)
   * @param {string} file - Pathname of file to be loaded.
   * @returns {Mocha} this
   * @chainable
   */
  Mocha.prototype.addFile = function(file) {
    this.files.push(file);
    return this;
  };
  
  /**
   * Sets reporter to `reporter`, defaults to "spec".
   *
   * @public
   * @see [CLI option](../#-reporter-name-r-name)
   * @see [Reporters](../#reporters)
   * @param {String|Function} reporter - Reporter name or constructor.
   * @param {Object} [reporterOptions] - Options used to configure the reporter.
   * @returns {Mocha} this
   * @chainable
   * @throws {Error} if requested reporter cannot be loaded
   * @example
   *
   * // Use XUnit reporter and direct its output to file
   * mocha.reporter('xunit', { output: '/path/to/testspec.xunit.xml' });
   */
  Mocha.prototype.reporter = function(reporter, reporterOptions) {
    if (typeof reporter === 'function') {
      this._reporter = reporter;
    } else {
      reporter = reporter || 'spec';
      var _reporter;
      // Try to load a built-in reporter.
      if (builtinReporters[reporter]) {
        _reporter = builtinReporters[reporter];
      }
      // Try to load reporters from process.cwd() and node_modules
      if (!_reporter) {
        try {
          _reporter = require(reporter);
        } catch (err) {
          if (
            err.code !== 'MODULE_NOT_FOUND' ||
            err.message.indexOf('Cannot find module') !== -1
          ) {
            // Try to load reporters from a path (absolute or relative)
            try {
              _reporter = require(path.resolve(process.cwd(), reporter));
            } catch (_err) {
              _err.code !== 'MODULE_NOT_FOUND' ||
              _err.message.indexOf('Cannot find module') !== -1
                ? console.warn(sQuote(reporter) + ' reporter not found')
                : console.warn(
                    sQuote(reporter) +
                      ' reporter blew up with error:\n' +
                      err.stack
                  );
            }
          } else {
            console.warn(
              sQuote(reporter) + ' reporter blew up with error:\n' + err.stack
            );
          }
        }
      }
      if (!_reporter) {
        throw createInvalidReporterError(
          'invalid reporter ' + sQuote(reporter),
          reporter
        );
      }
      this._reporter = _reporter;
    }
    this.options.reporterOption = reporterOptions;
    // alias option name is used in public reporters xunit/tap/progress
    this.options.reporterOptions = reporterOptions;
    return this;
  };
  
  /**
   * Sets test UI `name`, defaults to "bdd".
   *
   * @public
   * @see [CLI option](../#-ui-name-u-name)
   * @see [Interface DSLs](../#interfaces)
   * @param {string|Function} [ui=bdd] - Interface name or class.
   * @returns {Mocha} this
   * @chainable
   * @throws {Error} if requested interface cannot be loaded
   */
  Mocha.prototype.ui = function(ui) {
    var bindInterface;
    if (typeof ui === 'function') {
      bindInterface = ui;
    } else {
      ui = ui || 'bdd';
      bindInterface = exports.interfaces[ui];
      if (!bindInterface) {
        try {
          bindInterface = require(ui);
        } catch (err) {
          throw createInvalidInterfaceError(
            'invalid interface ' + sQuote(ui),
            ui
          );
        }
      }
    }
    bindInterface(this.suite);
  
    this.suite.on(EVENT_FILE_PRE_REQUIRE, function(context) {
      exports.afterEach = context.afterEach || context.teardown;
      exports.after = context.after || context.suiteTeardown;
      exports.beforeEach = context.beforeEach || context.setup;
      exports.before = context.before || context.suiteSetup;
      exports.describe = context.describe || context.suite;
      exports.it = context.it || context.test;
      exports.xit = context.xit || (context.test && context.test.skip);
      exports.setup = context.setup || context.beforeEach;
      exports.suiteSetup = context.suiteSetup || context.before;
      exports.suiteTeardown = context.suiteTeardown || context.after;
      exports.suite = context.suite || context.describe;
      exports.teardown = context.teardown || context.afterEach;
      exports.test = context.test || context.it;
      exports.run = context.run;
    });
  
    return this;
  };
  
  /**
   * Loads `files` prior to execution. Does not support ES Modules.
   *
   * @description
   * The implementation relies on Node's `require` to execute
   * the test interface functions and will be subject to its cache.
   * Supports only CommonJS modules. To load ES modules, use Mocha#loadFilesAsync.
   *
   * @private
   * @see {@link Mocha#addFile}
   * @see {@link Mocha#run}
   * @see {@link Mocha#unloadFiles}
   * @see {@link Mocha#loadFilesAsync}
   * @param {Function} [fn] - Callback invoked upon completion.
   */
  Mocha.prototype.loadFiles = function(fn) {
    var self = this;
    var suite = this.suite;
    this.files.forEach(function(file) {
      file = path.resolve(file);
      suite.emit(EVENT_FILE_PRE_REQUIRE, global, file, self);
      suite.emit(EVENT_FILE_REQUIRE, require(file), file, self);
      suite.emit(EVENT_FILE_POST_REQUIRE, global, file, self);
    });
    fn && fn();
  };
  
  /**
   * Loads `files` prior to execution. Supports Node ES Modules.
   *
   * @description
   * The implementation relies on Node's `require` and `import` to execute
   * the test interface functions and will be subject to its cache.
   * Supports both CJS and ESM modules.
   *
/**
 * Colors lines for `str`, using the color `name`.
 *
 * @private
 * @param {string} name
 * @param {string} str
 * @return {string}
 */
function colorLines(name, str) {
    return str
      .split('\n')
      .map(function(str) {
        return color(name, str);
      })
      .join('\n');
  }
  
  /**
   * Object#toString reference.
   */
  var objToString = Object.prototype.toString;
  
  /**
   * Checks that a / b have the same type.
   *
   * @private
   * @param {Object} a
   * @param {Object} b
   * @return {boolean}
   */
  function sameType(a, b) {
    return objToString.call(a) === objToString.call(b);
  }
  
  Base.consoleLog = consoleLog;
  
  Base.abstract = true;
  
  }).call(this,require('_process'))
  },{"../runner":34,"../utils":38,"_process":69,"diff":48,"ms":60,"supports-color":42,"tty":4}],18:[function(require,module,exports){
  'use strict';
  /**
   * @module Doc
   */
  /**
   * Module dependencies.
   */
  
  var Base = require('./base');
  var utils = require('../utils');
  var constants = require('../runner').constants;
  var EVENT_TEST_PASS = constants.EVENT_TEST_PASS;
  var EVENT_TEST_FAIL = constants.EVENT_TEST_FAIL;
  var EVENT_SUITE_BEGIN = constants.EVENT_SUITE_BEGIN;
  var EVENT_SUITE_END = constants.EVENT_SUITE_END;
  
  /**
   * Expose `Doc`.
   */
  
  exports = module.exports = Doc;
  
  /**
   * Constructs a new `Doc` reporter instance.
   *
   * @public
   * @class
   * @memberof Mocha.reporters
   * @extends Mocha.reporters.Base
   * @param {Runner} runner - Instance triggers reporter actions.
   * @param {Object} [options] - runner options
   */
  function Doc(runner, options) {
    Base.call(this, runner, options);
  
    var indents = 2;
  
    function indent() {
      return Array(indents).join('  ');
    }
  
    runner.on(EVENT_SUITE_BEGIN, function(suite) {
      if (suite.root) {
        return;
      }
      ++indents;
      Base.consoleLog('%s<section class="suite">', indent());
      ++indents;
      Base.consoleLog('%s<h1>%s</h1>', indent(), utils.escape(suite.title));
      Base.consoleLog('%s<dl>', indent());
    });
  
    runner.on(EVENT_SUITE_END, function(suite) {
      if (suite.root) {
        return;
      }
      Base.consoleLog('%s</dl>', indent());
      --indents;
      Base.consoleLog('%s</section>', indent());
      --indents;
    });
  
    runner.on(EVENT_TEST_PASS, function(test) {
      Base.consoleLog('%s  <dt>%s</dt>', indent(), utils.escape(test.title));
      var code = utils.escape(utils.clean(test.body));
      Base.consoleLog('%s  <dd><pre><code>%s</code></pre></dd>', indent(), code);
    });
  
    runner.on(EVENT_TEST_FAIL, function(test, err) {
      Base.consoleLog(
        '%s  <dt class="error">%s</dt>',
        indent(),
        utils.escape(test.title)
      );
      var code = utils.escape(utils.clean(test.body));
      Base.consoleLog(
        '%s  <dd class="error"><pre><code>%s</code></pre></dd>',
        indent(),
        code
      );
      Base.consoleLog(
        '%s  <dd class="error">%s</dd>',
        indent(),
        utils.escape(err)
      );
    });
  }
  Doc.description = 'HTML documentation';
  
  },{"../runner":34,"../utils":38,"./base":17}],19:[function(require,module,exports){
  (function (process){
  'use strict';
  /**
   * @module Dot
   */
  /**
   * Module dependencies.
   */
  
  var Base = require('./base');
  var inherits = require('../utils').inherits;
  var constants = require('../runner').constants;
  var EVENT_TEST_PASS = constants.EVENT_TEST_PASS;
  var EVENT_TEST_FAIL = constants.EVENT_TEST_FAIL;
  var EVENT_RUN_BEGIN = constants.EVENT_RUN_BEGIN;
  var EVENT_TEST_PENDING = constants.EVENT_TEST_PENDING;
  var EVENT_RUN_END = constants.EVENT_RUN_END;
  
  /**
   * Expose `Dot`.
   */
  
  exports = module.exports = Dot;
  
  /**
   * Constructs a new `Dot` reporter instance.
   *
   * @public
   * @class
   * @memberof Mocha.reporters
   * @extends Mocha.reporters.Base
   * @param {Runner} runner - Instance triggers reporter actions.
   * @param {Object} [options] - runner options
   */
  function Dot(runner, options) {
    Base.call(this, runner, options);
  
    var self = this;
    var width = (Base.window.width * 0.75) | 0;
    var n = -1;
  
    runner.on(EVENT_RUN_BEGIN, function() {
      process.stdout.write('\n');
    });
  
    runner.on(EVENT_TEST_PENDING, function() {
      if (++n % width === 0) {
        process.stdout.write('\n  ');
      }
      process.stdout.write(Base.color('pending', Base.symbols.comma));
    });
  
    runner.on(EVENT_TEST_PASS, function(test) {
      if (++n % width === 0) {
        process.stdout.write('\n  ');
      }
      if (test.speed === 'slow') {
        process.stdout.write(Base.color('bright yellow', Base.symbols.dot));
      } else {
        process.stdout.write(Base.color(test.speed, Base.symbols.dot));
      }
    });
  
    runner.on(EVENT_TEST_FAIL, function() {
      if (++n % width === 0) {
        process.stdout.write('\n  ');
      }
      process.stdout.write(Base.color('fail', Base.symbols.bang));
    });
  
    runner.once(EVENT_RUN_END, function() {
      process.stdout.write('\n');
      self.epilogue();
    });
  }
  
  /**
   * Inherit from `Base.prototype`.
   */
  inherits(Dot, Base);
  
  Dot.description = 'dot matrix representation';
  
  }).call(this,require('_process'))
  },{"../runner":34,"../utils":38,"./base":17,"_process":69}],20:[function(require,module,exports){
  (function (global){
  'use strict';
  
  /* eslint-env browser */
  /**
   * @module HTML
   */
  /**
   * Module dependencies.
   */
  
  var Base = require('./base');
  var utils = require('../utils');
  var Progress = require('../browser/progress');
  var escapeRe = require('escape-string-regexp');
  var constants = require('../runner').constants;
  var EVENT_TEST_PASS = constants.EVENT_TEST_PASS;
  var EVENT_TEST_FAIL = constants.EVENT_TEST_FAIL;
  var EVENT_SUITE_BEGIN = constants.EVENT_SUITE_BEGIN;
  var EVENT_SUITE_END = constants.EVENT_SUITE_END;
  var EVENT_TEST_PENDING = constants.EVENT_TEST_PENDING;
  var escape = utils.escape;
  
  /**
   * Save timer references to avoid Sinon interfering (see GH-237).
   */
  
  var Date = global.Date;
  
  /**
   * Expose `HTML`.
   */
  
  exports = module.exports = HTML;
  
  /**
   * Stats template.
   */
var statsTemplate =
'<ul id="mocha-stats">' +
'<li class="progress"><canvas width="40" height="40"></canvas></li>' +
'<li class="passes"><a href="javascript:void(0);">passes:</a> <em>0</em></li>' +
'<li class="failures"><a href="javascript:void(0);">failures:</a> <em>0</em></li>' +
'<li class="duration">duration: <em>0</em>s</li>' +
'</ul>';

var playIcon = '&#x2023;';

/**
* Constructs a new `HTML` reporter instance.
*
* @public
* @class
* @memberof Mocha.reporters
* @extends Mocha.reporters.Base
* @param {Runner} runner - Instance triggers reporter actions.
* @param {Object} [options] - runner options
*/
function HTML(runner, options) {
Base.call(this, runner, options);

var self = this;
var stats = this.stats;
var stat = fragment(statsTemplate);
var items = stat.getElementsByTagName('li');
var passes = items[1].getElementsByTagName('em')[0];
var passesLink = items[1].getElementsByTagName('a')[0];
var failures = items[2].getElementsByTagName('em')[0];
var failuresLink = items[2].getElementsByTagName('a')[0];
var duration = items[3].getElementsByTagName('em')[0];
var canvas = stat.getElementsByTagName('canvas')[0];
var report = fragment('<ul id="mocha-report"></ul>');
var stack = [report];
var progress;
var ctx;
var root = document.getElementById('mocha');

if (canvas.getContext) {
  var ratio = window.devicePixelRatio || 1;
  canvas.style.width = canvas.width;
  canvas.style.height = canvas.height;
  canvas.width *= ratio;
  canvas.height *= ratio;
  ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  progress = new Progress();
}

if (!root) {
  return error('#mocha div missing, add it to your document');
}

// pass toggle
on(passesLink, 'click', function(evt) {
  evt.preventDefault();
  unhide();
  var name = /pass/.test(report.className) ? '' : ' pass';
  report.className = report.className.replace(/fail|pass/g, '') + name;
  if (report.className.trim()) {
    hideSuitesWithout('test pass');
  }
});

// failure toggle
on(failuresLink, 'click', function(evt) {
  evt.preventDefault();
  unhide();
  var name = /fail/.test(report.className) ? '' : ' fail';
  report.className = report.className.replace(/fail|pass/g, '') + name;
  if (report.className.trim()) {
    hideSuitesWithout('test fail');
  }
});

root.appendChild(stat);
root.appendChild(report);

if (progress) {
  progress.size(40);
}

runner.on(EVENT_SUITE_BEGIN, function(suite) {
  if (suite.root) {
    return;
  }

  // suite
  var url = self.suiteURL(suite);
  var el = fragment(
    '<li class="suite"><h1><a href="%s">%s</a></h1></li>',
    url,
    escape(suite.title)
  );

  // container
  stack[0].appendChild(el);
  stack.unshift(document.createElement('ul'));
  el.appendChild(stack[0]);
});

runner.on(EVENT_SUITE_END, function(suite) {
  if (suite.root) {
    updateStats();
    return;
  }
  stack.shift();
});

runner.on(EVENT_TEST_PASS, function(test) {
  var url = self.testURL(test);
  var markup =
    '<li class="test pass %e"><h2>%e<span class="duration">%ems</span> ' +
    '<a href="%s" class="replay">' +
    playIcon +
    '</a></h2></li>';
  var el = fragment(markup, test.speed, test.title, test.duration, url);
  self.addCodeToggle(el, test.body);
  appendToStack(el);
  updateStats();
});

runner.on(EVENT_TEST_FAIL, function(test) {
  var el = fragment(
    '<li class="test fail"><h2>%e <a href="%e" class="replay">' +
      playIcon +
      '</a></h2></li>',
    test.title,
    self.testURL(test)
  );
  var stackString; // Note: Includes leading newline
  var message = test.err.toString();

  // <=IE7 stringifies to [Object Error]. Since it can be overloaded, we
  // check for the result of the stringifying.
  if (message === '[object Error]') {
    message = test.err.message;
  }

  if (test.err.stack) {
    var indexOfMessage = test.err.stack.indexOf(test.err.message);
    if (indexOfMessage === -1) {
      stackString = test.err.stack;
    } else {
      stackString = test.err.stack.substr(
        test.err.message.length + indexOfMessage
      );
    }
  } else if (test.err.sourceURL && test.err.line !== undefined) {
    // Safari doesn't give you a stack. Let's at least provide a source line.
    stackString = '\n(' + test.err.sourceURL + ':' + test.err.line + ')';
  }

  stackString = stackString || '';

  if (test.err.htmlMessage && stackString) {
    el.appendChild(
      fragment(
        '<div class="html-error">%s\n<pre class="error">%e</pre></div>',
        test.err.htmlMessage,
        stackString
      )
    );
  } else if (test.err.htmlMessage) {
    el.appendChild(
      fragment('<div class="html-error">%s</div>', test.err.htmlMessage)
    );
  } else {
    el.appendChild(
      fragment('<pre class="error">%e%e</pre>', message, stackString)
    );
  }

  self.addCodeToggle(el, test.body);
  appendToStack(el);
  updateStats();
});

runner.on(EVENT_TEST_PENDING, function(test) {
  var el = fragment(
    '<li class="test pass pending"><h2>%e</h2></li>',
    test.title
  );
  appendToStack(el);
  updateStats();
});

function appendToStack(el) {
  // Don't call .appendChild if #mocha-report was already .shift()'ed off the stack.
  if (stack[0]) {
    stack[0].appendChild(el);
  }
}

function updateStats() {
  // TODO: add to stats
  var percent = ((stats.tests / runner.total) * 100) | 0;
  if (progress) {
    progress.update(percent).draw(ctx);
  }

  // update stats
  var ms = new Date() - stats.start;
  text(passes, stats.passes);
  text(failures, stats.failures);
  text(duration, (ms / 1000).toFixed(2));
}
}

/**
* Makes a URL, preserving querystring ("search") parameters.
*
* @param {string} s
* @return {string} A new URL.
*/
function makeUrl(s) {
var search = window.location.search;

// Remove previous grep query parameter if present
if (search) {
  search = search.replace(/[?&]grep=[^&\s]*/g, '').replace(/^&/, '?');
}

return (
  window.location.pathname +
  (search ? search + '&' : '?') +
  'grep=' +
  encodeURIComponent(escapeRe(s))
);
}

/**
* Provide suite URL.
*
* @param {Object} [suite]
*/
HTML.prototype.suiteURL = function(suite) {
return makeUrl(suite.fullTitle());
};

/**
* Provide test URL.
*
* @param {Object} [test]
*/
HTML.prototype.testURL = function(test) {
return makeUrl(test.fullTitle());
};

/**
* Adds code toggle functionality for the provided test's list element.
*
* @param {HTMLLIElement} el
* @param {string} contents
*/
HTML.prototype.addCodeToggle = function(el, contents) {
var h2 = el.getElementsByTagName('h2')[0];

on(h2, 'click', function() {
  pre.style.display = pre.style.display === 'none' ? 'block' : 'none';
});

var pre = fragment('<pre><code>%e</code></pre>', utils.clean(contents));
el.appendChild(pre);
pre.style.display = 'none';
};

/**
* Display error `msg`.
*
* @param {string} msg
*/
function error(msg) {
document.body.appendChild(fragment('<div id="mocha-error">%s</div>', msg));
}

/**
* Return a DOM fragment from `html`.
*
* @param {string} html
*/
function fragment(html) {
var args = arguments;
var div = document.createElement('div');
var i = 1;

div.innerHTML = html.replace(/%([se])/g, function(_, type) {
  switch (type) {
    case 's':
      return String(args[i++]);
    case 'e':
      return escape(args[i++]);
    // no default
  }
});

return div.firstChild;
}

/**
* Check for suites that do not have elements
* with `classname`, and hide them.
*
* @param {text} classname
*/
function hideSuitesWithout(classname) {
var suites = document.getElementsByClassName('suite');
for (var i = 0; i < suites.length; i++) {
  var els = suites[i].getElementsByClassName(classname);
  if (!els.length) {
    suites[i].className += ' hidden';
  }
}
}
/**
 * Unhide .hidden suites.
 */
function unhide() {
  var els = document.getElementsByClassName('suite hidden');
  while (els.length > 0) {
    els[0].className = els[0].className.replace('suite hidden', 'suite');
  }
}

/**
 * Set an element's text contents.
 *
 * @param {HTMLElement} el
 * @param {string} contents
 */
function text(el, contents) {
  if (el.textContent) {
    el.textContent = contents;
  } else {
    el.innerText = contents;
  }
}

/**
 * Listen on `event` with callback `fn`.
 */
function on(el, event, fn) {
  if (el.addEventListener) {
    el.addEventListener(event, fn, false);
  } else {
    el.attachEvent('on' + event, fn);
  }
}

HTML.browserOnly = true;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../browser/progress":3,"../runner":34,"../utils":38,"./base":17,"escape-string-regexp":49}],21:[function(require,module,exports){
'use strict';

// Alias exports to a their normalized format Mocha#reporter to prevent a need
// for dynamic (try/catch) requires, which Browserify doesn't handle.
exports.Base = exports.base = require('./base');
exports.Dot = exports.dot = require('./dot');
exports.Doc = exports.doc = require('./doc');
exports.TAP = exports.tap = require('./tap');
exports.JSON = exports.json = require('./json');
exports.HTML = exports.html = require('./html');
exports.List = exports.list = require('./list');
exports.Min = exports.min = require('./min');
exports.Spec = exports.spec = require('./spec');
exports.Nyan = exports.nyan = require('./nyan');
exports.XUnit = exports.xunit = require('./xunit');
exports.Markdown = exports.markdown = require('./markdown');
exports.Progress = exports.progress = require('./progress');
exports.Landing = exports.landing = require('./landing');
exports.JSONStream = exports['json-stream'] = require('./json-stream');

},{"./base":17,"./doc":18,"./dot":19,"./html":20,"./json":23,"./json-stream":22,"./landing":24,"./list":25,"./markdown":26,"./min":27,"./nyan":28,"./progress":29,"./spec":30,"./tap":31,"./xunit":32}],22:[function(require,module,exports){
(function (process){
'use strict';
/**
 * @module JSONStream
 */
/**
 * Module dependencies.
 */

var Base = require('./base');
var constants = require('../runner').constants;
var EVENT_TEST_PASS = constants.EVENT_TEST_PASS;
var EVENT_TEST_FAIL = constants.EVENT_TEST_FAIL;
var EVENT_RUN_BEGIN = constants.EVENT_RUN_BEGIN;
var EVENT_RUN_END = constants.EVENT_RUN_END;

/**
 * Expose `JSONStream`.
 */

exports = module.exports = JSONStream;

/**
 * Constructs a new `JSONStream` reporter instance.
 *
 * @public
 * @class
 * @memberof Mocha.reporters
 * @extends Mocha.reporters.Base
 * @param {Runner} runner - Instance triggers reporter actions.
 * @param {Object} [options] - runner options
 */
function JSONStream(runner, options) {
  Base.call(this, runner, options);

  var self = this;
  var total = runner.total;

  runner.once(EVENT_RUN_BEGIN, function() {
    writeEvent(['start', {total: total}]);
  });

  runner.on(EVENT_TEST_PASS, function(test) {
    writeEvent(['pass', clean(test)]);
  });

  runner.on(EVENT_TEST_FAIL, function(test, err) {
    test = clean(test);
    test.err = err.message;
    test.stack = err.stack || null;
    writeEvent(['fail', test]);
  });

  runner.once(EVENT_RUN_END, function() {
    writeEvent(['end', self.stats]);
  });
}

/**
 * Mocha event to be written to the output stream.
 * @typedef {Array} JSONStream~MochaEvent
 */

/**
 * Writes Mocha event to reporter output stream.
 *
 * @private
 * @param {JSONStream~MochaEvent} event - Mocha event to be output.
 */
function writeEvent(event) {
  process.stdout.write(JSON.stringify(event) + '\n');
}

/**
 * Returns an object literal representation of `test`
 * free of cyclic properties, etc.
 *
 * @private
 * @param {Test} test - Instance used as data source.
 * @return {Object} object containing pared-down test instance data
 */
function clean(test) {
  return {
    title: test.title,
    fullTitle: test.fullTitle(),
    duration: test.duration,
    currentRetry: test.currentRetry()
  };
}

JSONStream.description = 'newline delimited JSON events';

}).call(this,require('_process'))
},{"../runner":34,"./base":17,"_process":69}],23:[function(require,module,exports){
(function (process){
'use strict';
/**
 * @module JSON
 */
/**
 * Module dependencies.
 */

var Base = require('./base');
var constants = require('../runner').constants;
var EVENT_TEST_PASS = constants.EVENT_TEST_PASS;
var EVENT_TEST_FAIL = constants.EVENT_TEST_FAIL;
var EVENT_TEST_END = constants.EVENT_TEST_END;
var EVENT_RUN_END = constants.EVENT_RUN_END;
var EVENT_TEST_PENDING = constants.EVENT_TEST_PENDING;

/**
 * Expose `JSON`.
 */

exports = module.exports = JSONReporter;

/**
 * Constructs a new `JSON` reporter instance.
 *
 * @public
 * @class JSON
 * @memberof Mocha.reporters
 * @extends Mocha.reporters.Base
 * @param {Runner} runner - Instance triggers reporter actions.
 * @param {Object} [options] - runner options
 */
function JSONReporter(runner, options) {
  Base.call(this, runner, options);

  var self = this;
  var tests = [];
  var pending = [];
  var failures = [];
  var passes = [];

  runner.on(EVENT_TEST_END, function(test) {
    tests.push(test);
  });

  runner.on(EVENT_TEST_PASS, function(test) {
    passes.push(test);
  });

  runner.on(EVENT_TEST_FAIL, function(test) {
    failures.push(test);
  });

  runner.on(EVENT_TEST_PENDING, function(test) {
    pending.push(test);
  });

  runner.once(EVENT_RUN_END, function() {
    var obj = {
      stats: self.stats,
      tests: tests.map(clean),
      pending: pending.map(clean),
      failures: failures.map(clean),
      passes: passes.map(clean)
    };

    runner.testResults = obj;

    process.stdout.write(JSON.stringify(obj, null, 2));
  });
}

/**
 * Return a plain-object representation of `test`
 * free of cyclic properties etc.
 *
 * @private
 * @param {Object} test
 * @return {Object}
 */
function clean(test) {
  var err = test.err || {};
  if (err instanceof Error) {
    err = errorJSON(err);
  }

  return {
    title: test.title,
    fullTitle: test.fullTitle(),
    duration: test.duration,
    currentRetry: test.currentRetry(),
    err: cleanCycles(err)
  };
}

/**
 * Replaces any circular references inside `obj` with '[object Object]'
 *
 * @private
 * @param {Object} obj
 * @return {Object}
 */
function cleanCycles(obj) {
  var cache = [];
  return JSON.parse(
    JSON.stringify(obj, function(key, value) {
      if (typeof value === 'object' && value !== null) {
        if (cache.indexOf(value) !== -1) {
          // Instead of going in a circle, we'll print [object Object]
          return '' + value;
        }
        cache.push(value);
      }

      return value;
    })
  );
}

/**
 * Transform an Error object into a JSON object.
 *
 * @private
 * @param {Error} err
 * @return {Object}
 */
function errorJSON(err) {
  var res = {};
  Object.getOwnPropertyNames(err).forEach(function(key) {
    res[key] = err[key];
  }, err);
  return res;
}

JSONReporter.description = 'single JSON object';

}).call(this,require('_process'))
},{"../runner":34,"./base":17,"_process":69}],24:[function(require,module,exports){
(function (process){
'use strict';
/**
 * @module Landing
 */
/**
 * Module dependencies.
 */
var Base = require('./base');
var inherits = require('../utils').inherits;
var constants = require('../runner').constants;
var EVENT_RUN_BEGIN = constants.EVENT_RUN_BEGIN;
var EVENT_RUN_END = constants.EVENT_RUN_END;
var EVENT_TEST_END = constants.EVENT_TEST_END;
var STATE_FAILED = require('../runnable').constants.STATE_FAILED;

var cursor = Base.cursor;
var color = Base.color;

/**
 * Expose `Landing`.
 */

exports = module.exports = Landing;

/**
 * Airplane color.
 */

Base.colors.plane = 0;

/**
 * Airplane crash color.
 */

Base.colors['plane crash'] = 31;

/**
 * Runway color.
 */

Base.colors.runway = 90;

/**
 * Constructs a new `Landing` reporter instance.
 *
 * @public
 * @class
 * @memberof Mocha.reporters
 * @extends Mocha.reporters.Base
 * @param {Runner} runner - Instance triggers reporter actions.
 * @param {Object} [options] - runner options
 */
function Landing(runner, options) {
  Base.call(this, runner, options);

  var self = this;
  var width = (Base.window.width * 0.75) | 0;
  var total = runner.total;
  var stream = process.stdout;
  var plane = color('plane', '✈');
  var crashed = -1;
  var n = 0;

  function runway() {
    var buf = Array(width).join('-');
    return '  ' + color('runway', buf);
  }

  runner.on(EVENT_RUN_BEGIN, function() {
    stream.write('\n\n\n  ');
    cursor.hide();
  });

  runner.on(EVENT_TEST_END, function(test) {
    // check if the plane crashed
    var col = crashed === -1 ? ((width * ++n) / total) | 0 : crashed;

    // show the crash
    if (test.state === STATE_FAILED) {
      plane = color('plane crash', '✈');
      crashed = col;
    }

    // render landing strip
    stream.write('\u001b[' + (width + 1) + 'D\u001b[2A');
    stream.write(runway());
    stream.write('\n  ');
    stream.write(color('runway', Array(col).join('⋅')));
    stream.write(plane);
    stream.write(color('runway', Array(width - col).join('⋅') + '\n'));
    stream.write(runway());
    stream.write('\u001b[0m');
  });

  runner.once(EVENT_RUN_END, function() {
    cursor.show();
    process.stdout.write('\n');
    self.epilogue();
  });
}

/**
 * Inherit from `Base.prototype`.
 */
inherits(Landing, Base);

Landing.description = 'Unicode landing strip';

}).call(this,require('_process'))
},{"../runnable":33,"../runner":34,"../utils":38,"./base":17,"_process":69}],25:[function(require,module,exports){
(function (process){
'use strict';
/**
 * @module List
 */
/**
 * Module dependencies.
 */

var Base = require('./base');
var inherits = require('../utils').inherits;
var constants = require('../runner').constants;
var EVENT_RUN_BEGIN = constants.EVENT_RUN_BEGIN;
var EVENT_RUN_END = constants.EVENT_RUN_END;
var EVENT_TEST_BEGIN = constants.EVENT_TEST_BEGIN;
var EVENT_TEST_FAIL = constants.EVENT_TEST_FAIL;
var EVENT_TEST_PASS = constants.EVENT_TEST_PASS;
var EVENT_TEST_PENDING = constants.EVENT_TEST_PENDING;
var color = Base.color;
var cursor = Base.cursor;

/**
 * Expose `List`.
 */

exports = module.exports = List;

/**
 * Constructs a new `List` reporter instance.
 *
 * @public
 * @class
 * @memberof Mocha.reporters
 * @extends Mocha.reporters.Base
 * @param {Runner} runner - Instance triggers reporter actions.
 * @param {Object} [options] - runner options
 */
function List(runner, options) {
  Base.call(this, runner, options);

  var self = this;
  var n = 0;

  runner.on(EVENT_RUN_BEGIN, function() {
    Base.consoleLog();
  });

  runner.on(EVENT_TEST_BEGIN, function(test) {
    process.stdout.write(color('pass', '    ' + test.fullTitle() + ': '));
  });

  runner.on(EVENT_TEST_PENDING, function(test) {
    var fmt = color('checkmark', '  -') + color('pending', ' %s');
    Base.consoleLog(fmt, test.fullTitle());
  });

  runner.on(EVENT_TEST_PASS, function(test) {
    var fmt =
      color('checkmark', '  ' + Base.symbols.ok) +
      color('pass', ' %s: ') +
      color(test.speed, '%dms');
    cursor.CR();
    Base.consoleLog(fmt, test.fullTitle(), test.duration);
  });

  runner.on(EVENT_TEST_FAIL, function(test) {
    cursor.CR();
    Base.consoleLog(color('fail', '  %d) %s'), ++n, test.fullTitle());
  });

  runner.once(EVENT_RUN_END, self.epilogue.bind(self));
}

/**
 * Inherit from `Base.prototype`.
 */
inherits(List, Base);

List.description = 'like "spec" reporter but flat';

}).call(this,require('_process'))
},{"../runner":34,"../utils":38,"./base":17,"_process":69}],26:[function(require,module,exports){
(function (process){
'use strict';
/**
 * @module Markdown
 */
/**
 * Module dependencies.
 */

var Base = require('./base');
var utils = require('../utils');
var constants = require('../runner').constants;
var EVENT_RUN_END = constants.EVENT_RUN_END;
var EVENT_SUITE_BEGIN = constants.EVENT_SUITE_BEGIN;
var EVENT_SUITE_END = constants.EVENT_SUITE_END;
var EVENT_TEST_PASS = constants.EVENT_TEST_PASS;

/**
 * Constants
 */

var SUITE_PREFIX = '$';

/**
 * Expose `Markdown`.
 */

exports = module.exports = Markdown;

/**
 * Constructs a new `Markdown` reporter instance.
 *
 * @public
 * @class
 * @memberof Mocha.reporters
 * @extends Mocha.reporters.Base
 * @param {Runner} runner - Instance triggers reporter actions.
 * @param {Object} [options] - runner options
 */
function Markdown(runner, options) {
  Base.call(this, runner, options);

  var level = 0;
  var buf = '';

  function title(str) {
    return Array(level).join('#') + ' ' + str;
  }

  function mapTOC(suite, obj) {
    var ret = obj;
    var key = SUITE_PREFIX + suite.title;

    obj = obj[key] = obj[key] || {suite: suite};
    suite.suites.forEach(function(suite) {
      mapTOC(suite, obj);
    });

    return ret;
  }

  function stringifyTOC(obj, level) {
    ++level;
    var buf = '';
    var link;
    for (var key in obj) {
      if (key === 'suite') {
        continue;
      }
      if (key !== SUITE_PREFIX) {
        link = ' - [' + key.substring(1) + ']';
        link += '(#' + utils.slug(obj[key].suite.fullTitle()) + ')\n';
        buf += Array(level).join('  ') + link;
      }
      buf += stringifyTOC(obj[key], level);
    }
    return buf;
  }

  function generateTOC(suite) {
    var obj = mapTOC(suite, {});
    return stringifyTOC(obj, 0);
  }

  generateTOC(runner.suite);

  runner.on(EVENT_SUITE_BEGIN, function(suite) {
    ++level;
    var slug = utils.slug(suite.fullTitle());
    buf += '<a name="' + slug + '"></a>' + '\n';
    buf += title(suite.title) + '\n';
  });

  runner.on(EVENT_SUITE_END, function() {
    --level;
  });