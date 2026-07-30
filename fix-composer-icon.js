const https = require('https')
const fs = require('fs')
const path = require('path')

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web'

function fetchGH(filePath) {
  return new Promise((resolve, reject) => {
    https.get(
      `https://raw.githubusercontent.com/amrinder6869-rgb/knot-web/master/${filePath}`,
      res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)) }
    ).on('error', reject)
  })
}

async function main() {
  let src = await fetchGH('components/Composer.tsx')

  // 1. Add ImageIcon to imports (lucide-react already used elsewhere in project)
  src = src.replace(
    `import { useState, useRef, useEffect } from 'react'`,
    `import { useState, useRef, useEffect } from 'react'
import { ImageIcon } from 'lucide-react'`
  )

  // 2. Replace the P button content with the icon
  //    Remove fontWeight: 700 and fontSize: 14 since those were for the text letter
  src = src.replace(
    `              style={{ width: 38, height: 38, borderRadius: 8, background: momentPhoto ? 'var(--yellow-soft)' : 'var(--bg3)', border: \`1px solid \${momentPhoto ? 'var(--yellow)' : 'var(--border2)'}\`, color: momentPhoto ? 'var(--yellow)' : 'var(--text3)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit' }}
              title="Add photo or video">
              P
            </button>`,
    `              style={{ width: 38, height: 38, borderRadius: 8, background: momentPhoto ? 'var(--yellow-soft)' : 'var(--bg3)', border: \`1px solid \${momentPhoto ? 'var(--yellow)' : 'var(--border2)'}\`, color: momentPhoto ? 'var(--yellow)' : 'var(--text3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit' }}
              title="Add photo or video">
              <ImageIcon size={16} strokeWidth={2} />
            </button>`
  )

  fs.writeFileSync(path.join(BASE, 'components', 'Composer.tsx'), src, 'utf8')
  console.log('Done. Run: npm run build')
}

main().catch(console.error)
