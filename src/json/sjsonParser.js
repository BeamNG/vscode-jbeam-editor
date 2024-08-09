/*
  File: sjsonParser.js

  Description:
  This JavaScript module provides functionality for parsing and decoding structured JSON (SJSON) data with metadata.
  It includes error handling, data structure creation, and metadata extraction capabilities.

  Classes and Functions:
  - `SJSONException`: Custom error class for SJSON parsing errors.
  - `rangeInRange`: Checks if one range is completely contained within another.
  - `cursorInRange`: Checks if a cursor position is within a given range.
  - `getMetaForCurBundle`: Retrieves metadata for a specified line and position.
  - `getPreviousMeta`: Retrieves metadata for the previous entry.
  - `decodeWithMeta`: Parses SJSON data with metadata and returns a data bundle.

*/

/*
  Function: `decodeWithMeta`

  Description:
  Parses structured JSON (SJSON) data with metadata and returns a data bundle. It handles error checking, data structure creation, and metadata extraction.

  Parameters:
  - `s`: The SJSON data to parse.
  - `origin`: The origin or source of the SJSON data.

  Returns:
  An object containing the following properties:
  - `data`: The parsed SJSON data.
  - `errors`: An array of parsing errors, if any.
  - `warnings`: An array of parsing warnings, if any.
  - `metaData`: An array of metadata entries associated with the parsed data.
  - `lineData`: A cache of metadata entries indexed by line number for quick access.

  Example Usage:

  const sjsonData = '{ "name": "John", "age": 30 }';
const origin = 'sample.json';
const result = decodeWithMeta(sjsonData, origin);

console.log(result.data); // Output: { name: 'John', age: 30 }
console.log(result.errors); // Output: []
console.log(result.metaData); // Output: [{ type: 'object', range: [1, 1, 1, 24], ... }]

  Notes: This function is designed to handle SJSON data with metadata, allowing for advanced parsing and analysis.
*/
const vscode = require('vscode');

class SJSONException extends Error {
  constructor(message, range) {
    super(`${message} near ${range[0]}:${range[1]}`);
    this.range = range;
  }
}


// range is [lineStart, colStart, lineEnd, colEnd]
function rangeInRange(range1, range2) {
  // Check if range1 starts after or on the same line as range2 and ends before or on the same line as range2
  return (range1 && range2 &&
    range1[0] >= range2[0] &&
    range1[2] <= range2[2] &&
    range1[1] >= range2[1] &&
    range1[3] <= range2[3]
  )
}

// range is [lineStart, colStart, lineEnd, colEnd]
function cursorInRange(line, position, range) {
  // Check if the line is within the range
  if (line < range[0] || line > range[2]) {
    return false;
  }

  // If it's the starting line, check if the character position is after the start
  if (line === range[0] && position < range[1]) {
    return false;
  }

  // If it's the ending line, check if the character position is before the end
  if (line === range[2] && position > range[3]) {
    return false;
  }
  return true
}

function getMetaForCurBundle(dataBundle, line, position) {
  let lineData = dataBundle.lineData

  if (!lineData || line < 0 || position < 0) {
    // Invalid input or line/position out of range
    return []
  }
  if (line >= lineData.length || !lineData[line] || line < 0) {
    // No metadata for the specified line
    return []
  }
  // Filter metadata entries within the specified line and position range
  const metaDataForLine = lineData[line].filter(item =>
    cursorInRange(line, position, item.range)
  )
  metaDataForLine.sort((a, b) => {
    return b.depth - a.depth
  })
  return metaDataForLine;
}

