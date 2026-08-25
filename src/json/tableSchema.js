/*
  File: utilsExt.js

  Description:
  This JavaScript module provides utility functions and processing logic for handling structured data used in the context of BeamNG.drive JBEAM files.

  Functions and Constants:
  - `processAllParts`: Processes all parts of parsed data, applying custom logic and generating diagnostics.
  - `ignoreSections`: An object specifying sections to ignore during processing.
  - `specialVals`: A set of special constant values used in data processing.
  - `typeIds`: An object mapping type IDs to their corresponding values.
  - `replaceSpecialValues`: A function for replacing special values in data.

  Notes: This module enhances the processing capabilities for JBEAM data, allowing for more advanced and custom operations.
*/

/*
  Function: `processAllParts`

  Description:
  Processes all parts of parsed JBEAM data, applying custom logic to each part and generating diagnostics for any errors or warnings.

  Parameters:
  - `parsedData`: An object containing parsed JBEAM data with parts to be processed.

  Returns:
  An array containing two elements:
  1. An object with processed JBEAM parts.
  2. An array of diagnostics, including parsing errors and warnings.

  Example Usage:
  ```javascript
  const parsedJBEAMData = {
    part1: {  ... JBEAM data for part 1 ...  },
    part2: {  ... JBEAM data for part 2 ...  },
    // ... more parts ...
  };

  const [processedParts, diagnostics] = processAllParts(parsedJBEAMData);

  // Log processed parts and diagnostics
  console.log(processedParts);
  console.log(diagnostics);
  ```

  // Handle diagnostics (errors and warnings) as needed in your application.
  Notes: This function is used to process and enhance the JBEAM data, making it ready for further use or analysis. The diagnostics array contains information about any issues encountered during processing.
*/

const utilsExt = require('../utilsExt');
const jbeamVariables = require('./jbeamVariables');

let ignoreSections = {maxIDs: true, options: true, slotType: true};

const specialVals = {
  FLT_MAX: Infinity,
  MINUS_FLT_MAX: -Infinity
}

const typeIds = {
  NORMAL: 0,
  HYDRO: 6,
  ANISOTROPIC: 1,
  TIRESIDE: 1,
  BOUNDED: 2,
  PRESSURED: 3,
  SUPPORT: 7,
  LBEAM: 4,
  FIXED: 1,
  NONCOLLIDABLE: 2,
  SIGNAL_LEFT: 1,
  SIGNAL_RIGHT: 2,
  HEADLIGHT: 4,
  BRAKELIGHT: 8,
  RUNNINGLIGHT: 16,
  REVERSELIGHT: 32
}

function replaceSpecialValues(val) {
  return val;
}

