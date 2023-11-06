class SJSONException extends Error {
  constructor(message, position, line, snippet) {
    super(`${message} near line ${line}, '${snippet}'`);
    this.position = position;
    this.line = line;
    this.snippet = snippet;
  }
}

function decodeSJSON(s) {
  let lineNumber = 0;
  let columnNumber = 0;

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
    throw new SJSONException(msg, columnNumber, lineNumber, '');
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
          while (i < s.length && s[i] !== '\n') {
            i++;
            columnNumber++;
          }
          continue;
        } else if (s[i + 1] === '*') {
          // Multi-line comment
          i += 2; // Skip the '/*'
          columnNumber += 2;
          while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) {
            if (s[i] === '\n') {
              lineNumber++; // Increment line number inside multi-line comment
              columnNumber = 0
              //console.log('3Line: ', lineNumber, s.substring(lastNewline + 1, i))
              lastNewline = i
            }
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
    const arr = {};
    i++; // skip '['
    columnNumber++;
    skipWhiteSpace();
    let startLineNo = lineNumber + 1
    let startCol = columnNumber
    arr.__isarray = true
    let idx = 0
    while (s[i] !== ']') {
      arr[idx++] = parseValue();
      skipWhiteSpace();
      if (s[i] === ',') {
        i++; // skip ','
        columnNumber++;
        skipWhiteSpace();
      }
    }
    i++; // skip ']'
    columnNumber++;
    arr.__range = [startLineNo, startCol, lineNumber + 1, columnNumber]
    return arr;
  }

  function parseObject() {
    const obj = {};
    i++; // skip '{'
    columnNumber++;
    skipWhiteSpace();
    let startLineNo = lineNumber + 1
    let startCol = columnNumber    
    while (s[i] !== '}') {
      if (s[i] !== '"') jsonError('Expected key');
      const key = readString();
      skipWhiteSpace();
      if (s[i] !== ':' && s[i] !== '=') jsonError('Expected ":" or "="');
      i++; // skip ':' or '='
      columnNumber++;
      obj[key] = parseValue();
      skipWhiteSpace();
      if (s[i] === ',') {
        i++; // skip ','
        columnNumber++;
        skipWhiteSpace();
      }
    }
    i++; // skip '}'
    columnNumber++;
    obj.__range = [startLineNo, startCol, lineNumber + 1, columnNumber]
    return obj;
  }

  return parseValue();
}

module.exports = {
  decodeSJSON
};