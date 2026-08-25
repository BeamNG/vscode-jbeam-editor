const assert = require('assert')
const evaluator = require('../src/json/expressionEvaluator')
const variables = require('../src/json/jbeamVariables')

function expression(source, vars, expected) {
  const result = evaluator.evaluateExpression(source, vars)
  assert.strictEqual(result.error, undefined, result.error)
  assert.deepStrictEqual(result.value, expected)
}

expression("$='ocp'..$seatID..'6r'", {'$seatID': 'FL'}, 'ocpFL6r')
expression('$=0.6+(0.95*$occupantWeight/8)', {'$occupantWeight': 80}, 10.1)
expression('$=$set and 1 or 2', {'$set': false}, 2)
expression('$=$set and 1 or 2', {'$set': 0}, 1)
expression("$=$value ~= nil and 'set' or 'unset'", {}, 'unset')
expression('$=-2^2', {}, -4)
expression("$=1/3 .. ''", {}, '0.33333333333333')
expression("$=['axle_'..$prefix..'_FR']", {'$prefix': 'A'}, ['axle_A_FR'])
expression("$=$('tirepressure_'..$suffix)", {
  '$tirepressure_FL': 27,
  '$suffix': 'FL',
}, 27)
expression('$=$components.whl[$suffix].offset', {
  '$components': {whl: {FL: {offset: 7}}},
  '$suffix': 'FL',
}, 7)

const unresolved = evaluator.evaluateExpression('$=$missing+1', {})
assert.deepStrictEqual(unresolved.missing, ['$missing'])

const slotVariables = {
  '$seatID': 'FL',
  '$nodeB': '$nodeA',
  '$nodeA': 'sf1l',
}
const part = {
  __meta: {type: 'object'},
  variables: {
    0: {0: 'name', 1: 'type', 2: 'unit', 3: 'category', 4: 'default', 5: 'min', 6: 'max'},
    1: {0: '$occupantWeight', 1: 'range', 2: 'kg', 3: 'Cargo', 4: 80, 5: 0, 6: 150},
    __meta: {type: 'array'},
  },
  nodes: {
    0: {0: 'id', 1: 'posX', 2: 'posY', 3: 'posZ', __meta: {type: 'array'}},
    1: {
      0: "$='ocp'..$seatID..'6r'",
      1: 0,
      2: 0,
      3: 1,
      4: {nodeWeight: '$=0.6+(0.95*$occupantWeight/8)', ref: '$nodeB'},
      __meta: {type: 'array'},
    },
    __meta: {type: 'array'},
  },
}
const scope = variables.collectVariables(part, slotVariables)
variables.applyVariables(part, scope, [])

assert.strictEqual(part.nodes[1][0], 'ocpFL6r')
assert.strictEqual(part.nodes[1][4].nodeWeight, 10.1)
assert.strictEqual(part.nodes[1][4].ref, 'sf1l')
assert.strictEqual(part.nodes[1].__meta.unresolved[0], "$='ocp'..$seatID..'6r'")

const tire = {
  __meta: {type: 'object'},
  components: {whl: {'$suffix': {offset: 7}}},
  variables: {
    0: {0: 'name', 1: 'type', 2: 'unit', 3: 'category', 4: 'default', 5: 'min', 6: 'max'},
    1: {0: "$=var('tirepressure_'..$suffix)", 1: 'range', 2: 'psi', 3: 'Wheels', 4: 27, 5: 0, 6: 50},
    __meta: {type: 'array'},
  },
  pressurePSI: "$=$('tirepressure_'..$suffix)",
  offset: '$=$components.whl[$suffix].offset',
}
const tireScope = variables.collectVariables(tire, {'$suffix': 'FL'})
variables.applyVariables(tire, tireScope, [])
assert.strictEqual(tire.pressurePSI, 27)
assert.strictEqual(tire.offset, 7)
assert.strictEqual(tire.components.whl.FL.offset, 7)

const redirected = variables.resolveValue('$>>components.whl.FL.offset', {
  '$components': {whl: {FL: {offset: 7}}},
})
assert.strictEqual(redirected.value, 7)
const redirectPart = {
  found: '$>>components.whl.FL.offset',
  missing: '$>>components.missing',
  '$>>components.key': 1,
}
variables.applyVariables(redirectPart, {'$components': {whl: {FL: {offset: 7}}}}, [])
assert.strictEqual(redirectPart.found, 7)
assert.strictEqual('missing' in redirectPart, false)
assert.strictEqual(redirectPart['$>>components.key'], 1)

const ranged = {
  __meta: {type: 'object'},
  variables: {
    0: {0: 'name', 1: 'type', 2: 'unit', 3: 'category', 4: 'default', 5: 'min', 6: 'max'},
    1: {0: '$length', 1: 'range', 2: 'm', 3: 'Test', 4: 2, 5: 0, 6: 10},
    2: {0: '$width', 1: 'range', 2: 'm', 3: 'Test', 4: 5, 5: '$=$length+1', 6: 4},
    __meta: {type: 'array'},
  },
}
assert.strictEqual(variables.collectVariables(ranged).$width, 4)

const inherited = variables.mergeVariableScopes(
  {'$dragCoef': 2, '$components': {loadDragCoef: 4}},
  {'$local': 1},
  {'$dragCoef': '$=$dragCoef*1.5', '$loadDrag': '$=$components.loadDragCoef'}
)
assert.strictEqual(inherited.$dragCoef, 3)
assert.strictEqual(inherited.$loadDrag, 4)

const cyclicComponents = {value: 1}
cyclicComponents.__meta = {obj: cyclicComponents}
cyclicComponents.self = cyclicComponents
const cyclicScope = variables.collectVariables({components: cyclicComponents})
assert.strictEqual(cyclicScope.$components.value, 1)
assert.strictEqual(cyclicScope.$components.self, cyclicScope.$components)
assert.strictEqual(cyclicScope.$components.__meta, undefined)

const livePart = {
  components: {height: 1},
  value: '$=$components.height+$tune',
  __meta: {type: 'object'},
}
const liveScope = variables.collectVariables(livePart, null, {
  components: {height: 4},
  variables: {'$tune': 2},
})
variables.applyVariables(livePart, liveScope, [])
assert.strictEqual(livePart.value, 6)

const tunedSlotScope = variables.collectVariables(
  {__meta: {type: 'object'}},
  {'$slotValue': '$=$tuned*2'},
  {variables: {'$tuned': {val: 3}}}
)
assert.strictEqual(tunedSlotScope.$slotValue, 6)

console.log('Variable tests passed')
