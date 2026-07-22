const fs = require('fs')
const lines = fs.readFileSync('components/Memories.tsx', 'utf8').split('\n')

// Print lines 160-200 (0-indexed 159-199) so we act only on confirmed content
console.log('--- Current lines 160-200 ---')
for (let i = 159; i < 200; i++) console.log((i+1) + ': ' + lines[i])
