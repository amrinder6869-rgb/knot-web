const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\amrin\\Documents\\knot-web\\components';

const files = ['CrewSection.tsx', 'RoleAssignSheet.tsx'];

files.forEach(filename => {
  const filePath = path.join(BASE, filename);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace the createClient import with the direct supabase import
  content = content.replace(
    `import { createClient } from '@/lib/supabase/client'`,
    `import { supabase } from '@/lib/supabase'`
  );

  // Replace all usage of createClient() with supabase directly
  content = content.replace(/const supabase = createClient\(\)\n/g, '');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed: ${filename}`);
});

console.log('\nDone. Supabase import path corrected in both files.');