function getMetaForCurAnyData(data, line, position, documentUri, breadcrumbCategory, ignoreBreadHeadCounter = 0) {
  let breadcrumbTrail = []; // Array to keep track of the breadcrumb trail

  // Helper function to recursively search the object and add breadcrumbs to __meta
  function recursiveSearch(data, currentDepth) {
    if (!data) return [];

    const result = [];

    if (data.__meta && cursorInRange(line, position, data.__meta.range)) {
      // Add breadcrumb to the existing __meta object
      if (!data.__meta.breadcrumbs) {
        data.__meta.breadcrumbs = {}
        data.__meta.breadcrumbsPlainText = {}
        data.__meta.breadcrumbsMarkdown = {}
      }
      if (!data.__meta.breadcrumbs[breadcrumbCategory]) {
        data.__meta.breadcrumbs[breadcrumbCategory] = []
      }

      data.__meta.breadcrumbs[breadcrumbCategory].push(...breadcrumbTrail);
      data.__meta.breadcrumbsPlainText[breadcrumbCategory] = data.__meta.breadcrumbs[breadcrumbCategory]
        .slice(ignoreBreadHeadCounter)
        .filter(item => !(item.value.__meta && item.value.__meta.isNamed))
        .map(item => item.key)
        .join(' > ');

      data.__meta.breadcrumbsMarkdown[breadcrumbCategory] = data.__meta.breadcrumbs[breadcrumbCategory]
        .map(item => {
          const commandId = 'jbeam-editor.gotoLine';
          let args = {
            range: item.value.__meta.range,
            uri: documentUri
          };
          let encodedArgs = encodeURIComponent(JSON.stringify(args));
          return `[${item.key}](command:${commandId}?${encodedArgs} "Goto")`;
        }).join(' > ');

      result.push(data.__meta);

      // Iterate over the properties of the object to go deeper into the tree
      for (const key in data) {
        if (key === '__meta') continue; // Skip __meta property

        if (data.hasOwnProperty(key)) {
          const value = data[key]

          if (typeof value === 'object' && value !== null && value.__meta) {
            // Add the current object to the breadcrumb trail before going deeper
            breadcrumbTrail.push({ key: key, value: value });
            const childResult = recursiveSearch(value, currentDepth + 1);
            result.push(...childResult);
            // Pop the current object from the breadcrumb trail as we backtrack
            breadcrumbTrail.pop();
          }
        }
      }
    }
    return result;
  }

  const metaDataForLine = recursiveSearch(data, 0);

  metaDataForLine.sort((a, b) => {
    return b.depth - a.depth;
  });

  return metaDataForLine;
}

function getPreviousMeta(dataBundle, meta) {
  if(!dataBundle.metaData || !meta || meta.id <= 0 || !dataBundle.metaData[meta.id - 1]) return null
  return dataBundle.metaData[meta.id - 1]
}

const helperFunctions = {
  rangeInRange,
  cursorInRange,
  getMetaForCurBundle,
  getMetaForCurAnyData,
  getPreviousMeta,
}

