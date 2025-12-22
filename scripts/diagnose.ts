
import { ethers } from "hardhat";
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
    const mneeAddr = process.env.MNEE_TOKEN_ADDRESS;
    const escrowAddr = process.env.ESCROW_CONTRACT_ADDRESS;

    console.log(`Checking MNEE at: ${mneeAddr}`);
    const code1 = await ethers.provider.getCode(mneeAddr!);
    console.log(`MNEE Code Length: ${code1.length}`);
    if (code1 === '0x') console.error('CRITICAL: MNEE is NOT a contract!');

    console.log(`Checking Escrow at: ${escrowAddr}`);
    const code2 = await ethers.provider.getCode(escrowAddr!);
    console.log(`Escrow Code Length: ${code2.length}`);
    if (code2 === '0x') console.error('CRITICAL: Escrow is NOT a contract!');
}

main().catch(console.error);
