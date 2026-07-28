const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\Composer.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the declaration: const [suggestions, setSuggestions2] -> const [groupSuggestions, setGroupSuggestions]
content = content.replace(
  `const [suggestions, setSuggestions2]    = useState<any>(null)`,
  `const [groupSuggestions, setGroupSuggestions] = useState<any>(null)`
);

// Fix the setter call
content = content.replace(
  `.then(data => { if (data.hasHistory) setSuggestions2(data) })`,
  `.then(data => { if (data.hasHistory) setGroupSuggestions(data) })`
);

// Fix all JSX references
content = content.split('suggestions2').join('groupSuggestions');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed. All references now use groupSuggestions.');
