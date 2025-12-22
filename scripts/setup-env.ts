import * as fs from 'fs';
import * as path from 'path';

// Read deployment output and create .env file
const envExample = fs.readFileSync('.env.example', 'utf-8');

// For now, just copy the example
// In production, this would parse deployment logs
fs.writeFileSync('.env', envExample);

console.log('.env file created from .env.example');
console.log('Please update MNEE_TOKEN_ADDRESS and ESCROW_CONTRACT_ADDRESS after deployment');
