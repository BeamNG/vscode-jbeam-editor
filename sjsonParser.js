class SJSONException extends Error {
  constructor(message, position, line, snippet) {
    super(`${message} near line ${line}, '${snippet}'`);
    this.position = position;
    this.line = line;
    this.snippet = snippet;
  }
}

function decodeSJSON(s) {
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
    throw new SJSONException(msg, i, 0, ''); // Adjust to give correct line and snippet
  }

  function skipWhiteSpace() {
    while (i < s.length && (s[i] <= ' ' || s[i] === ',')) i++;
    if (s[i] === '/') {
      if (s[i + 1] === '/') {
        // Single line comment
        while (i < s.length && s[i] !== '\n') i++;
        skipWhiteSpace();
      } else if (s[i + 1] === '*') {
        // Multi line comment
        i += 2; // Move past the '/*'
        while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++;
        if (i >= s.length) jsonError('Unterminated comment');
        i += 2; // Move past the '*/'
        skipWhiteSpace();
      } else {
        jsonError('Invalid comment');
      }
    }
  }

  function readString() {
    // TODO: Add support for escape characters and unicode
    let result = '';
    i++; // Skip the initial quote
    while (i < s.length && s[i] !== '"') {
      const ch = s[i];
      if (ch === '\\') {
        const esc = escapes[s[i + 1]];
        if (esc) {
          result += esc;
          i++;
        } else {
          result += '\\';
        }
      } else {
        result += ch;
      }
      i++;
    }
    i++; // Skip the ending quote
    return result;
  }

  function readNumber() {
    let numberMatch = s.substring(i).match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/);
    if (!numberMatch) jsonError('Invalid number');
    let numberStr = numberMatch[0];
    i += numberStr.length;
    return Number(numberStr);
  }

  function parseValue() {
    skipWhiteSpace();
    const ch = s[i];

    if (ch === '"') return readString();
    if (ch === '-' || (ch >= '0' && ch <= '9')) return readNumber();
    if (ch === 't') { i += 4; return true; }
    if (ch === 'f') { i += 5; return false; }
    if (ch === 'n') { i += 4; return null; }

    if (ch === '{') return parseObject();
    if (ch === '[') return parseArray();

    jsonError('Unexpected character');
  }

  function parseArray() {
    const arr = [];
    i++; // skip '['
    skipWhiteSpace();
    while (s[i] !== ']') {
      arr.push(parseValue());
      skipWhiteSpace();
      if (s[i] === ',') {
        i++; // skip ','
        skipWhiteSpace();
      }
    }
    i++; // skip ']'
    return arr;
  }

  function parseObject() {
    const obj = {};
    i++; // skip '{'
    skipWhiteSpace();
    while (s[i] !== '}') {
      if (s[i] !== '"') jsonError('Expected key');
      const key = readString();
      skipWhiteSpace();
      if (s[i] !== ':' && s[i] !== '=') jsonError('Expected ":" or "="');
      i++; // skip ':' or '='
      obj[key] = parseValue();
      skipWhiteSpace();
      if (s[i] === ',') {
        i++; // skip ','
        skipWhiteSpace();
      }
    }
    i++; // skip '}'
    return obj;
  }

  return parseValue();
}

module.exports = {
  decodeSJSON
};