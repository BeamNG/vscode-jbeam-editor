const nameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*/
const numberRegex = /^(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/
const operators = ['..', '==', '~=', '<=', '>=', '<', '>', '+', '-', '*', '/', '%', '^', '(', ')', '[', ']', ',', '.', '#']
const escapes = {n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'"}
const binaryOperators = {
  'or': 1, 'and': 2,
  '<': 3, '>': 3, '<=': 3, '>=': 3, '~=': 3, '==': 3,
  '..': 4,
  '+': 5, '-': 5,
  '*': 6, '/': 6, '%': 6,
  '^': 8,
}
const unaryPrecedence = 7

class ExpressionError extends Error {}

function tokenize(src) {
  const tokens = []
  let i = 0

  while (i < src.length) {
    const char = src[i]
    if (/\s/.test(char)) {
      i++
      continue
    }

    if (char === '"' || char === "'") {
      let value = ''
      i++
      while (i < src.length && src[i] !== char) {
        if (src[i] === '\\' && i + 1 < src.length) {
          value += escapes[src[i + 1]] ?? src[i + 1]
          i += 2
        } else {
          value += src[i++]
        }
      }
      if (i >= src.length) throw new ExpressionError('unterminated string')
      tokens.push({type: 'value', value})
      i++
      continue
    }

    if (/\d/.test(char) || (char === '.' && /\d/.test(src[i + 1]))) {
      const match = numberRegex.exec(src.slice(i))
      if (!match) throw new ExpressionError(`invalid number at position ${i}`)
      tokens.push({type: 'value', value: Number(match[0])})
      i += match[0].length
      continue
    }

    if (char === '$') {
      if (src[i + 1] === '(') {
        tokens.push({type: 'name', name: 'var_'})
        i++
        continue
      }
      const match = nameRegex.exec(src.slice(i + 1))
      tokens.push(match ? {type: 'variable', name: '$' + match[0]} : {type: 'value', value: '$'})
      i += match ? match[0].length + 1 : 1
      continue
    }

    const nameMatch = nameRegex.exec(src.slice(i))
    if (nameMatch) {
      tokens.push({type: 'name', name: nameMatch[0]})
      i += nameMatch[0].length
      continue
    }

    const operator = operators.find(op => src.startsWith(op, i))
    if (!operator) throw new ExpressionError(`unexpected character '${char}'`)
    tokens.push({type: 'operator', name: operator})
    i += operator.length
  }

  tokens.push({type: 'end'})
  return tokens
}

function parse(source) {
  if (source.length > 8192) throw new ExpressionError('expression is too long')
  const tokens = tokenize(source)
  let pos = 0
  let depth = 0
  const peek = () => tokens[pos]

  function expect(name) {
    const token = tokens[pos++]
    if (token.type !== 'operator' || token.name !== name) throw new ExpressionError(`expected '${name}'`)
  }

  function primary() {
    const token = tokens[pos++]
    if (token.type === 'value') return {kind: 'const', value: token.value}
    if (token.type === 'variable') return {kind: 'variable', name: token.name}
    if (token.type === 'name') {
      if (token.name === 'nil') return {kind: 'const', value: null}
      if (token.name === 'true') return {kind: 'const', value: true}
      if (token.name === 'false') return {kind: 'const', value: false}
      if (token.name === 'and' || token.name === 'or') throw new ExpressionError(`unexpected '${token.name}'`)
      return {kind: 'name', name: token.name}
    }
    if (token.type === 'operator' && token.name === '[') {
      const values = []
      if (peek().name !== ']') {
        values.push(expression(0))
        while (peek().name === ',') {
          pos++
          values.push(expression(0))
        }
      }
      expect(']')
      return {kind: 'array', values}
    }
    if (token.type === 'operator' && token.name === '(') {
      const node = expression(0)
      expect(')')
      return node
    }
    throw new ExpressionError('unexpected end of expression')
  }

  function suffixed() {
    let node = primary()
    for (;;) {
      const token = peek()
      if (token.type !== 'operator') return node
      if (token.name === '.') {
        pos++
        const key = tokens[pos++]
        if (key.type !== 'name') throw new ExpressionError('expected a field name after .')
        node = {kind: 'index', object: node, key: {kind: 'const', value: key.name}}
      } else if (token.name === '[') {
        pos++
        const key = expression(0)
        expect(']')
        node = {kind: 'index', object: node, key}
      } else if (token.name === '(') {
        pos++
        const args = []
        if (peek().name !== ')') {
          args.push(expression(0))
          while (peek().name === ',') {
            pos++
            args.push(expression(0))
          }
        }
        expect(')')
        node = {kind: 'call', target: node, args}
      } else {
        return node
      }
    }
  }

  function expression(limit) {
    if (++depth > 200) throw new ExpressionError('expression is nested too deeply')
    try {
      return expressionInner(limit)
    } finally {
      depth--
    }
  }

  function expressionInner(limit) {
    const token = peek()
    const unary = (token.type === 'operator' && (token.name === '-' || token.name === '#')) ||
      (token.type === 'name' && token.name === 'not')
    let left

    if (unary) {
      pos++
      left = {kind: 'unary', operator: token.name, operand: expression(unaryPrecedence)}
    } else {
      left = suffixed()
    }

    for (;;) {
      const next = peek()
      const name = next.type === 'operator' || next.type === 'name' ? next.name : null
      const precedence = Object.prototype.hasOwnProperty.call(binaryOperators, name) ? binaryOperators[name] : undefined
      if (precedence === undefined || precedence <= limit) break
      pos++
      const rightLimit = name === '..' || name === '^' ? precedence - 1 : precedence
      left = {kind: 'binary', operator: name, left, right: expression(rightLimit)}
    }
    return left
  }

  const node = expression(0)
  if (peek().type !== 'end') throw new ExpressionError('unexpected trailing input')
  return node
}

module.exports = {ExpressionError, parse}