function processTableWithSchemaDestructive(jbeamTable, inputOptions, diagnostics) {
  // Its a list, so verify that the first row is the header
  let header = jbeamTable[0];
  if(typeof header === "undefined") {
    // empty section
    return 0
  }
  if (typeof header !== "object") {
    diagnostics.push(['error', 'Invalid table header', header?.__meta?.range])
    return -1
  }

  if (header.__meta.type !== 'array') {
    diagnostics.push(['error', 'Invalid table header. Must be a list, not a dict', header.__meta.range])
    return -1
  }

  let headerSize = Object.keys(header).filter(key => key !== '__meta').length;
  let headerSize1 = headerSize;
  let newListSize = 0;
  let newList = {}
  let localOptions = replaceSpecialValues(Object.assign({}, inputOptions)) || {};

  // Remove the header from the data, as we don't need it anymore
  //jbeamTable.shift();
  delete jbeamTable[0];

  // Walk the list entries
  let newRowId = 0
  let keys = Object.keys(jbeamTable).filter(key => key !== '__meta')
  for (const rowKey of keys) {
    let rowValue = jbeamTable[rowKey];
    if (typeof rowValue !== "object") {
      diagnostics.push(['error', 'Invalid table row', rowValue?.__meta?.range])
      return -1
    }
    if (rowValue.__meta.type !== 'array') {
      // Case where options is a dict on its own, filling a whole line
      Object.assign(localOptions, replaceSpecialValues(rowValue));
      delete localOptions['__meta'] // TODO: record all the meta's somewhere
    } else {
      let newID = newRowId++

      const rowSize = Object.keys(rowValue).filter(key => key !== '__meta').length
      if (rowSize == headerSize + 1) {
        if(typeof rowValue[headerSize] !== 'object') {
          diagnostics.push(['error', `Inline option (argument ${headerSize + 1}) need to be a dict, not a ${typeof rowValue[headerSize]}: ${rowValue[headerSize]}`, rowValue.__meta.range])
        }
      } else if (rowSize > headerSize + 1) {
        let headerNoMeta = utilsExt.deepCloneAndRemoveKeys(header, ['__meta'])
        let rowValueNoMeta = utilsExt.deepCloneAndRemoveKeys(rowValue, ['__meta'])
        let msg = `Invalid table header, must be as long as all table cells (plus one additional options column):\n`;
        msg += `Table header: ${JSON.stringify(headerNoMeta)}\n`
        msg += `Mismatched row: ${JSON.stringify(rowValueNoMeta)}`
        diagnostics.push(['error', msg, rowValue.__meta.range])
        return -1
      } else if (rowSize < headerSize) {
        for (let i = 0; i < headerSize; i++) {
          if(i < rowSize) continue
          if(header[i] == 'nonFlexMaterials') continue // known problem
          diagnostics.push(['warning', `Row is missing argument ${i + 1}: ${header[i]}`, rowValue.__meta.range])
        }
      }

      // Walk the table row
      let newRow = Object.assign({}, localOptions);
      delete newRow['__meta'];

      // Check if inline options are provided, merge them then
      // Assuming `headerSize1` is the number of keys to skip
      const allKeys = Object.keys(rowValue).filter(key => key !== '__meta') // Get all keys of the rowValue object
      const relevantKeys = allKeys.slice(headerSize1); // Get the keys after the first `headerSize1` keys

      // Iterate over the remaining keys
      for (const key of relevantKeys) {
        let value = rowValue[key];
        if (typeof value === 'object' && value.__meta.type === 'object' && allKeys.length > headerSize1) {
          Object.assign(newRow, replaceSpecialValues(value));
          // remove options from rowValue
          delete rowValue[key];
          header[key] = "options";
        }
      }
      // Now care about the rest
      const allKeys2 = Object.keys(rowValue).filter(key => key !== '__meta')
      //for (let [rk, _] of Object.entries(rowValue)) {
      for (let rk in allKeys2) {
        if (header[rk] === null) {
          let headerNoMeta = utilsExt.deepCloneAndRemoveKeys(header, ['__meta'])
          let rowValueNoMeta = utilsExt.deepCloneAndRemoveKeys(rowValue, ['__meta'])
          let msg = `*** Unable to parse row, header for entry is missing: \n`
          msg += `*** Header: ${JSON.stringify(headerNoMeta)} missing key: ${rk} -- is the section header too short?\n`
          msg += `*** Row: ${JSON.stringify(rowValueNoMeta)}`
          diagnostics.push(['error', msg, rowValue.__meta.range])
        } else {
          newRow[header[rk]] = replaceSpecialValues(rowValue[rk]);
        }
      }
      if(rowValue.hasOwnProperty('__meta')) {
        newRow.__meta = rowValue.__meta
        if(newRow.__meta.obj) {
          // we might omit obj because we need to be able to convert the data into json, so no cyclic dependencies
          newRow.__meta.objStructured = newRow
        }
      }

      if (newRow.disable === true || newRow.variables?.disable === true) continue

      if (newRow.hasOwnProperty('id') && newRow.id !== null) {
        newID = newRow.id
        //newRow.name = newRow.id // the original is to exchange with id
        //delete newRow.id

        // changed behavior for the editor below
        // in BeamNG, only name exists, id is deleted
        newRow.id = newRow.id
        newRow.name = newRow.id

        newRow.__meta.isNamed = true
      }


      newList[newID] = newRow;
      newListSize++;
    }
  }
  newList.__meta = jbeamTable.__meta
  return newList;
}

const slotHeaders = {
  slots: ['type', 'default', 'description'],
  slots2: ['name', 'allowTypes', 'denyTypes', 'default', 'description'],
}

function sectionHasEntries(section) {
  return section && typeof section === 'object' && Object.keys(section).some(key => key !== '__meta')
}

function slotHeaderHint(sectionName) {
  return `["${slotHeaders[sectionName].join('", "')}"]`
}

