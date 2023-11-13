/*
# Function Documentation: `findObjectsWithRange`

## Overview

`findObjectsWithRange` is a function designed to find and return objects within a specified hierarchical structure that fall within a certain range. The function is capable of identifying objects at various depths that span a specified line and position within a document.

## Parameters

- `obj`: The root object of the hierarchical structure to be searched. It should be an object containing nested objects with `__range` properties.
- `line`: The line number (1-indexed) within the document to search for matching objects.
- `position`: The character position (1-indexed) on the line to use for finding a match.
- `uri`: The URI of the document being searched, used for creating clickable links in the resulting breadcrumb trail.

## Returns

The function returns an array of objects, each representing a match. Each object in the array includes:

- `obj`: The original object that matched the search criteria.
- `breadcrumbMarkdown`: A string representing the breadcrumb trail to the object in Markdown format, which provides clickable navigation in certain editors.
- `breadcrumbPlainText`: A string representing the breadcrumb trail to the object in plain text format.

## Behavior

- The function recursively searches the entire hierarchical structure of the provided `obj` parameter.
- It generates a breadcrumb trail that reflects the path taken through the object hierarchy to reach each matched object.
- Matches are determined based on the `__range` property, which is expected to be an array of four numbers that specify the start line, start position, end line, and end position.
- The results are sorted by the depth of the match in descending order (deepest first).

## Special Notes

- The `__range` property is expected to be structured as follows: `[startLine, startPosition, endLine, endPosition]`.
- The line and position parameters for searching are 1-indexed, matching typical document editor indexing.
- The function internally uses zero-based indexing to interact with the editor's command system.
- The breadcrumbMarkdown uses a custom editor command `jbeam-editor.gotoLine` which is meant to be integrated with an editor that supports this functionality.

## Usage Example

```javascript
const utilsExt = require('./utilsExt');
let hierarchicalObject = {
  //... (object with __range properties and nested structure)
};
let line = 5;
let position = 10;
let documentUri = 'file:///path/to/document';

let matches = utilsExt.findObjectsWithRange(hierarchicalObject, line, position, documentUri);
console.log(matches);
```
*/
function findObjectsWithRange(obj, line, position, uri) {
  let matches = [];
  let breadcrumbTrail = []; // Array to keep track of the breadcrumb trail

  // Helper function to recursively search the object
  function search(obj, currentDepth) {
    if (obj.__range &&
        line >= obj.__range[0] && line <= obj.__range[2] &&
        (line !== obj.__range[0] || position >= obj.__range[1]) &&
        (line !== obj.__range[2] || position <= obj.__range[3])) {
      matches.push({
        obj: obj,
        depth: currentDepth,
        breadcrumb: breadcrumbTrail.map(b => ({ name: b.name, __isNamed: b.__isNamed, __range: b.__range }))
      });
    }

    // Iterate over the properties of the object to go deeper into the tree
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        if (typeof value === 'object' && value !== null && value.__range) {
          // Add the current object to the breadcrumb trail before going deeper
          breadcrumbTrail.push({ name: key, __isNamed: value.__isNamed, __range: value.__range });
          search(value, currentDepth + 1);
          // Pop the current object from the breadcrumb trail as we backtrack
          breadcrumbTrail.pop();
        }
      }
    }
  }

  search(obj, 0);

  // Sort matches by depth descending (deepest first)
  matches.sort((a, b) => b.depth - a.depth);

  // Map the results to include a clickable breadcrumb trail
  return matches.map(match => {
    let breadcrumbMarkdown = match.breadcrumb.map(breadcrumbPart => {
      let commandId = 'jbeam-editor.gotoLine';
      // Adjust the range for zero-based indexing in the editor
      let args = {
        range: breadcrumbPart.__range,
        uri: uri
      };
      let encodedArgs = encodeURIComponent(JSON.stringify(args));
      return `[${breadcrumbPart.name}](command:${commandId}?${encodedArgs} "Goto")`;
    }).join(' > ');
  
    // Create a plain text breadcrumb trail, ignoring the first element and any array indices
    let breadcrumbPlainText = match.breadcrumb
      .slice(1) // This skips the first element
      .filter(breadcrumbPart => breadcrumbPart.__isNamed !== true && isNaN(breadcrumbPart.name)) // This filters out any parts that are numbers (array indices)
      .map(breadcrumbPart => breadcrumbPart.name)
      .join(' > ');

    return {
      obj: match.obj,
      breadcrumbMarkdown: breadcrumbMarkdown, // Markdown links for each breadcrumb part
      breadcrumbPlainText: breadcrumbPlainText // Plain text for each breadcrumb part
    };
  });
}

function convertUri(vscode, webPanel, filePath) {
  const uri = vscode.Uri.file(filePath);
  const webviewUri = webPanel.webview.asWebviewUri(uri);
  return webviewUri.toString()
}

const excludedMagicKeys = ['__range', '__isarray', '__isNamed', '__source'];

module.exports = {
  excludedMagicKeys,
  findObjectsWithRange,
  convertUri,
}
