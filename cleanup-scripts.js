const fs = require('fs')

const toDelete = [
  'diag-composer.js',
  'diag-hangoutcard.js',
  'fix-composer-compression.js',
  'fix-hangoutcard-compression.js',
  'fix-memories-compression.js',
  'fix-memories-compression-v2.js',
  'fix-memories-compression-v3.js',
  'fix-memories-compression-final.js',
  'fix-postcomments-compression.js',
  'fix-moment-photo.js',
  'fix-composer-discover.js',
  'fix-wheretype.js',
  'check-wheretype.js',
  'fix-line55.js',
  'fix-suggestionsref.js',
  'fix-autocomplete-type.js',
  'fix-autocomplete-bias.js',
  'fix-autocomplete-ip.js',
  'fix-autocomplete-gps.js',
  'fix-discover-automount.js',
  'fix-discover-ref.js',
  'fix-posthangout.js',
  'fix-postorder.js',
  'fix-encoding.js',
  'check-encoding.js',
  'fix-hangout-callsite.js',
  'fix-bills-callsite.js',
  'fix-typescript-any.js',
  'fix-media-comments.js',
  'fix-media-comments-v2.js',
  'install-phase2.js',
  'install-hangoutcard.js',
  'install-datepicker.js',
  'install-autocomplete.js',
  'install-tonight.js',
  'install-bills.js',
  'install-h1.js',
  'install-compression.js',
  'install-post-interactions.js',
  'compressImage.ts',
  'HangoutCard.tsx',
  'Composer.tsx',
  'Feed.tsx',
  'Hangout.tsx',
  'BillSplit.tsx',
  'DateTimePicker.tsx',
  'PostComments.tsx',
  'hangoutBundle.ts',
  'autocomplete-route.ts',
]

let deleted = 0
for (const f of toDelete) {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f)
    deleted++
  }
}
console.log(`Deleted ${deleted} throwaway file(s) from repo root.`)
console.log('Your actual app files in components/, lib/, app/ are untouched.')
