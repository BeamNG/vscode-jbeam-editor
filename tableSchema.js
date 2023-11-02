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

function replaceSpecialValues(val) {
  let typeval = typeof val;
  if (typeval === "object" && !Array.isArray(val)) {
  // Recursive replace
  for (let k in val) {
    val[k] = replaceSpecialValues(val[k]);
  }
  return val;
  }
  if (typeval !== "string") {
  // Only replace strings
  return val;
  }

  if (specialVals[val]) return specialVals[val];

  if (val.includes('|')) {
  let parts = val.split("|");
  let ival = 0;
  for (let i = 1; i < parts.length; i++) {
    let valuePart = parts[i];
    // Is it a node material?
    if (valuePart.startsWith("NM_")) {
    ival = particles.getMaterialIDByName(materials, valuePart.substring(3));
    }
    ival = ival | (typeIds[valuePart] || 0);
  }
  return ival;
  }
  return val;
}

function processTableWithSchemaDestructive(jbeamTable, inputOptions, omitWarnings) {
  // Its a list, so verify that the first row is the header
  let header = jbeamTable[0];
  if (typeof header !== "object" || !Array.isArray(header)) {
    if (!omitWarnings) {
      console.warn(`*** Invalid table header: ${JSON.stringify(header, null, 2)}`);
    }
    return -1;
  }

  if (!Array.isArray(header)) {
    if (!omitWarnings) {
      console.warn(`*** Invalid table header, must be a list, not a dict: ${JSON.stringify(header)}`);
    }
    return -1;
  }

  let headerSize = header.length;
  let headerSize1 = headerSize + 1;
  let newListSize = 0;
  let newList = []
  let localOptions = replaceSpecialValues(Object.assign({}, inputOptions)) || {};

  // Remove the header from the data, as we don't need it anymore
  jbeamTable.shift();

  // Walk the list entries
  for (let [rowKey, rowValue] of jbeamTable.entries()) {
    if (typeof rowValue !== "object") {
      console.warn(`*** Invalid table row: ${JSON.stringify(rowValue)}`);
      return -1;
    }
    if (!Array.isArray(rowValue)) {
      // Case where options is a dict on its own, filling a whole line
      Object.assign(localOptions, replaceSpecialValues(rowValue));
      localOptions.__astNodeIdx = null;
    } else {
      let newID = rowKey
      if (rowValue.length > headerSize + 1) {
        if (!omitWarnings) {
          console.warn(`*** Invalid table header, must be as long as all table cells (plus one additional options column):`);
          console.warn(`*** Table header: ${JSON.stringify(header)}`);
          console.warn(`*** Mismatched row: ${JSON.stringify(rowValue)}`);
        }
        return -1;
      }

      // Walk the table row
      let newRow = Object.assign({}, localOptions);

      // Check if inline options are provided, merge them then
      for (let rk = headerSize1; rk < rowValue.length; rk++) {
        let rv = rowValue[rk];
        if (typeof rv === 'object' && !Array.isArray(rv) && rowValue.length > headerSize) {
          Object.assign(newRow, replaceSpecialValues(rv));
          rowValue[rk] = null;
          header[rk] = "options";
        }
      }
      newRow.__astNodeIdx = rowValue.__astNodeIdx;

      // Now care about the rest
      for (let rk in rowValue) {
        if (!header[rk]) {
          console.error(`*** Unable to parse row, header for entry is missing: `);
          console.error(`*** Header: ${JSON.stringify(header)} missing key: ${rk} -- is the section header too short?`);
          console.error(`*** Row: ${JSON.stringify(rowValue)}`);
        } else {
          newRow[header[rk]] = replaceSpecialValues(rowValue[rk]);
        }
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

  newList.__astNodeIdx = jbeamTable.__astNodeIdx;

  return newList;
}

function process(vehicle, processSlotsTable, omitWarnings) {
  vehicle.maxIDs = {};
  vehicle.validTables = {};
  vehicle.beams = vehicle.beams || {};

  // Walk everything and look for options
  vehicle.options = vehicle.options || {};
  for (let keyEntry in vehicle) {
    if (!vehicle.hasOwnProperty(keyEntry)) continue;

    let entry = vehicle[keyEntry];
    if (typeof entry !== "object") {
      // seems to be an option, add it to the vehicle options
      vehicle.options[keyEntry] = entry;
      delete vehicle[keyEntry];
    }
  }

  // Walk all entries of the vehicle
  for (let keyEntry in vehicle) {
    if (!vehicle.hasOwnProperty(keyEntry)) continue;

    let entry = vehicle[keyEntry];

    // Verify key names to be properly formatted
    if (!/^[a-zA-Z_]+[a-zA-Z0-9_]*$/.test(keyEntry)) {
      console.error(`*** Invalid attribute name '${keyEntry}'`);
      return false;
    }

    // Init max
    vehicle.maxIDs[keyEntry] = 0;

    if (typeof entry === "object" && !ignoreSections[keyEntry] && Object.keys(entry).length > 0) {
      if (entry.constructor === Object) {
        // Entry dictionaries to be written
      } else {
        if (keyEntry === 'slots' && !processSlotsTable) {
          vehicle.validTables[keyEntry] = true;
        } else {
          if (!vehicle.validTables[keyEntry]) {
            let newList = processTableWithSchemaDestructive(entry, vehicle.options, omitWarnings);

            if (newList.length > 0) {
              vehicle.validTables[keyEntry] = true;
            }
            vehicle[keyEntry] = newList;
          }
        }
      }
    }
  }

  // now custom, advanced processing ...
  if (vehicle.hasOwnProperty('nodes')) {
    for (let nodeId in vehicle.nodes) {
      let node = vehicle.nodes[nodeId];
      try {
        node.pos = [node.posX, node.posY, node.posZ]
      } catch (e) {
      }
      //console.log(node)
    }
  }

  return true;
}

module.exports = {
  process
};