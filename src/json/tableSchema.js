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

let ignoreSections = {maxIDs: true, options: true};

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
  if (typeof header !== "object" || !header.hasOwnProperty('__isarray') || !header.__isarray) {
    diagnostics.push(['error', 'Invalid table header', header.__range])
    return -1
  }

  if (!header.hasOwnProperty('__isarray') || !header.__isarray) {
    diagnostics.push(['error', 'Invalid table header. Must be a list, not a dict', header.__range])
    return -1
  }

  let headerSize = Object.keys(header).filter(key => !utilsExt.excludedMagicKeys.includes(key)).length;
  let headerSize1 = headerSize;
  let newListSize = 0;
  let newList = {}
  let localOptions = replaceSpecialValues(Object.assign({}, inputOptions)) || {};

  // Remove the header from the data, as we don't need it anymore
  //jbeamTable.shift();
  delete jbeamTable[0];

  // Walk the list entries
  let newRowId = 0
  let keys = Object.keys(jbeamTable).filter(key => !utilsExt.excludedMagicKeys.includes(key))
  for (const rowKey of keys) {
    let rowValue = jbeamTable[rowKey];
    if (typeof rowValue !== "object") {
      diagnostics.push(['error', 'Invalid table row', rowValue.__range])
      return -1
    }
    if (!rowValue.hasOwnProperty('__isarray') || !rowValue.__isarray) {
      // Case where options is a dict on its own, filling a whole line
      Object.assign(localOptions, replaceSpecialValues(rowValue));
      //localOptions.__astNodeIdx = null;
    } else {
      let newID = newRowId++

      const rowSize = Object.keys(rowValue).filter(key => !utilsExt.excludedMagicKeys.includes(key)).length
      if (rowSize == headerSize + 1) {
        if(typeof rowValue[headerSize] !== 'object') {
          diagnostics.push(['error', `Inline option (argument ${headerSize + 1}) need to be a dict, not a ${typeof rowValue[headerSize]}: ${rowValue[headerSize]}`, rowValue.__range])  
        }
      } else if (rowSize > headerSize + 1) {
        let msg = 1`Invalid table header, must be as long as all table cells (plus one additional options column):\n`;
        msg += `Table header: ${JSON.stringify(header)}\n`
        msg += `Mismatched row: ${JSON.stringify(rowValue)}`
        diagnostics.push(['error', msg, rowValue.__range])
        return -1
      } else if (rowSize < headerSize) {
        for (let i = 0; i < headerSize; i++) {
          if(i < rowSize) continue
          if(header[i] == 'nonFlexMaterials') continue // known problem
          diagnostics.push(['warning', `Row is missing argument ${i + 1}: ${header[i]}`, rowValue.__range])
        }
      }

      // Walk the table row
      let newRow = Object.assign({}, localOptions);
      utilsExt.excludedMagicKeys.forEach(key => {
        delete newRow[key];
      });

      // Check if inline options are provided, merge them then
      // Assuming `headerSize1` is the number of keys to skip
      const allKeys = Object.keys(rowValue).filter(key => !utilsExt.excludedMagicKeys.includes(key)); // Get all keys of the rowValue object
      const relevantKeys = allKeys.slice(headerSize1); // Get the keys after the first `headerSize1` keys

      // Iterate over the remaining keys
      for (const key of relevantKeys) {
        let value = rowValue[key];
        if (typeof value === 'object' && (!value.hasOwnProperty('__isarray') || !value.__isarray)  && allKeys.length > headerSize1) {
          Object.assign(newRow, replaceSpecialValues(value));
          // remove options from rowValue
          delete rowValue[key];
          header[key] = "options";
        }
      }
      //newRow.__astNodeIdx = rowValue.__astNodeIdx;

      // Now care about the rest
      const allKeys2 = Object.keys(rowValue).filter(key => !utilsExt.excludedMagicKeys.includes(key));
      //for (let [rk, _] of Object.entries(rowValue)) {
      for (let rk in allKeys2) {
        if (header[rk] === null) {
          let msg = `*** Unable to parse row, header for entry is missing: \n`
          msg += `*** Header: ${JSON.stringify(header)} missing key: ${rk} -- is the section header too short?\n`
          msg += `*** Row: ${JSON.stringify(rowValue)}`
          diagnostics.push(['error', msg, rowValue.__range])
        } else {
          newRow[header[rk]] = replaceSpecialValues(rowValue[rk]);
        }
      }
      if(rowValue.hasOwnProperty('__range')) {
        newRow.__range = rowValue.__range
      }
      if(rowValue.hasOwnProperty('__isarray')) {
        newRow.__isarray = rowValue.__isarray
      }

      if (newRow.hasOwnProperty('id') && newRow.id !== null) {
        newID = newRow.id
        //newRow.name = newRow.id // the original is to exchange with id
        //delete newRow.id
        
        // changed behavior for the editor below
        // in BeamNG, only name exists, id is deleted
        newRow.id = newRow.id
        newRow.name = newRow.id
        
        newRow.__isNamed = true
      }

      newList.__range = jbeamTable.__range
      newList.__isarray = jbeamTable.__isarray

      newList[newID] = newRow;
      newListSize++;
    }
  }

  //newList.__astNodeIdx = jbeamTable.__astNodeIdx;

  return newList;
}

function processPart(part, diagnostics) {
  part.maxIDs = {};
  part.validTables = {};
  part.beams = part.beams || {};

  // Walk everything and look for options
  part.options = part.options || {};
  for (let keyEntry in part) {
    if (!part.hasOwnProperty(keyEntry)) continue;

    let entry = part[keyEntry];
    if (typeof entry !== "object") {
      // seems to be an option, add it to the vehicle options
      part.options[keyEntry] = entry;
      delete part[keyEntry];
    }
  }

  // Walk all sections of the part
  let sectionNames = Object.keys(part)
  for (let sectionNameIdx in sectionNames) {
    let sectionName = sectionNames[sectionNameIdx]
    if (!part.hasOwnProperty(sectionName)) continue;

    let section = part[sectionName];

    // Verify key names to be properly formatted
    if (!/^[a-zA-Z_]+[a-zA-Z0-9_]*$/.test(sectionName)) {
      diagnostics.push(['error', `Invalid attribute name '${sectionName}'`, section.__range])
      return false
    }

    // Init max
    part.maxIDs[sectionName] = 0;

    if (typeof section === "object" && !ignoreSections[sectionName] && Object.keys(section).length > 0) {
      if(!section.hasOwnProperty('__isarray') || !section.__isarray) {
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
          node.pos = [node.posX, node.posZ, -node.posY] // FLIP!
        } catch (e) {
          diagnostics.push(['error', e.message, node.__range])
        }
      }
    }
  }

  return true;
}

function processAllParts(parsedData) {
  let tableInterpretedData = {}
  let diagnostics = [] // contains parsing errors and warnings
  const keys = Object.keys(parsedData).filter(key => key !== '__range' && key !== '__isarray')
  for (let partNameIdx in keys) {
    let partName = keys[partNameIdx]
    if (!parsedData.hasOwnProperty(partName)) continue;
    let part = parsedData[partName];
    let result = processPart(part, diagnostics);
      
    if (result !== true) {
      diagnostics.push(['error', `Unable to process part '${partName}'`, part.__range])
    }
    tableInterpretedData[partName] = part
  }
  return [tableInterpretedData, diagnostics]
}

module.exports = {
  processAllParts,
};