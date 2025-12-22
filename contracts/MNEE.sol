// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MNEE
 * @dev MNEE Stablecoin - ERC20 token for agent-to-agent payments
 */
contract MNEE is ERC20, Ownable {
    
    constructor() ERC20("MNEE Stablecoin", "MNEE") Ownable(msg.sender) {
        // Mint initial supply to deployer (10 million MNEE)
        _mint(msg.sender, 10_000_000 * 10**decimals());
    }

    /**
     * @dev Mint new MNEE tokens (for testing purposes)
     * @param to Address to receive minted tokens
     * @param amount Amount to mint (in wei)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Burn MNEE tokens
     * @param amount Amount to burn (in wei)
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
