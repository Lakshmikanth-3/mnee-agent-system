import { ethers } from "hardhat";

async function main() {
    console.log("Deploying MNEE token and Escrow contracts...");

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // Deploy or use existing MNEE token
    let mneeAddress = process.env.MNEE_TOKEN_ADDRESS;
    let mnee: any;

    let needsDeployment = true;
    if (mneeAddress && mneeAddress.startsWith('0x') && mneeAddress.length === 42) {
        const code = await ethers.provider.getCode(mneeAddress);
        if (code !== '0x') {
            console.log("Using existing MNEE token at:", mneeAddress);
            mnee = await ethers.getContractAt("MNEE", mneeAddress);
            needsDeployment = false;
        } else {
            console.log(`No code found at ${mneeAddress}. A new token must be deployed for local network.`);
        }
    }

    if (needsDeployment) {
        console.log("Deploying new MNEE token...");
        const MNEE = await ethers.getContractFactory("MNEE");
        mnee = await MNEE.deploy();
        await mnee.waitForDeployment();
        mneeAddress = await mnee.getAddress();
        console.log("MNEE token deployed to:", mneeAddress);
    }

    // Deploy Escrow contract
    const MNEEEscrow = await ethers.getContractFactory("MNEEEscrow");
    const escrow = await MNEEEscrow.deploy(mneeAddress as string);
    await escrow.waitForDeployment();
    const escrowAddress = await escrow.getAddress();
    console.log("MNEEEscrow contract deployed to:", escrowAddress);

    // Get agent accounts (using Hardhat's default accounts)
    const accounts = await ethers.getSigners();
    const startupAgent = accounts[0];
    const researchAgent = accounts[1];
    const escrowAgent = accounts[2];
    const budgetAgent = accounts[3];
    const auditorAgent = accounts[4];
    const judgeAgent = accounts[5];
    const dashboardAgent = accounts[6];

    console.log("\nAgent Addresses:");
    console.log("StartupAgent:", startupAgent.address);
    console.log("ResearchAgent:", researchAgent.address);
    console.log("EscrowAgent:", escrowAgent.address);
    console.log("BudgetAgent:", budgetAgent.address);
    console.log("DashboardAgent:", dashboardAgent.address);

    // Distribute MNEE tokens to agents
    const initialBalance = ethers.parseEther("10000"); // 10,000 MNEE each

    console.log("\nDistributing MNEE tokens to agents...");
    await mnee.transfer(startupAgent.address, initialBalance);
    await mnee.transfer(researchAgent.address, initialBalance);
    await mnee.transfer(escrowAgent.address, initialBalance);
    await mnee.transfer(budgetAgent.address, initialBalance);
    await mnee.transfer(auditorAgent.address, initialBalance);
    await mnee.transfer(judgeAgent.address, initialBalance);
    await mnee.transfer(dashboardAgent.address, initialBalance);

    console.log("Tokens distributed successfully!");

    // Grant agent roles to escrow contract
    console.log("\nGranting system roles...");
    await escrow.grantAgentRole(escrowAgent.address);
    await escrow.grantAgentRole(startupAgent.address);
    // JudgeAgent gets the JUDGE_ROLE
    await escrow.grantJudgeRole(judgeAgent.address);
    console.log("System roles (Agent & Judge) granted!");

    console.log("\n=== Deployment Summary ===");
    console.log("MNEE Token:", mneeAddress);
    console.log("Escrow Contract:", escrowAddress);

    // Update .env file
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '../.env');

    let envContent = '';
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Replace or append MNEE_TOKEN_ADDRESS
    const mneeRegex = /^MNEE_TOKEN_ADDRESS=.*$/m;
    if (mneeRegex.test(envContent)) {
        envContent = envContent.replace(mneeRegex, `MNEE_TOKEN_ADDRESS=${mneeAddress}`);
    } else {
        envContent += `\nMNEE_TOKEN_ADDRESS=${mneeAddress}`;
    }

    // Replace or append ESCROW_CONTRACT_ADDRESS
    const escrowRegex = /^ESCROW_CONTRACT_ADDRESS=.*$/m;
    if (escrowRegex.test(envContent)) {
        envContent = envContent.replace(escrowRegex, `ESCROW_CONTRACT_ADDRESS=${escrowAddress}`);
    } else {
        envContent += `\nESCROW_CONTRACT_ADDRESS=${escrowAddress}`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log("\n✅ .env file automatically updated!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
