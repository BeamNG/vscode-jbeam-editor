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
};

const excludedKeys = ['__range', '__isarray'];


function replaceSpecialValues(val) {
  return val;
}

function processTableWithSchemaDestructive(jbeamTable, inputOptions, omitWarnings) {
  // Its a list, so verify that the first row is the header
  let header = jbeamTable[0];
  if (typeof header !== "object" || !header.hasOwnProperty('__isarray') || !header.__isarray) {
    if (!omitWarnings) {
      console.warn(`*** Invalid table header: ${JSON.stringify(header, null, 2)}`);
    }
    return -1;
  }

  if (!header.hasOwnProperty('__isarray') || !header.__isarray) {
    if (!omitWarnings) {
      console.warn(`*** Invalid table header, must be a list, not a dict: ${JSON.stringify(header)}`);
    }
    return -1;
  }

  let headerSize = Object.keys(header).filter(key => !excludedKeys.includes(key)).length;
  let headerSize1 = headerSize;
  let newListSize = 0;
  let newList = {}
  let localOptions = replaceSpecialValues(Object.assign({}, inputOptions)) || {};

  // Remove the header from the data, as we don't need it anymore
  //jbeamTable.shift();
  delete jbeamTable[0];

  // Walk the list entries
  let newRowId = 0
  let keys = Object.keys(jbeamTable).filter(key => !excludedKeys.includes(key))
  for (const rowKey of keys) {
    let rowValue = jbeamTable[rowKey];
    if (typeof rowValue !== "object") {
      console.warn(`*** Invalid table row: ${JSON.stringify(rowValue)}`);
      return -1;
    }
    //console.log(">>>>", rowValue, rowValue.__isarray)
    if (!rowValue.hasOwnProperty('__isarray') || !rowValue.__isarray) {
      // Case where options is a dict on its own, filling a whole line
      Object.assign(localOptions, replaceSpecialValues(rowValue));
      //localOptions.__astNodeIdx = null;
    } else {
      let newID = newRowId++

      const rowSize = Object.keys(rowValue).filter(key => !excludedKeys.includes(key)).length
      if (rowSize > headerSize + 1) {
        if (!omitWarnings) {
          console.warn(`*** Invalid table header, must be as long as all table cells (plus one additional options column):`);
          console.warn(`*** Table header: ${JSON.stringify(header)}`);
          console.warn(`*** Mismatched row: ${JSON.stringify(rowValue)}`);
        }
        return -1;
      }

      // Walk the table row
      let newRow = Object.assign({}, localOptions);
      excludedKeys.forEach(key => {
        delete newRow[key];
      });

      // Check if inline options are provided, merge them then
      // Assuming `headerSize1` is the number of keys to skip
      const allKeys = Object.keys(rowValue).filter(key => !excludedKeys.includes(key)); // Get all keys of the rowValue object
      const relevantKeys = allKeys.slice(headerSize1); // Get the keys after the first `headerSize1` keys

      // Iterate over the remaining keys
      for (const key of relevantKeys) {
        let value = rowValue[key];
        if (typeof value === 'object' && (!value.hasOwnProperty('__isarray') || !value.__isarray)  && allKeys.length > headerSize1) {
          Object.assign(newRow, replaceSpecialValues(value));
          rowValue[key] = null;
          header[key] = "options";
        }
      }
      //newRow.__astNodeIdx = rowValue.__astNodeIdx;

      // Now care about the rest
      const allKeys2 = Object.keys(rowValue).filter(key => !excludedKeys.includes(key));
      //for (let [rk, _] of Object.entries(rowValue)) {
      for (let rk in allKeys2) {
        //console.log('KEYY:::', rk)
        if (header[rk] === null) {
          console.error(`*** Unable to parse row, header for entry is missing: `);
          console.error(`*** Header: ${JSON.stringify(header)} missing key: ${rk} -- is the section header too short?`);
          console.error(`*** Row: ${JSON.stringify(rowValue)}`);
        } else {
          //console.log('@@@@@@@', rk, header[rk], rowValue, rowValue[rk])
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
        newID = newRow.id;
        newRow.name = newRow.id;
        newRow.id = null;
      }

      newList[newID] = newRow;
      newListSize++;
    }
  }

  //newList.__astNodeIdx = jbeamTable.__astNodeIdx;

  return newList;
}

function processPart(part, processSlotsTable, omitWarnings) {
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
      console.error(`*** Invalid attribute name '${sectionName}'`);
      return false;
    }

    // Init max
    part.maxIDs[sectionName] = 0;

    if (typeof section === "object" && !ignoreSections[sectionName] && Object.keys(section).length > 0) {
      if(!section.hasOwnProperty('__isarray') || !section.__isarray) {
        // section dictionaries to be written
      } else {
        if (sectionName === 'slots' && !processSlotsTable) {
          part.validTables[sectionName] = true;
        } else {
          if (!part.validTables[sectionName]) {
            let newList = processTableWithSchemaDestructive(section, part.options, omitWarnings);

            if (newList.length > 0) {
              part.validTables[sectionName] = true;
            }
            part[sectionName] = newList;
          }
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
          console.error(e.message)
        }
      }
      //console.log(node)
    }
  }

  return true;
}

module.exports = {
  processPart
};