// Resolves values from a part's variables section and from its parent slot.
const expressionEvaluator = require('./expressionEvaluator')

function getOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined
}

function variableValue(entry) {
  return (entry !== null && typeof entry === 'object' && entry.val !== undefined) ? entry.val : entry
}

function cloneValue(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) return seen.get(value)

  const clone = Array.isArray(value) ? [] : {}
  seen.set(value, clone)
  for (const key of Object.keys(value)) if (key !== '__meta') clone[key] = cloneValue(value[key], seen)
  return clone
}

function componentValue(path, vars) {
  const keys = path.split('.')
  if (keys.shift() !== 'components') return undefined
  let value = variableValue(getOwn(vars, '$components'))
  for (const key of keys) {
    if (!value || typeof value !== 'object') return undefined
    value = getOwn(value, key)
  }
  return value
}

function resolveValue(value, vars) {
  if (typeof value !== 'string' || value[0] !== '$') return {value: value}

  const marker = value[1]
  if (marker === '=') {
    const result = expressionEvaluator.evaluateExpression(value, vars)
    return result.value === undefined ? {value: value, missing: result.missing, error: result.error} : result
  }
  if (value.startsWith('$>>')) {
    const resolved = componentValue(value.slice(3), vars)
    return resolved === undefined ? {value: undefined, remove: true} : {value: cloneValue(resolved)}
  }
  if (marker === '+' || marker === '*' || marker === '<' || marker === '>') return {value: value}
  if (marker === '.') {
    const prefix = variableValue(getOwn(vars, '$prefix')) ?? ''
    const suffix = variableValue(getOwn(vars, '$suffix')) ?? ''
    return {value: prefix + value.slice(2) + suffix}
  }

  const entry = getOwn(vars, value)
  if (entry === undefined) return {value: value, missing: [value]}
  const resolved = variableValue(entry)
  return resolved === undefined || resolved === null ? {value: value, missing: [value]} : {value: resolved}
}

function expressionValue(value, vars) {
  if (typeof value !== 'string' || !value.startsWith('$=')) return value
  return expressionEvaluator.evaluateExpression(value, vars).value
}

function collectSectionVariables(part, evaluationVars, outputVars) {
  const section = part.variables
  if (!section || typeof section !== 'object' || section.__meta?.type !== 'array') return

  const header = section[0]
  if (!header || typeof header !== 'object') return
  const columns = {}
  for (const key of Object.keys(header)) {
    if (key !== '__meta' && typeof header[key] === 'string') columns[header[key]] = key
  }
  if (columns.name === undefined) return

  for (const rowKey of Object.keys(section)) {
    if (rowKey === '__meta' || rowKey === '0') continue
    const row = section[rowKey]
    if (!row || typeof row !== 'object') continue

    let name = row[columns.name]
    name = expressionValue(name, evaluationVars)
    if (typeof name !== 'string' || name[0] !== '$') continue

    let value = expressionValue(columns.default === undefined ? undefined : row[columns.default], evaluationVars)
    if (value === undefined) continue

    const min = expressionValue(columns.min === undefined ? undefined : row[columns.min], evaluationVars)
    const max = expressionValue(columns.max === undefined ? undefined : row[columns.max], evaluationVars)
    if (typeof value === 'number' && typeof min === 'number' && typeof max === 'number') {
      value = Math.min(Math.max(value, Math.min(min, max)), Math.max(min, max))
    }
    outputVars[name] = value
    if (getOwn(evaluationVars, name) === undefined) evaluationVars[name] = value
  }
}

function mergeSlotVariables(vars, slotVariables) {
  const pending = Object.keys(slotVariables).filter(key => key !== '__meta' && key[0] === '$')
  for (let pass = 0; pass < pending.length && pending.length > 0; pass++) {
    for (let i = pending.length - 1; i >= 0; i--) {
      const key = pending[i]
      const resolved = resolveValue(slotVariables[key], vars)
      if (resolved.missing?.length) continue
      vars[key] = resolved.value
      pending.splice(i, 1)
    }
  }
}

function mergeVariableScopes(parentVariables, localVariables, slotVariables) {
  const slotScope = cloneValue(parentVariables)
  if (slotVariables) mergeSlotVariables(slotScope, slotVariables)

  const vars = Object.assign(cloneValue(parentVariables), cloneValue(localVariables))
  for (const key of Object.keys(slotVariables || {})) {
    if (key !== '__meta' && getOwn(slotScope, key) !== undefined) vars[key] = slotScope[key]
  }
  return vars
}

function collectVariables(part, slotContext, vehicleContext) {
  const parentVariables = cloneValue(slotContext?.parentVariables || {})
  const slotVariables = slotContext?.slotVariables || slotContext
  if (vehicleContext?.components) {
    parentVariables['$components'] = cloneValue(vehicleContext.components)
  } else if (!parentVariables['$components'] && part.components && typeof part.components === 'object') {
    parentVariables['$components'] = part.components
  }
  Object.assign(parentVariables, vehicleContext?.variables || {})

  const evaluationVars = cloneValue(parentVariables)
  if (slotVariables) mergeSlotVariables(evaluationVars, slotVariables)

  const localVariables = {}
  collectSectionVariables(part, evaluationVars, localVariables)
  Object.assign(localVariables, vehicleContext?.variables || {})

  return mergeVariableScopes(parentVariables, localVariables, slotVariables)
}

function recordOriginal(table, key, original) {
  if (!table.__meta) return
  if (!table.__meta.unresolved) table.__meta.unresolved = {}
  table.__meta.unresolved[key] = original
}

function applyToTable(table, vars, diagnostics, reported) {
  const renames = []
  for (const key of Object.keys(table)) {
    if (key === '__meta') continue
    if (key[0] === '$' && !key.startsWith('$>>')) {
      const resolvedKey = resolveValue(key, vars).value
      if (resolvedKey !== key && resolvedKey !== undefined && resolvedKey !== null) {
        renames.push([key, String(resolvedKey)])
      }
    }
  }

  for (const [oldKey, newKey] of renames) {
    Object.defineProperty(table, newKey, {value: table[oldKey], enumerable: true, configurable: true, writable: true})
    delete table[oldKey]
  }

  for (const key of Object.keys(table)) {
    if (key === '__meta') continue
    const value = table[key]
    if (typeof value === 'string') {
      if (value[0] !== '$') continue
      const result = resolveValue(value, vars)
      if (result.error && !result.missing?.length && !reported.has(value)) {
        reported.add(value)
        diagnostics.push(['warning', `Cannot evaluate expression ${value}: ${result.error}`, table.__meta?.range])
      }
      if (result.remove) {
        recordOriginal(table, key, value)
        delete table[key]
        continue
      }
      if (result.value === value) continue
      recordOriginal(table, key, value)
      table[key] = result.value
      continue
    }

    if (value !== null && typeof value === 'object' && key !== 'variables') {
      applyToTable(value, vars, diagnostics, reported)
    }
  }
}

function applyVariables(part, vars, diagnostics) {
  const reported = new Set()
  if (part.components && typeof part.components === 'object') {
    applyToTable(part.components, vars, diagnostics, reported)
  }
  applyToTable(part, vars, diagnostics, reported)
}
module.exports = {collectVariables, mergeVariableScopes, applyVariables, resolveValue}
