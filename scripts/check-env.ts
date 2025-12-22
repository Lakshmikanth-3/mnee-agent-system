
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('--- ENV CHECK ---');
console.log(`MNEE_TOKEN_ADDRESS: '${process.env.MNEE_TOKEN_ADDRESS}'`);
console.log(`ESCROW_CONTRACT_ADDRESS: '${process.env.ESCROW_CONTRACT_ADDRESS}'`);
console.log('-----------------');
