const fs = require('fs')
const lines = fs.readFileSync('components/Composer.tsx', 'utf8').split('\n')

lines[54] = `  const [whereMode, setWhereMode]         = useState<'none' | 'tbd' | 'discover' | 'manual' | 'home'>('none')`

fs.writeFileSync('components/Composer.tsx', lines.join('\n'), 'utf8')
console.log('Done. Line 55 updated.')
console.log('New value:', lines[54])
