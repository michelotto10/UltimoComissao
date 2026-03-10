const fs = require('fs');
const path = 'app/(protected)/pais';
try {
  const files = fs.readdirSync(path);
  const out = files.map(f => {
    const codes = [...f].map(c => c.charCodeAt(0));
    return { name: f, codes };
  });
  fs.writeFileSync('pais-listing.json', JSON.stringify(out, null, 2));
  console.log('written pais-listing.json');
} catch (e) {
  fs.writeFileSync('pais-listing.json', JSON.stringify({ error: e.message }));
}
