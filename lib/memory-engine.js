var EventEmitter = require('events').EventEmitter
  , lruCache = require('lru-cache')
  , _ = require('lodash')

// V8 prefers predictable objects
function CachePacket(ttl, data) {
  if (ttl) {
    ttl += Date.now()
  }
  this.ttl = ttl
  this.data = data
}

module.exports = function memoryEngine(opts) {

  var options = _.extend(
      { size: 5000 }
      , opts)
    , cache = lruCache(options.size)
    , self = new EventEmitter()

  self.uberCacheVersion = '1'

  self.set = function set(key, value, ttl, callback) {
    var encoded

    // If no TTL is defined then last as long as possible
    if (typeof ttl === 'function') {
      callback = ttl
      ttl = undefined
    }

    // Don't handle undefined cache keys
    if (typeof key === 'undefined') {
      return callback(new Error('Invalid key undefined'))
    }

    // encode to the object is immutable
    try {
      encoded = JSON.stringify(value)
    } catch (err) {
      if (typeof callback === 'function') {
        callback(err)
      }
      return
    }

    cache.set(key, new CachePacket(ttl, encoded))

    if (typeof callback === 'function') {
      callback(null, value)
    }
  }

  self.get = function get(key, callback) {
    var value
      , cachePacket = cache.get(key)

    if (typeof cachePacket === 'undefined') {
      self.emit('miss', key)
      return callback()
    }

    try {
      value = JSON.parse(cachePacket.data)
    } catch (err) {
      return callback(err)
    }

    // If ttl has expired, delete
    if (cachePacket.ttl < Date.now()) {
      cache.del(key)
      self.emit('miss', key)
      self.emit('stale', key, value, cachePacket.ttl)
      value = undefined
    } else {
      self.emit('hit', key, value, cachePacket.ttl)
    }

    callback(null, value)
  }

  self.del = function del(key, callback) {
    cache.del(key)
    if (typeof callback === 'function') callback(null)
  }

  self.clear = function clear(callback) {
    cache.reset()
    if (typeof callback === 'function') callback(null)
  }

  self.size = function size(callback) {
    callback(null, cache.length)
  }

  self.dump = function dump(callback) {
    callback(null, cache.dump())
  }

  return self
}