// the header row is consumed while the table is processed, so it has to be checked before that.
// the game reconstructs a missing header for the legacy section, but not for slots2
function checkSlotHeaders(part, diagnostics) {
  for (const sectionName in slotHeaders) {
    const section = part[sectionName]
    if (!sectionHasEntries(section) || section.__meta?.type !== 'array') continue
    const header = section[0]
    if (header && typeof header === 'object' && header[0] === slotHeaders[sectionName][0]) continue
    diagnostics.push([
      sectionName === 'slots' ? 'warning' : 'error',
      `The "${sectionName}" section is missing its table header. It must be ${slotHeaderHint(sectionName)}`,
      (header?.__meta ?? section.__meta)?.range
    ])
  }
}

// the game upgrades "slots" to "slots2" on load and only keeps "slots2" from then on
function checkSlots(part, diagnostics) {
  const hasSlots = sectionHasEntries(part.slots)
  const hasSlots2 = sectionHasEntries(part.slots2)
  if (hasSlots && hasSlots2) {
    diagnostics.push(['warning', 'Part has "slots" and "slots2". The game only uses "slots2" and drops "slots"', part.slots.__meta?.range])
  }

  const sectionName = hasSlots2 ? 'slots2' : (hasSlots ? 'slots' : null)
  if (!sectionName) return

  const nameKey = sectionName === 'slots2' ? 'name' : 'type'
  const seenNames = {}

  for (const rowKey in part[sectionName]) {
    if (rowKey === '__meta') continue
    const slot = part[sectionName][rowKey]
    if (!slot || typeof slot !== 'object') continue
    const range = slot.__meta?.range

    const slotName = slot[nameKey]
    if (typeof slotName !== 'string' || slotName === '') {
      diagnostics.push(['error', `Slot is missing "${nameKey}". The section header must be ${slotHeaderHint(sectionName)}`, range])
      continue
    }
    // legacy slots can rename themselves with an inline "name" option, the game prefers that name
    const slotId = (typeof slot.name === 'string' && slot.name !== '') ? slot.name : slotName
    if (seenNames[slotId]) {
      diagnostics.push(['warning', `Slot "${slotId}" exists more than once in this part, so a part config fills all of them with the same part`, range])
    }
    seenNames[slotId] = true

    if (sectionName !== 'slots2') continue

    for (const key of ['allowTypes', 'denyTypes']) {
      if (slot[key] === undefined) continue
      if (typeof slot[key] !== 'object' || slot[key].__meta?.type !== 'array') {
        diagnostics.push(['error', `Slot "${key}" must be a list of slot types, for example ["${slotName}"]`, range])
      }
    }
    if (utilsExt.getStringList(slot.allowTypes).length === 0) {
      diagnostics.push(['warning', `Slot "${slotName}" has no "allowTypes", so no part fits into it`, range])
    }
  }
}

