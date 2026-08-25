const {ExpressionError} = require('./expressionParser')

function clamp(x, min, max) {
  return Math.min(Math.max(x, min), max)
}

function isTruthy(value) {
  return value !== null && value !== undefined && value !== false
}

function hashString(text) {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash = ((hash ^ text.charCodeAt(i)) * 16777619) >>> 0
  }
  return hash
}

function createRandom(text) {
  let state = hashString(text) || 1
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

function createEnvironment(source, vars) {
  const random = createRandom(source)
  return {
    pi: Math.PI,
    huge: Infinity,
    abs: Math.abs,
    ceil: Math.ceil,
    floor: Math.floor,
    sqrt: Math.sqrt,
    exp: Math.exp,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: (y, x) => x === undefined ? Math.atan(y) : Math.atan2(y, x),
    atan2: Math.atan2,
    log: Math.log,
    log10: Math.log10,
    pow: Math.pow,
    fmod: (a, b) => a % b,
    deg: a => a * 180 / Math.PI,
    rad: a => a * Math.PI / 180,
    max: (...args) => Math.max(...args),
    min: (...args) => Math.min(...args),
    random: (min, max) => {
      if (min === undefined) return random()
      if (max === undefined) return Math.floor(random() * Math.floor(min)) + 1
      return Math.floor(random() * (Math.floor(max) - Math.floor(min) + 1)) + Math.floor(min)
    },
    randomseed: () => undefined,
    round: value => Math.floor(value + 0.5),
    square: value => value * value,
    clamp,
    sign: Math.sign,
    smoothstep: value => {
      value = clamp(value, 0, 1)
      return value * value * (3 - 2 * value)
    },
    smootherstep: value => clamp(value * value * value * (value * (value * 6 - 15) + 10), 0, 1),
    smoothmin: (a, b, k = 0.1) => {
      const h = clamp(0.5 + (b - a) / k, 0, 1)
      return h * a + (1 - h) * (b - h * k * 0.5)
    },
    case: (selector, ...args) => {
      let index = 0
      if (typeof selector === 'boolean') index = selector ? 1 : 2
      else if (typeof selector === 'number') index = Math.floor(selector)
      else throw new ExpressionError('only booleans and numbers work as case selectors')
      const value = args[index - 1]
      return isTruthy(value) ? value : args[args.length - 1]
    },
    concat: table => Object.keys(table).filter(key => key !== '__meta').map(key => table[key]).join(''),
    vec3: (x = 0, y = 0, z = 0) => ({x, y, z}),
    quat: (x = 0, y = 0, z = 0, w = 1) => ({x, y, z, w}),
    include: () => null,
    var: value => '$' + (value ?? ''),
    var_: value => value === undefined || value === null ? '$' : vars['$' + value] ?? null,
    var_var_: '$',
    print: value => value,
  }
}

module.exports = {
  createEnvironment,
  isTruthy,
}
