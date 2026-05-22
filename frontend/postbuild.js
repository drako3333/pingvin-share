const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, 'public', 'sw.js');

if (fs.existsSync(swPath)) {
  let content = fs.readFileSync(swPath, 'utf8');
  if (!content.includes("importScripts('/sw-push.js')")) {
    content += "\nimportScripts('/sw-push.js');\n";
    fs.writeFileSync(swPath, content, 'utf8');
    console.log('Successfully appended push notification listener to sw.js!');
  } else {
    console.log('Push notification listener already present in sw.js.');
  }
} else {
  console.error('sw.js not found in public folder!');
}