function processPart(partName, part, diagnostics, slotVariableProvider, vehicleContextProvider) {
  if (!part || typeof part !== 'object') {
    return false
  }
  // variables are resolved before the sections become tables, just like the game does it,
  // so that node ids and positions built from expressions are usable everywhere
  const slotTypes = utilsExt.getStringList(part.slotType)
  const slotVariables = slotVariableProvider ? slotVariableProvider(slotTypes, partName) : null
  const vehicleContext = vehicleContextProvider ? vehicleContextProvider(partName) : null
  const variableScope = jbeamVariables.collectVariables(part, slotVariables, vehicleContext)
  if (part.__meta) {
    Object.defineProperty(part.__meta, 'variableScope', {value: variableScope, configurable: true})
  }
  jbeamVariables.applyVariables(part, variableScope, diagnostics)

  part.maxIDs = {};
  part.validTables = {};
  part.beams = part.beams || {};
  checkSlotHeaders(part, diagnostics)

  // Walk everything and look for options
  part.options = part.options || {}
  for (let keyEntry in part) {
    if (!part.hasOwnProperty(keyEntry)) continue

    let entry = part[keyEntry];
    if (typeof entry !== "object") {
      // seems to be an option, add it to the vehicle options
      part.options[keyEntry] = entry;
      delete part[keyEntry];
    }
  }

  // Walk all sections of the part
  let sectionNames = Object.keys(part).filter(key => key !== '__meta')
  for (let sectionName of sectionNames) {
    if (!part.hasOwnProperty(sectionName)) continue;

    let section = part[sectionName];

    // Verify key names to be properly formatted
    if (!/^[a-zA-Z_]+[a-zA-Z0-9_]*$/.test(sectionName)) {
      diagnostics.push(['error', `Invalid attribute name '${sectionName}'`, section.__meta.range])
      return false
    }

    // Init max
    part.maxIDs[sectionName] = 0;

    if (typeof section === "object" && !ignoreSections[sectionName] && Object.keys(section).length > 0) {
      if(section.__meta.type !== 'array') {
        // section dictionaries to be written
      } else {
        if (!part.validTables[sectionName]) {
          let newList = processTableWithSchemaDestructive(section, part.options, diagnostics);
          if (newList !== undefined && newList.length > 0) {
            part.validTables[sectionName] = true;
          }
          part[sectionName] = newList;
        }
      }
    }
  }

  // now custom, advanced processing ...
  if (part.hasOwnProperty('nodes')) {
    let nodeNames = Object.keys(part.nodes)
    for (let nodeIdIdx in nodeNames) {
      let nodeId = nodeNames[nodeIdIdx]
      let node = part.nodes[nodeId];
      if(node.hasOwnProperty('posX')) {
        try {
          node.pos = [node.posX, node.posY, node.posZ]
        } catch (e) {
          diagnostics.push(['error', e.message, node.__meta.range])
        }
      }
    }
  }
  // check duplicate beams
  if (part?.beams) {
    const seenBeams = {}
    for (const beamKey in part.beams) {
      if (beamKey !== '__meta') {
        const beam = part.beams[beamKey]

        // Ignore certain beams
        if (beam.beamSpring !== 0 && (beam.deformGroup === undefined || beam.deformGroup === '') && beam.beamType !== '|BOUNDED' && beam.optional !== true) {
          const [sortedId1, sortedId2] = [beam['id1:'], beam['id2:']].sort();

          let bType = '|NORMAL'
          if (beam.beamType !== undefined) {
            bType = beam.beamType === '' ? '|NORMAL' : beam.beamType
          }
          const beamIdentifier = `${sortedId1}_${sortedId2}_${bType}`;

          if (beamIdentifier in seenBeams) {
            const seenBeam = seenBeams[beamIdentifier]
            if (!seenBeam[0]) {
              diagnostics.push(['warning', `Duplicate beam: ${seenBeam[1]}, ${seenBeam[2]}`, seenBeam[3]])
              seenBeam[0] = true
            }
            diagnostics.push(['warning', `Duplicate beam: ${sortedId1}, ${sortedId2}`, beam.__meta.range])
          } else {
            seenBeams[beamIdentifier] = [false, sortedId1, sortedId2, beam.__meta.range]
          }
        }
      }
    }
  }
  // Check for degenerate triangles
  if (part?.triangles) {
    for (const triangleName in part.triangles) {
      if (triangleName !== '__meta') {
        const triangle = part.triangles[triangleName];
        if (typeof triangle === 'object' && triangle['id1:'] && triangle['id2:'] && triangle['id3:']) {
          const id1 = triangle['id1:'];
          const id2 = triangle['id2:'];
          const id3 = triangle['id3:'];
          const sortedNodes = [id1, id2, id3].sort();

          // Check if any two nodes are the same, indicating a degenerate triangle
          if (sortedNodes[0] === sortedNodes[1] || sortedNodes[1] === sortedNodes[2]) {
            diagnostics.push(['error', `Degenerate triangle: ${id1}, ${id2}, ${id3}`, triangle.__meta.range])
          }
        }
      }
    }
  }
  checkSlots(part, diagnostics)

  return true;
}

// Providers add context from the parent slot and the running vehicle when available.
function processAllParts(parsedData, slotVariableProvider, vehicleContextProvider) {
  let tableInterpretedData = {}
  let diagnostics = [] // contains parsing errors and warnings

  if (!parsedData || typeof parsedData !== 'object') {
    diagnostics.push(['error', `Unable to process parts'`, parsedData?.__meta?.range])
  }
  else {
    const keys = Object.keys(parsedData).filter(key => key !== '__meta')
    for (let partName of keys) {
      if (!parsedData.hasOwnProperty(partName)) continue;
      let part = parsedData[partName];
      if (processPart(partName, part, diagnostics, slotVariableProvider, vehicleContextProvider) !== true) {
        diagnostics.push(['error', `Unable to process part '${partName}'`, part?.__meta?.range])
      }
      tableInterpretedData[partName] = part
    }
    tableInterpretedData.__meta = parsedData.__meta
  }
  return [tableInterpretedData, diagnostics]
}

module.exports = {
  processAllParts,
};