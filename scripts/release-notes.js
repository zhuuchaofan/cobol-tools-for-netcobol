#!/usr/bin/env node
// Prints the CHANGELOG.md section for a version (default: package.json version).
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const version = process.argv[2] || require(path.join(root, 'package.json')).version;
const lines = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8').split(/\r?\n/);
const start = lines.findIndex((l) => l.trim() === `## ${version}`);
if (start < 0) {
  console.error(`CHANGELOG.md has no "## ${version}" section`);
  process.exit(1);
}
let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
if (end < 0) end = lines.length;
console.log(lines.slice(start + 1, end).join('\n').trim());
