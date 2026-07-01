const fs = require('fs')
const path = require('path')

// Install the component
fs.copyFileSync('DateTimePicker.tsx', path.join('components', 'DateTimePicker.tsx'))
console.log('Installed: components/DateTimePicker.tsx')

// Patch Composer.tsx
let composer = fs.readFileSync('components/Composer.tsx', 'utf8')

// Add import
composer = composer.replace(
  `import Discover from '@/components/Discover'`,
  `import Discover from '@/components/Discover'
import DateTimePicker from '@/components/DateTimePicker'`
)

// Replace scheduledFor string state with Date state
composer = composer.replace(
  `  const [scheduledFor, setScheduledFor]   = useState('')`,
  `  const [scheduledFor, setScheduledFor]   = useState<Date | null>(null)`
)

// Replace the datetime-local input with the custom picker
composer = composer.replace(
  `            {whenType === 'pick' && (
              <input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginTop: 8 }} />
            )}`,
  `            {whenType === 'pick' && (
              <div style={{ marginTop: 8 }}>
                <DateTimePicker
                  value={scheduledFor}
                  onChange={date => setScheduledFor(date)}
                  minDate={new Date()}
                />
              </div>
            )}`
)

// Fix postHangout to use Date object instead of string
composer = composer.replace(
  `    } else if (whenType === 'pick') {
      startTime = scheduledFor ? new Date(scheduledFor).toISOString() : null`,
  `    } else if (whenType === 'pick') {
      startTime = scheduledFor ? scheduledFor.toISOString() : null`
)

// Fix reset to use null instead of empty string
composer = composer.replace(
  `    setScheduledFor('')`,
  `    setScheduledFor(null)`
)

fs.writeFileSync('components/Composer.tsx', composer, 'utf8')
console.log('Patched: components/Composer.tsx')
console.log('\nRun: npm run build')
