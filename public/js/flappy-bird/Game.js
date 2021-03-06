(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _Constants = require('./Constants');

var _Constants2 = _interopRequireDefault(_Constants);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var canvasWidthHeight = _Constants2.default.canvasWidthHeight,
    GRAVITY = _Constants2.default.GRAVITY,
    GAME_SPEED_X = _Constants2.default.GAME_SPEED_X,
    BIRD_FRAME_LIST = _Constants2.default.BIRD_FRAME_LIST,
    TUBE_POS_LIST = _Constants2.default.TUBE_POS_LIST;

var Bird = function (_EventEmitter) {
  _inherits(Bird, _EventEmitter);

  function Bird(stage, tubeList) {
    _classCallCheck(this, Bird);

    var _this = _possibleConstructorReturn(this, (Bird.__proto__ || Object.getPrototypeOf(Bird)).call(this));

    _this.speedY = 0;
    _this.sprite = new PIXI.Sprite();
    _this.isDied = false;
    _this.textureCounter = 0;
    _this.tubeList = tubeList;
    _this.updateTexture = function () {
      if (_this.isDied) return;
      _this.sprite.texture = PIXI.loader.resources[BIRD_FRAME_LIST[_this.textureCounter++]].texture;

      if (_this.textureCounter === BIRD_FRAME_LIST.length) _this.textureCounter = 0;
    };

    stage.addChild(_this.sprite);
    _this.sprite.anchor.set(0.5, 0.5);
    _this.sprite.scale.x = 0.06;
    _this.sprite.scale.y = 0.06;
    _this.reset();

    document.addEventListener('keydown', function (e) {
      if (e.keyCode == 32) _this.jump(-GRAVITY / 3);
    });
    stage.on('pointerdown', function () {
      return _this.jump(-GRAVITY / 3);
    });

    setInterval(_this.updateTexture, 200);
    return _this;
  }

  _createClass(Bird, [{
    key: 'updateSprite',
    value: function updateSprite() {
      this.speedY += GRAVITY / 70;
      this.sprite.y += this.speedY;

      var isCollide = false;
      var _sprite = this.sprite,
          x = _sprite.x,
          y = _sprite.y,
          width = _sprite.width,
          height = _sprite.height;

      this.tubeList.forEach(function (d) {
        if (d.checkCollision(x - width / 2, y - height / 2, width, height)) isCollide = true;
      });
      if (y < -height / 2 || y > canvasWidthHeight + height / 2) isCollide = true;

      if (isCollide) {
        this.isDied = true;
        this.emit('collision');
      }
    }
  }, {
    key: 'jump',
    value: function jump(speedInc) {
      this.speedY += speedInc;
      this.speedY = Math.max(-GRAVITY, this.speedY);
    }
  }, {
    key: 'reset',
    value: function reset() {
      this.sprite.x = canvasWidthHeight / 6;
      this.sprite.y = canvasWidthHeight / 2.5;
      this.speedY = 0;
      this.isDied = false;
    }
  }]);

  return Bird;
}(_events2.default);

exports.default = Bird;

},{"./Constants":3,"events":1}],3:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var canvasWidthHeight = Math.min(Math.min(window.innerHeight, window.innerWidth), 512);

exports.default = {
  GRAVITY: 9.8,
  GAME_SPEED_X: 150,
  canvasWidthHeight: canvasWidthHeight,
  BIRD_FRAME_LIST: ['./images/frame-1.png', './images/frame-2.png', './images/frame-3.png', './images/frame-4.png'],
  TUBE_POS_LIST: [canvasWidthHeight + 150, canvasWidthHeight + 250, canvasWidthHeight + 480]
};

},{}],4:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _Tube = require('./Tube');

var _Tube2 = _interopRequireDefault(_Tube);

var _Bird = require('./Bird');

var _Bird2 = _interopRequireDefault(_Bird);

var _Constants = require('./Constants');

var _Constants2 = _interopRequireDefault(_Constants);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var canvasWidthHeight = _Constants2.default.canvasWidthHeight,
    GRAVITY = _Constants2.default.GRAVITY,
    GAME_SPEED_X = _Constants2.default.GAME_SPEED_X,
    BIRD_FRAME_LIST = _Constants2.default.BIRD_FRAME_LIST,
    TUBE_POS_LIST = _Constants2.default.TUBE_POS_LIST;

