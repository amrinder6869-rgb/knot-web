const fs = require('fs')

let composer = fs.readFileSync('components/Composer.tsx', 'utf8')

// Fix the useState call type annotation which still has the old type
composer = composer.replace(
  `const [whereMode, setWhereMode] = useState<'none' | 'discover' | 'manual' | 'home'>('none')`,
  `const [whereMode, setWhereMode] = useState<'none' | 'tbd' | 'discover' | 'manual' | 'home'>('none')`
)

fs.writeFileSync('components/Composer.tsx', composer, 'utf8')
console.log('Done. WhereMode type fixed.')
