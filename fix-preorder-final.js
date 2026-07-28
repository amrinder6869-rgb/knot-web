const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\PreOrderCard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Print all lines with $$ to see exactly what remains
const lines = content.split('\n');
let found = false;
lines.forEach((line, i) => {
  if (line.includes('$$')) {
    console.log(`Line ${i + 1}: ${line.trim()}`);
    found = true;
  }
});

if (!found) {
  console.log('No $$ found in PreOrderCard. The issue may be a cache. Try restarting npm run dev.');
  process.exit(0);
}

// Replace all remaining $$ with single $
// Use a character-by-character approach to avoid regex issues
let fixed = '';
for (let i = 0; i < content.length; i++) {
  if (content[i] === '$' && content[i+1] === '$' && content[i+2] !== '{') {
    // $$ not followed by { — this is a display issue, skip one $
    fixed += '$';
    i++; // skip the second $
  } else {
    fixed += content[i];
  }
}

fs.writeFileSync(filePath, fixed, 'utf8');
console.log('\nFixed remaining $$ occurrences.');

// Fix the unique constraint issue: change insert to upsert in createOrGetOrder
let updated = fs.readFileSync(filePath, 'utf8');

updated = updated.replace(
  `const { data, error } = await supabase
      .from('hangout_orders')
      .insert({ hangout_id: hangout.id, merchant_id: merchant.id, knot_id: knotId, status: 'open' })
      .select()
      .single()`,
  `const { data, error } = await supabase
      .from('hangout_orders')
      .upsert({ hangout_id: hangout.id, merchant_id: merchant.id, knot_id: knotId, status: 'open' }, { onConflict: 'hangout_id' })
      .select()
      .single()`
);

fs.writeFileSync(filePath, updated, 'utf8');
console.log('Fixed: order insert now uses upsert to handle existing orders.');
