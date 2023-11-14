class SJSONException extends Error {
  constructor(message, range) {
    super(`${message} near ${range[0]}:${range[1]}`);
    this.range = range;
  }
}

function decodeWithMeta(s) {
  let lineNumber = 0
  let columnNumber = 0
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

  function jsonError(msg) {
    throw new SJSONException(msg, [lineNumber, columnNumber, lineNumber, columnNumber])
  }

  function addMetadata(data) {
    metaData.push(data)
    data.id = metaData.length - 1
  }

  let lastNewline = 0
  function skipWhiteSpace(depth) {
    while (i < s.length) {
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
          while (i < s.length && s[i] !== '\n') {
            comment += s[i]
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
          while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) {
            comment += s[i]
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
            jsonError('Unterminated comment');
          }
          i += 2; // Skip the '*/'
          columnNumber+=2;
          continue;
        } else {
          jsonError('Invalid comment');
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
    while (i < s.length && s[i] !== '"') {
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
    let numberMatch = s.substring(i).match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/);
    if (!numberMatch) jsonError('Invalid number');
    let numberStr = numberMatch[0];
    i += numberStr.length;
    columnNumber += numberStr.length
    return Number(numberStr);
  }

  function parseValue(parentMeta, depth) {
    skipWhiteSpace(depth)
    const ch = s[i];

    if (ch === '"') return readString();
    if (ch === '-' || (ch >= '0' && ch <= '9')) return readNumber();
    if (ch === 't') { i += 4; columnNumber += 4; return true; }
    if (ch === 'f') { i += 5; columnNumber += 5; return false; }
    if (ch === 'n') { i += 4; columnNumber += 4; return null; }

    if (ch === '{') return parseObject(parentMeta, depth);
    if (ch === '[') return parseArray(parentMeta, depth);

    jsonError('Unexpected character');
  }

  function parseArray(parentMeta, depth) {
    const arr = {}
    let meta = {type: 'array', range: [lineNumber, columnNumber, 0, 0], parent: parentMeta, depth: depth}
    addMetadata(meta)
    i++; // skip '['
    columnNumber++;
    depth++
    skipWhiteSpace(depth)
    let idx = 0
    while (s[i] !== ']') {

      let valueMeta = {type: 'value', range: [lineNumber, columnNumber, 0, 0], parent: meta, depth: depth}
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
    meta.obj = arr
    arr.__meta = meta
    return arr;
  }

  function parseObject(parentMeta, depth) {
    const obj = {};
    let meta = {type: 'object', range: [lineNumber, columnNumber, 0, 0], parent: parentMeta, depth: depth}
    addMetadata(meta)

    i++; // skip '{'
    columnNumber++;
    depth++
    skipWhiteSpace(depth)
    while (s[i] !== '}') {
      if (s[i] !== '"') jsonError('Expected key');

      let keyMeta = {type: 'key', range: [lineNumber, columnNumber, 0, 0], parent: meta, depth: depth}
      const key = readString()
      keyMeta.range[2] = lineNumber
      keyMeta.range[3] = columnNumber
      keyMeta.value = key
      addMetadata(keyMeta)

      skipWhiteSpace(depth)

      let metaSep = {type: 'objSeparator', range: [lineNumber, columnNumber, 0, 0], parent: meta, previousKey: keyMeta, depth: depth}
      addMetadata(metaSep)
      
      if (s[i] !== ':' && s[i] !== '=') jsonError('Expected ":" or "="');
      i++; // skip ':' or '='
      columnNumber++;
      
      metaSep.range[2] = lineNumber
      metaSep.range[3] = columnNumber

      let valueMeta = {type: 'value', range: [lineNumber, columnNumber, 0, 0], parentMeta: meta, depth: depth}
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
    meta.obj = obj
    obj.__meta = meta
    return obj;
  }

  const values = parseValue(null, 0)

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
      if (line === range[2] && position >= range[3]) {
        return false;
      }
      return true
    }

    function getMetaForCur(line, position) {
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
  
  return {
    // data
    data: values,
    metaData: metaData,
    lineData: lineData,

    //helpers
    cursorInRange: cursorInRange,
    rangeInRange: rangeInRange,
    getMetaForCur: getMetaForCur,

  }
}

function decodeSJSON() {

}

module.exports = {
  decodeWithMeta,
  decodeSJSON,
}