const fs = require('fs');

fs.writeFileSync("test.txt", "Hello, sitemap generator works!", "utf8");
console.log("✅ test.txt created");
