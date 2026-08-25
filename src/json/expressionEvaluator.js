/*
  Safely evaluates the lua expression subset allowed by
  lua/common/jbeam/expressionParser.lua.
*/

const {ExpressionError, parse} = require('./expressionParser')
const {createEnvironment, isTruthy} = require('./expressionEnvironment')

function getOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined
}

function toLuaString(value) {
  if (typeof value !== 'number') return String(value)
  if (Number.isInteger(value)) return String(value)
  return String(Number(value.toPrecision(14)))
}

function toNumber(value, operator) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value))) return Number(value)
  throw new ExpressionError(`cannot use ${value === null ? 'nil' : typeof value} in '${operator}'`)
}

function variableValue(value) {
  return value !== null && typeof value === 'object' && value.val !== undefined ? value.val : value
}

function compare(operator, left, right) {
  if (typeof left === 'string' && typeof right === 'string') {
    if (operator === '<') return left < right
    if (operator === '>') return left > right
    if (operator === '<=') return left <= right
    return left >= right
  }
  const a = toNumber(left, operator)
  const b = toNumber(right, operator)
  if (operator === '<') return a < b
  if (operator === '>') return a > b
  if (operator === '<=') return a <= b
  return a >= b
}

function evaluate(node, ctx) {
  if (node.kind === 'const') return node.value
  if (node.kind === 'array') return node.values.map(value => evaluate(value, ctx))

  if (node.kind === 'variable') {
    const value = getOwn(ctx.vars, node.name)
    if (value === undefined) {
      if (!ctx.missing.includes(node.name)) ctx.missing.push(node.name)
      return null
    }
    return variableValue(value)
  }

  if (node.kind === 'name') return getOwn(ctx.env, node.name) ?? null

  if (node.kind === 'index') {
    const object = evaluate(node.object, ctx)
    if (object === null || typeof object !== 'object') {
      throw new ExpressionError(`cannot read a field of ${object === null ? 'nil' : typeof object}`)
    }
    return getOwn(object, evaluate(node.key, ctx)) ?? null
  }

  if (node.kind === 'call') {
    const target = evaluate(node.target, ctx)
    if (typeof target !== 'function') {
      const name = node.target.kind === 'name' ? node.target.name : 'value'
      throw new ExpressionError(`'${name}' is not a supported function`)
    }
    return target(...node.args.map(arg => evaluate(arg, ctx))) ?? null
  }

  if (node.kind === 'unary') {
    if (node.operator === 'not') return !isTruthy(evaluate(node.operand, ctx))
    const value = evaluate(node.operand, ctx)
    if (node.operator === '-') return -toNumber(value, '-')
    if (typeof value === 'string') return value.length
    if (value !== null && typeof value === 'object') {
      return Object.keys(value).filter(key => key !== '__meta').length
    }
    throw new ExpressionError("cannot use '#' on this value")
  }

  const operator = node.operator
  if (operator === 'and') {
    const left = evaluate(node.left, ctx)
    return isTruthy(left) ? evaluate(node.right, ctx) : left
  }
  if (operator === 'or') {
    const left = evaluate(node.left, ctx)
    return isTruthy(left) ? left : evaluate(node.right, ctx)
  }

  const left = evaluate(node.left, ctx)
  const right = evaluate(node.right, ctx)
  if (operator === '==') return left === right
  if (operator === '~=') return left !== right
  if (operator === '..') {
    if (left === null || right === null || typeof left === 'boolean' || typeof right === 'boolean') {
      throw new ExpressionError("cannot concatenate this value with '..'")
    }
    return toLuaString(left) + toLuaString(right)
  }
  if (operator === '+') return toNumber(left, '+') + toNumber(right, '+')
  if (operator === '-') return toNumber(left, '-') - toNumber(right, '-')
  if (operator === '*') return toNumber(left, '*') * toNumber(right, '*')
  if (operator === '/') return toNumber(left, '/') / toNumber(right, '/')
  if (operator === '%') {
    const a = toNumber(left, '%')
    const b = toNumber(right, '%')
    return a - Math.floor(a / b) * b
  }
  if (operator === '^') return Math.pow(toNumber(left, '^'), toNumber(right, '^'))
  return compare(operator, left, right)
}

function evaluateExpression(source, vars = {}) {
  const body = source.startsWith('$=') ? source.slice(2) : source
  const ctx = {vars, missing: [], env: createEnvironment(body, vars)}
  try {
    const value = evaluate(parse(body), ctx)
    return {value: value === null ? undefined : value, missing: ctx.missing}
  } catch (error) {
    if (!(error instanceof ExpressionError) && !(error instanceof RangeError)) throw error
    return {value: undefined, missing: ctx.missing, error: error.message}
  }
}

module.exports = {
  evaluateExpression,
  toLuaString,
}