// cyclicDependencies enables .obj, .parent, etc in __meta
function decodeWithMeta(s, origin, cyclicDependencies = true) {
  let lineNumber = 0
  let columnNumber = 0
  let errors = []
  let warnings = []
  let abortExecution = false
  let metaData = []

  const escapes = {
    't': '\t',
    'n': '\n',
    'f': '\f',
    'r': '\r',
    'b': '\b',
    '"': '"',
    '\\': '\\',
    '\n': '\n',
    '9': '\t',
    '0': '\r'
  };

  let i = 0;

  function jsonError(msg, startLineNumber=lineNumber, startColumnNumber=columnNumber, endLineNumber=lineNumber, endColumnNumber=columnNumber) {
    errors.push({message: msg, range:[startLineNumber, startColumnNumber, endLineNumber, endColumnNumber]})
    abortExecution = true
  }

  function jsonWarning(msg, startLineNumber=lineNumber, startColumnNumber=columnNumber, endLineNumber=lineNumber, endColumnNumber=columnNumber) {
    warnings.push({message: msg, range:[startLineNumber, startColumnNumber, endLineNumber, endColumnNumber]})
  }

  function addMetadata(data) {
    metaData.push(data)
    data.id = metaData.length - 1
  }

  let lastNewline = 0
  function skipWhiteSpace(depth) {
    while (i < s.length && !abortExecution) {
      if (s[i] === '\n') {
        // Increment line number on newline
        lineNumber++;
        //console.log('1Line: ', lineNumber, s.substring(lastNewline + 1, i))
        lastNewline = i
        i++;
        columnNumber = 0
        continue;
      }
      if (s[i] <= ' ' || s[i] === ',') {
        i++;
        columnNumber++;
        continue;
      }
      if (s[i] === '/') {
        if (s[i + 1] === '/') {
          // Single-line comment
          i += 2; // Skip '//' characters
          columnNumber += 2;
          let commentMeta = {type: 'comment', range: [lineNumber, columnNumber, 0, 0], depth: depth}
          addMetadata(commentMeta)
          let comment = ''
          while (i < s.length && s[i] !== '\n' && !abortExecution) {
            if(s[i] !== '\r') {
              comment += s[i]
            }
            i++;
            columnNumber++;
          }
          commentMeta.range[2] = lineNumber
          commentMeta.range[3] = columnNumber
          commentMeta.comment = comment
          continue;
        } else if (s[i + 1] === '*') {
          // Multi-line comment
          i += 2; // Skip the '/*'
          columnNumber += 2;
          let commentMeta = {type: 'comment', range: [lineNumber, columnNumber, 0, 0], depth: depth}
          addMetadata(commentMeta)
          let comment = ''
          while (i < s.length && !(s[i] === '*' && s[i + 1] === '/') && !abortExecution) {
            if(s[i] !== '\r') {
              comment += s[i]
            }
            if (s[i] === '\n') {
              lineNumber++; // Increment line number inside multi-line comment
              columnNumber = 0
              //console.log('3Line: ', lineNumber, s.substring(lastNewline + 1, i))
              lastNewline = i
            }
            commentMeta.range[2] = lineNumber
            commentMeta.range[3] = columnNumber
            commentMeta.comment = comment
            i++;
            columnNumber++;
          }
          if (i >= s.length) {
            jsonError('Unterminated comment')
            return
          }
          i += 2; // Skip the '*/'
          columnNumber+=2;
          continue;
        } else {
          jsonError('Invalid comment')
          return
        }
      }
      break; // If it's not whitespace, a comment or a newline, break the loop
    }
  }

  function readString() {
    // TODO: Add support for escape characters and unicode
    let result = '';
    i++; // Skip the initial quote
    columnNumber++;
    while (i < s.length && s[i] !== '"' && !abortExecution) {
      const ch = s[i];
      if (ch === '\\') {
        const esc = escapes[s[i + 1]];
        if (esc) {
          result += esc;
          i++;
          columnNumber++;
        } else {
          result += '\\';
        }
      } else {
        result += ch;
      }
      i++;
      columnNumber++;
    }
    i++; // Skip the ending quote
    columnNumber++;
    return result;
  }

  function readNumber() {
    let numberMatch = s.substring(i).match(/^[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?/);
    if (!numberMatch) {
      jsonError('Invalid number')
      return
    }
    let numberStr = numberMatch[0]
    i += numberStr.length
    columnNumber += numberStr.length
    return Number(numberStr)
  }

  function parseValue(parentMeta, depth) {
    skipWhiteSpace(depth)
    const ch = s[i];

    if (ch === '"') return readString();
    if (ch === '-' || ch === '+' || (ch >= '0' && ch <= '9')) return readNumber()
    if (ch === 't') { i += 4; columnNumber += 4; return true }
    if (ch === 'f') { i += 5; columnNumber += 5; return false }
    if (ch === 'n') { i += 4; columnNumber += 4; return null }

    if (ch === '{') return parseObject(parentMeta, depth)
    if (ch === '[') return parseArray(parentMeta, depth)

    jsonError('Unexpected character')
  }

  function parseArray(parentMeta, depth) {
    const arr = {}
    let meta = {type: 'array', range: [lineNumber, columnNumber, 0, 0], depth: depth}
    if(cyclicDependencies) {
      meta.parent = parentMeta
    }
    addMetadata(meta)
    i++; // skip '['
    columnNumber++;
    depth++
    skipWhiteSpace(depth)
    let idx = 0
    while (s[i] !== ']' && !abortExecution) {

      let valueMeta = {type: 'value', range: [lineNumber, columnNumber, 0, 0], depth: depth}
      if(cyclicDependencies) {
        valueMeta.parent = meta
      }
      addMetadata(valueMeta)

      const val = parseValue(meta, depth + 1)
      arr[idx++] = val
      valueMeta.range[2] = lineNumber
      valueMeta.range[3] = columnNumber
      valueMeta.value = val

      skipWhiteSpace(depth)
      if (s[i] === ',') {
        i++; // skip ','
        columnNumber++;
        skipWhiteSpace(depth)
      }
    }
    i++; // skip ']'
    columnNumber++;
    meta.range[2] = lineNumber
    meta.range[3] = columnNumber
    if(cyclicDependencies) {
      meta.obj = arr
    }
    arr.__meta = meta
    return arr;
  }

  function parseObject(parentMeta, depth, isOuterMostObject = false) {
    const obj = {};
    let meta = {type: 'object', range: [lineNumber, columnNumber, 0, 0], depth: depth}
    if(cyclicDependencies) {
      meta.parent = parentMeta
    }
    addMetadata(meta)

    if (!isOuterMostObject) {
      i++; // skip '{'
    }
    columnNumber++;
    depth++
    skipWhiteSpace(depth)
    while ((isOuterMostObject && i < s.length) || (!isOuterMostObject && s[i] !== '}' && !abortExecution)) {
      if (s[i] !== '"') {
        jsonError('Expected key')
        return
      }

      let keyMeta = {type: 'key', range: [lineNumber, columnNumber, 0, 0], depth: depth}
      if(cyclicDependencies) {
        keyMeta.parent = meta
      }
      const startLineNumber = lineNumber, startColumnNumber = columnNumber
      const key = readString()
      if (key in obj) {
        jsonWarning('Duplicate key', startLineNumber, startColumnNumber)
      }
      keyMeta.range[2] = lineNumber
      keyMeta.range[3] = columnNumber
      keyMeta.value = key
      addMetadata(keyMeta)

      skipWhiteSpace(depth)

      let metaSep = {type: 'objSeparator', range: [lineNumber, columnNumber, 0, 0], depth: depth}
      if(cyclicDependencies) {
        metaSep.parent = meta
        metaSep.key = keyMeta
      }
      addMetadata(metaSep)

      if (s[i] !== ':' && s[i] !== '=') {
        jsonError('Expected ":" or "="')
        return
      }
      i++; // skip ':' or '='
      columnNumber++;

      metaSep.range[2] = lineNumber
      metaSep.range[3] = columnNumber

      let valueMeta = {type: 'value', range: [lineNumber, columnNumber, 0, 0], depth: depth}
      if(cyclicDependencies) {
        valueMeta.parent = meta
        valueMeta.key = keyMeta
      }
      const val = parseValue(meta, depth + 1)
      obj[key] = val
      valueMeta.range[2] = lineNumber
      valueMeta.range[3] = columnNumber
      valueMeta.value = val
      addMetadata(valueMeta)

      skipWhiteSpace(depth)
      if (s[i] === ',') {
        i++; // skip ','
        columnNumber++;
        skipWhiteSpace(depth)
      }
    }
    i++; // skip '}'
    columnNumber++;
    meta.range[2] = lineNumber
    meta.range[3] = columnNumber
    if(cyclicDependencies) {
      meta.obj = obj
    }
    obj.__meta = meta
    return obj;
  }

  skipWhiteSpace(0)
  const values = (s[i] == '{' || s[i] == '[') ? parseValue(null, 0) : parseObject(null, 0, true)

  // create line cache
  let lineData = []
  for (const item of metaData) {
    for (let lineIndex = item.range[0]; lineIndex <= item.range[2]; lineIndex++) {
      if (!lineData[lineIndex]) {
        lineData[lineIndex] = []
      }
      lineData[lineIndex].push(item)
    }
  }

  if(metaData.length > 0) {
    metaData[0].origin = origin
  }


  // return dataBundle
  return {
    // data
    data: values,
    errors: errors,
    warnings: warnings,
    metaData: metaData,
    lineData: lineData,

    ...helperFunctions
  }
}

function decodeWithMetaWithDiagnostics(contentTextUtf8, filename, cyclicDependencies = true) {
  let dataBundle
  let diagnosticsList = []
  let errorsExist = false
  try {
    dataBundle = decodeWithMeta(contentTextUtf8, filename, cyclicDependencies);
  } catch (e) {
    const pos = new vscode.Position(
      e.range ? e.range[0] : e.line ? e.line : 0,
      e.range ? e.range[1] : e.column ? e.column : 0
    )
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(pos, pos),
      `Json parsing exception: ${e.message}`,
      vscode.DiagnosticSeverity.Error
    );
    diagnosticsList.push(diagnostic);
    errorsExist = true
  }
  if (dataBundle) {
    if(dataBundle.errors && dataBundle.errors.length > 0) {
      for(let e of dataBundle.errors) {
        const startPos = new vscode.Position(
          e.range ? e.range[0] : e.line ? e.line : 0,
          e.range ? e.range[1] : e.column ? e.column : 0
        )
        const endPos = new vscode.Position(
          e.range ? e.range[2] : e.line ? e.line : 0,
          e.range ? e.range[3] : e.column ? e.column : 0
        )
        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(startPos, endPos),
          `Json error: ${e.message}`,
          vscode.DiagnosticSeverity.Error
        );
        diagnosticsList.push(diagnostic);
        errorsExist = true
      }
    }
    if(dataBundle.warnings && dataBundle.warnings.length > 0) {
      for(let w of dataBundle.warnings) {
        const startPos = new vscode.Position(
          w.range ? w.range[0] : w.line ? w.line : 0,
          w.range ? w.range[1] : w.column ? w.column : 0
        )
        const endPos = new vscode.Position(
          w.range ? w.range[2] : w.line ? w.line : 0,
          w.range ? w.range[3] : w.column ? w.column : 0
        )
        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(startPos, endPos),
          `Json warning: ${w.message}`,
          vscode.DiagnosticSeverity.Warning
        );
        diagnosticsList.push(diagnostic);
      }
    }
  }

  dataBundle.diagnosticsList = diagnosticsList
  dataBundle.errorsExist = errorsExist
  return dataBundle
}


module.exports = {
  decodeWithMeta,
  decodeWithMetaWithDiagnostics,
  ...helperFunctions,
}