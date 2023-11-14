class SJSONException extends Error {
  constructor(message, range) {
    super(`${message} near ${range[0]}:${range[1]}`);
    this.range = range;
  }
}

function decodeSJSON(s) {
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
  function skipWhiteSpace() {
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
          let commentMeta = {type: 'comment', range: [lineNumber, columnNumber, 0, 0]}
          let comment = ''
          while (i < s.length && s[i] !== '\n') {
            comment += s[i]
            i++;
            columnNumber++;
          }
          commentMeta.range[2] = lineNumber
          commentMeta.range[3] = columnNumber
          commentMeta.comment = comment
          addMetadata(commentMeta)
          continue;
        } else if (s[i + 1] === '*') {
          // Multi-line comment
          i += 2; // Skip the '/*'
          columnNumber += 2;
          let commentMeta = {type: 'comment', range: [lineNumber, columnNumber, 0, 0]}
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
            addMetadata(commentMeta)
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

  function parseValue() {
    skipWhiteSpace();
    const ch = s[i];

    if (ch === '"') return readString();
    if (ch === '-' || (ch >= '0' && ch <= '9')) return readNumber();
    if (ch === 't') { i += 4; columnNumber += 4; return true; }
    if (ch === 'f') { i += 5; columnNumber += 5; return false; }
    if (ch === 'n') { i += 4; columnNumber += 4; return null; }

    if (ch === '{') return parseObject();
    if (ch === '[') return parseArray();

    jsonError('Unexpected character');
  }

  function parseArray() {
    const arr = {}
    let meta = {type: 'array', range: [lineNumber, columnNumber, 0, 0]}
    i++; // skip '['
    columnNumber++;
    skipWhiteSpace();
    let idx = 0
    while (s[i] !== ']') {

      let valueMeta = {type: 'value', range: [lineNumber, columnNumber, 0, 0]}
      const val = parseValue()
      arr[idx++] = val
      valueMeta.range[2] = lineNumber
      valueMeta.range[3] = columnNumber
      valueMeta.value = val
      addMetadata(valueMeta)

      skipWhiteSpace();
      if (s[i] === ',') {
        i++; // skip ','
        columnNumber++;
        skipWhiteSpace();
      }
    }
    i++; // skip ']'
    columnNumber++;
    meta.range[2] = lineNumber
    meta.range[3] = columnNumber
    meta.obj = arr
    arr.__meta = meta
    addMetadata(meta)
    return arr;
  }

  function parseObject() {
    const obj = {};
    let meta = {type: 'object', range: [lineNumber, columnNumber, 0, 0]}
    
    i++; // skip '{'
    columnNumber++;
    skipWhiteSpace();
    while (s[i] !== '}') {
      if (s[i] !== '"') jsonError('Expected key');

      let keyMeta = {type: 'key', range: [lineNumber, columnNumber, 0, 0]}
      const key = readString()
      keyMeta.range[2] = lineNumber
      keyMeta.range[3] = columnNumber
      keyMeta.value = key
      addMetadata(keyMeta)

      skipWhiteSpace();
      if (s[i] !== ':' && s[i] !== '=') jsonError('Expected ":" or "="');
      i++; // skip ':' or '='
      columnNumber++;

      let valueMeta = {type: 'value', range: [lineNumber, columnNumber, 0, 0]}
      const val = parseValue()
      obj[key] = val
      valueMeta.range[2] = lineNumber
      valueMeta.range[3] = columnNumber
      valueMeta.value = val
      addMetadata(valueMeta)

      skipWhiteSpace();
      if (s[i] === ',') {
        i++; // skip ','
        columnNumber++;
        skipWhiteSpace();
      }
    }
    i++; // skip '}'
    columnNumber++;
    meta.range[2] = lineNumber
    meta.range[3] = columnNumber
    meta.obj = obj
    obj.__meta = meta
    addMetadata(meta)
    return obj;
  }

  const values = parseValue()

  // create line cache
  let lineData = []
  for (const item of metaData) {
    const lineIndex = item.range[0]
    if (!lineData[lineIndex]) {
      lineData[lineIndex] = []
    }
    lineData[lineIndex].push(item)
  }

  return {values: values, metaData: metaData, lineData:lineData}
}

module.exports = {
  decodeSJSON
};