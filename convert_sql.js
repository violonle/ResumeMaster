const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'init_db.sql');
const outputPath = path.join(__dirname, 'mysql_init_db.sql');

let content = fs.readFileSync(inputPath, 'utf8');

// 1. Basic cleaning
content = content.replace(/^PRAGMA.*;\n/gm, '');
content = content.replace(/^BEGIN TRANSACTION;\n/gm, 'SET FOREIGN_KEY_CHECKS = 0;\n');
content = content.replace(/^COMMIT;\n/gm, 'SET FOREIGN_KEY_CHECKS = 1;\n');
content = content.replace(/^DELETE FROM sqlite_sequence;\n/gm, '');
content = content.replace(/^INSERT INTO sqlite_sequence.*\n/gm, '');

// 2. Table definitions
// Replace INTEGER PRIMARY KEY AUTOINCREMENT with INT AUTO_INCREMENT PRIMARY KEY
content = content.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'INT AUTO_INCREMENT PRIMARY KEY');

// Handle VARCHAR and other types (MySQL defaults are usually fine)
// SQLite uses double quotes or backticks for identifiers. MySQL likes backticks.
// The current dump uses backticks, which is good.

// 3. Fix BOOLEAN/TINYINT defaults
content = content.replace(/DEFAULT '0'/g, "DEFAULT 0");
content = content.replace(/DEFAULT '1'/g, "DEFAULT 1");

// 3.1 Fix TEXT with DEFAULT values (MySQL 8.0 limitation)
// Replace TEXT with VARCHAR(255) when it has a DEFAULT value
content = content.replace(/`(\w+)` TEXT DEFAULT\s+('[^']*'|\S+)/g, '`$1` VARCHAR(255) DEFAULT $2');
content = content.replace(/`(\w+)` JSON DEFAULT\s+('[^']*'|\S+)/g, '`$1` JSON'); // JSON columns cannot have DEFAULT values in MySQL 8.0 either

// 4. Fix JSON strings if needed (MySQL handles them as strings anyway during INSERT)

// 5. Fix DATETIME strings
// SQLite: '2026-01-27 03:00:31.389 +00:00'
// MySQL: '2026-01-27 03:00:31' (Standard)
// We'll strip the fractional seconds and timezone for maximum compatibility if they exist
content = content.replace(/'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\.\d+ \+00:00'/g, "'$1'");

// 6. Handle specific table name issues (if any)
// Ensure tables are dropped if they exist for a clean import
const tableNames = content.match(/CREATE TABLE `(\w+)`/g);
if (tableNames) {
    const dropStatements = tableNames.map(t => t.replace('CREATE TABLE', 'DROP TABLE IF EXISTS') + ';').join('\n');
    content = 'SET NAMES utf8mb4;\n' + dropStatements + '\n\n' + content;
}

fs.writeFileSync(outputPath, content);
console.log('Successfully converted init_db.sql to mysql_init_db.sql');
