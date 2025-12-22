@echo off
echo Setting up environment variables...
echo.
echo Please run the deployment first with: npm run deploy
echo Then copy the contract addresses from the output and update this file.
echo.
echo Current configuration:
echo RPC_URL=http://127.0.0.1:8545
echo.
echo After deployment, manually set these environment variables:
echo set MNEE_TOKEN_ADDRESS=^<address from deployment^>
echo set ESCROW_CONTRACT_ADDRESS=^<address from deployment^>
echo.
echo Or create a .env file with the addresses.
pause
