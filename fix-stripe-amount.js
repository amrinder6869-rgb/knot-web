const fs = require('fs');
const path = require('path');

// Fix dollar signs in PreOrderCard
const preOrderPath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\PreOrderCard.tsx');
let preOrder = fs.readFileSync(preOrderPath, 'utf8');

preOrder = preOrder
  .replace(/\$\$\{parseFloat\(item\.price\)\.toFixed\(2\)\}/g, '${parseFloat(item.price).toFixed(2)}')
  .replace(/\$\$\{myTotal\.toFixed\(2\)\}/g, '${myTotal.toFixed(2)}')
  .replace(/Pay \$\$\{amount\.toFixed\(2\)\}/g, 'Pay ${amount.toFixed(2)}');

fs.writeFileSync(preOrderPath, preOrder, 'utf8');
console.log('Fixed dollar signs in PreOrderCard');

// Fix Stripe API route minimum amount check
// The issue: amount < 50 treats dollars as cents. $14.99 passes but 
// the real issue is the error shows on render, not on payment attempt.
// The error state is persisting from a previous failed call.
// Fix: clear error on mount and fix the minimum check to 0.50 dollars
const apiPath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\app\\api\\stripe\\create-payment-intent\\route.ts');
let api = fs.readFileSync(apiPath, 'utf8');

// Fix: minimum is $0.50 = 50 cents, amount is in dollars so check > 0.50
api = api.replace(
  `if (!amount || amount < 50) return NextResponse.json({ error: 'Minimum amount is $0.50' }, { status: 400 })`,
  `if (!amount || amount < 0.5) return NextResponse.json({ error: 'Minimum amount is $0.50' }, { status: 400 })`
);

fs.writeFileSync(apiPath, api, 'utf8');
console.log('Fixed Stripe minimum amount check (was comparing dollars to 50 cents)');
