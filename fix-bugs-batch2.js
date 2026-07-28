const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web';

function patch(relPath, pairs, label) {
  const full = path.join(BASE, relPath);
  if (!fs.existsSync(full)) { console.log('SKIP: ' + relPath + ' not found'); return; }
  let content = fs.readFileSync(full, 'utf8');
  let changed = false;
  pairs.forEach(([from, to]) => {
    if (content.includes(from)) { content = content.split(from).join(to); changed = true; }
  });
  if (changed) { fs.writeFileSync(full, content, 'utf8'); console.log('Fixed: ' + label); }
  else { console.log('SKIP: ' + label + ' (no matches)'); }
}

// ─── FIX 1: Composer \u escapes in JSX text ──────────────────────────────────
// These are inside template literals in JS so they ARE fine - they render correctly
// The \u00B7 and \u2014 inside backtick strings work correctly in JS
// Only an issue if they appear as literal text in JSX outside of JS expressions
// Check: the Composer lines are all inside template literals so they are fine
console.log('Composer \\u escapes are inside JS template literals - they render correctly, no fix needed.');

// ─── FIX 2: MostLikelyTo mojibake Â· → · ────────────────────────────────────
patch('components/MostLikelyTo.tsx', [
  ['Â·', '\u00B7'],
  ['\u00C2\u00B7', '\u00B7'],
], 'MostLikelyTo mojibake fixed');

// ─── FIX 3: Invite page — rewrite the corrupted emoji and text lines ──────────
// The invite page has severe UTF-8 corruption. We need to rewrite the corrupted lines.
const invitePath = path.join(BASE, 'app\\invite\\[token]\\page.tsx');
if (fs.existsSync(invitePath)) {
  let content = fs.readFileSync(invitePath, 'utf8');

  // Replace corrupted emojis and text
  const replacements = [
    // Corrupted emojis → use String.fromCodePoint for Windows safety
    ['Ã¢ÂÅ\'', String.fromCodePoint(0x1F517)],  // 🔗
    ['Ã¢ÂÂ±Ã¯Â¸Â', String.fromCodePoint(0x2753) + String.fromCodePoint(0xFE0F)], // ❓
    ['Ã°Å¸â€â€™', String.fromCodePoint(0x1F389)], // 🎉
    ['Ã°Å¸â€Â', String.fromCodePoint(0x1F512)],  // 🔒
    ['Ã°Å¸Å½â€°', String.fromCodePoint(0x1F64F)], // 🙏
    // Corrupted em dash and middle dot
    ['Ã¢â‚¬â€', '\u2014'],
    ['Ã‚Â·', '\u00B7'],
    ['Â·', '\u00B7'],
    ['â€"', '\u2014'],
    ['â€"', '\u2014'],
  ];

  let changed = false;
  replacements.forEach(([from, to]) => {
    if (content.includes(from)) { content = content.split(from).join(to); changed = true; }
  });

  if (changed) {
    fs.writeFileSync(invitePath, content, 'utf8');
    console.log('Fixed: invite page mojibake characters replaced');
  } else {
    console.log('SKIP: invite page (no mojibake patterns found - may already be clean)');
  }
} else {
  console.log('SKIP: invite page not found');
}

// ─── FIX 4: Check and fix other files with \u literal escape in JSX ──────────
// BillSplit, Memories, RewardsShop, Tetris/Snake game over
const filesToCheck = [
  'components/BillSplitForm.tsx',
  'components/RewardsShop.tsx',
  'components/Memories.tsx',
];

filesToCheck.forEach(f => {
  const full = path.join(BASE, f);
  if (!fs.existsSync(full)) return;
  let content = fs.readFileSync(full, 'utf8');
  let changed = false;

  // Only fix literal \u in JSX text content (outside JS expressions)
  // Pattern: >text \u00B7 text< or >text \u2014 text<
  // These render as literal backslash-u text in the browser
  const lines = content.split('\n');
  const fixed = lines.map(line => {
    // If line has \u outside of template literals/JS (i.e. in JSX text between tags)
    if (line.includes('\\u00B7') && !line.includes('`') && !line.includes('//')) {
      changed = true;
      return line.split('\\u00B7').join('\u00B7');
    }
    if (line.includes('\\u2014') && !line.includes('`') && !line.includes('//')) {
      changed = true;
      return line.split('\\u2014').join('\u2014');
    }
    return line;
  });

  if (changed) {
    fs.writeFileSync(full, fixed.join('\n'), 'utf8');
    console.log('Fixed: ' + f + ' literal \\u escapes in JSX text');
  }
});

// ─── FIX 5: Games files ───────────────────────────────────────────────────────
const gameFiles = ['components/AmongUsLite.tsx', 'components/Tetris.tsx', 'components/Snake.tsx'];
gameFiles.forEach(f => {
  const full = path.join(BASE, f);
  if (!fs.existsSync(full)) return;
  let content = fs.readFileSync(full, 'utf8');
  let changed = false;

  if (content.includes('\\u2014') && !content.includes('`\\u2014`')) {
    content = content.split("'Game over \\u2014").join("'Game over \u2014");
    content = content.split('"Game over \\u2014').join('"Game over \u2014');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(full, content, 'utf8');
    console.log('Fixed: ' + f + ' game over string');
  }
});

console.log('\nBatch 2 complete.');
