const fs = require('fs');
const path = require('path');

const filePath = path.join('C:\\Users\\amrin\\Documents\\knot-web\\components\\CrewSection.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace the roles fetch block with a version that logs everything
const oldRoles = `      const { data: roles } = await supabase
        .from('hangout_member_roles')
        .select('user_id, role')
        .eq('hangout_id', hangoutId)

      const roleMap: Record<string, HangoutRoleType[]> = {}
      roles?.forEach((r: any) => {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = []
        roleMap[r.user_id].push(r.role as HangoutRoleType)
      })`;

const newRoles = `      const { data: roles, error: rolesError } = await supabase
        .from('hangout_member_roles')
        .select('user_id, role')
        .eq('hangout_id', hangoutId)

      console.log('Roles query hangoutId:', hangoutId)
      console.log('Roles data:', roles)
      console.log('Roles error:', rolesError)

      const roleMap: Record<string, HangoutRoleType[]> = {}
      roles?.forEach((r: any) => {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = []
        roleMap[r.user_id].push(r.role as HangoutRoleType)
      })`;

if (content.includes(oldRoles)) {
  content = content.replace(oldRoles, newRoles);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Debug logging added to roles query.');
} else {
  console.log('ERROR: Could not find roles query block. No changes made.');
}