var Game = function () {
  function Game() {
    var _this = this;

    _classCallCheck(this, Game);

    var canvas = document.querySelector('.js-canvas');
    this.startBtn = document.querySelector('#start');
    this.started = false;
    this.failed = false;

    this.renderer = PIXI.autoDetectRenderer({
      width: canvasWidthHeight,
      height: canvasWidthHeight,
      view: canvas,
      backgroundColor: 0xC1FFFF
    });
    this.stage = new PIXI.Container();
    this.stage.interactive = true;
    this.stage.hitArea = new PIXI.Rectangle(0, 0, 1000, 1000);
    this.renderer.render(this.stage);

    this.tubeList = TUBE_POS_LIST.map(function (x) {
      return new _Tube2.default(_this.stage, x);
    });
    this.startBtn.addEventListener('click', function () {
      _this.started = true;
      _this.startBtn.innerHTML = 'Retry';
      if (_this.failed) {
        _this.failed = false;
        _this.tubeList.forEach(function (d, i) {
          return d.reset(TUBE_POS_LIST[i]);
        });
        _this.bird.reset();
      }
      _this.startBtn.classList.add('hide');
    });

    PIXI.loader.add(BIRD_FRAME_LIST).load(this.setup.bind(this));
  }

  _createClass(Game, [{
    key: 'setup',
    value: function setup() {
      var _this2 = this;

      this.bird = new _Bird2.default(this.stage, this.tubeList);
      this.bird.on('collision', function () {
        _this2.failed = true;
        _this2.startBtn.classList.remove('hide');
      });
      this.draw();
    }
  }, {
    key: 'draw',
    value: function draw() {
      if (this.started) {
        this.bird.updateSprite();
        if (!this.failed) this.tubeList.forEach(function (d) {
          return d.update();
        });
      }
      this.renderer.render(this.stage);
      requestAnimationFrame(this.draw.bind(this));
    }
  }]);

  return Game;
}();

exports.default = Game;

},{"./Bird":2,"./Constants":3,"./Tube":5}],5:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _Constants = require('./Constants');

var _Constants2 = _interopRequireDefault(_Constants);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var canvasWidthHeight = _Constants2.default.canvasWidthHeight,
    GRAVITY = _Constants2.default.GRAVITY,
    GAME_SPEED_X = _Constants2.default.GAME_SPEED_X,
    BIRD_FRAME_LIST = _Constants2.default.BIRD_FRAME_LIST,
    TUBE_POS_LIST = _Constants2.default.TUBE_POS_LIST;

var Tube = function () {
  function Tube(stage, x) {
    _classCallCheck(this, Tube);

    this.sprite = new PIXI.Graphics();
    this.innerDistance = 180;
    this.tubeWidth = 30;

    stage.addChild(this.sprite);
    this.reset(x);
  }

  _createClass(Tube, [{
    key: 'reset',
    value: function reset() {
      var x = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : canvasWidthHeight + 20;

      this.x = x;

      var tubeMinHeight = 60;
      var randomNum = Math.random() * (canvasWidthHeight - 2 * tubeMinHeight - this.innerDistance);
      this.y = tubeMinHeight + randomNum;
    }
  }, {
    key: 'checkCollision',
    value: function checkCollision(x, y, width, height) {
      if (!(x + width < this.x || this.x + this.tubeWidth < x || this.y < y)) {
        return true;
      }
      if (!(x + width < this.x || this.x + this.tubeWidth < x || y + height < this.y + this.innerDistance)) {
        return true;
      }
      return false;
    }
  }, {
    key: 'update',
    value: function update() {
      this.x -= GAME_SPEED_X / 60;
      if (this.x < -this.tubeWidth) this.reset();

      this.sprite.clear();
      this.sprite.beginFill(0x04B404, 1);
      var x = this.x,
          y = this.y,
          tubeWidth = this.tubeWidth,
          innerDistance = this.innerDistance;

      this.sprite.drawRect(x, 0, tubeWidth, y);
      this.sprite.drawRect(x, y + innerDistance, tubeWidth, canvasWidthHeight);
      this.sprite.endFill();
    }
  }]);

  return Tube;
}();

exports.default = Tube;

},{"./Constants":3}]},{},[4]);
