import * as dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

async function test() {
    console.log('Testing contract deployment...\n');

    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
    const mneeAddress = process.env.MNEE_TOKEN_ADDRESS;
    const escrowAddress = process.env.ESCROW_CONTRACT_ADDRESS;

    console.log('MNEE Token Address:', mneeAddress);
    console.log('Escrow Contract Address:', escrowAddress);

    if (!mneeAddress || !escrowAddress) {
        console.error('Contract addresses not set in .env');
        process.exit(1);
    }

    // Check if contracts exist
    const mneeCode = await provider.getCode(mneeAddress);
    const escrowCode = await provider.getCode(escrowAddress);

    console.log('\nMNEE contract deployed:', mneeCode !== '0x');
    console.log('Escrow contract deployed:', escrowCode !== '0x');

    // Try to get balance
    const mneeAbi = ['function balanceOf(address) view returns (uint256)', 'function name() view returns (string)'];
    const mnee = new ethers.Contract(mneeAddress, mneeAbi, provider);

    try {
        const name = await mnee.name();
        console.log('\nMNEE Token Name:', name);

        const testAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
        const balance = await mnee.balanceOf(testAddress);
        console.log('Test address balance:', ethers.formatEther(balance), 'MNEE');

        console.log('\n✅ Contracts are working correctly!');
    } catch (error: any) {
        console.error('\n❌ Error calling contract:', error.message);
    }
}

test();
