const fs = require('fs');
const files = ['js/app.js', 'js/attendance_logger.js', 'js/supabase_client.js'];
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const m = content.match(/(localStorage|sessionStorage)\.(getItem|setItem)\([^)]+\)/g) || [];
  console.log(f, [...new Set(m)]);
});
