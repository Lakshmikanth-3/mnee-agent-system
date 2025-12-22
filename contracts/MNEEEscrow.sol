// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title MNEEEscrow
 * @dev Escrow contract for trustless agent-to-agent payments using MNEE tokens with Proof-of-Work verification.
 */
contract MNEEEscrow is ReentrancyGuard, AccessControl {
    
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    bytes32 public constant JUDGE_ROLE = keccak256("JUDGE_ROLE");
    
    IERC20 public mneeToken;
    
    enum DisputeStatus { NONE, OPEN, RESOLVED_FULL, RESOLVED_PARTIAL, REFUNDED }

    struct Escrow {
        address payer;
        address agent;
        uint256 totalAmount;
        uint256 paidAmount;
        uint8 totalMilestones;
        uint8 milestonesCompleted;
        bool isActive;
        bool isCompleted;
        DisputeStatus disputeStatus;
    }

    struct WorkProof {
        address agent;
        bytes32 workHash;
        uint256 timestamp;
        bool isVerified;
    }

    // Mapping from taskId to Escrow details
    mapping(string => Escrow) public escrows;
    // Mapping from taskId to milestone work proofs (taskId -> milestoneIndex -> WorkProof)
    mapping(string => mapping(uint8 => WorkProof)) public milestoneProofs;
    // Agent reputation tracking (0-100)
    mapping(address => uint256) public reputations;

    // Events
    event EscrowCreated(string indexed taskId, address indexed payer, address indexed agent, uint256 amount, uint8 milestones);
    event MilestoneReleased(string indexed taskId, uint8 milestoneIndex, uint256 amount);
    event EscrowCompleted(string indexed taskId);
    event EscrowCancelled(string indexed taskId, address indexed payer, uint256 amount);
    event WorkProofSubmitted(string indexed taskId, uint8 milestoneIndex, address indexed agent, bytes32 workHash);
    event WorkProofVerified(string indexed taskId, uint8 milestoneIndex);
    event DisputeRaised(string indexed taskId, address indexed raiser);
    event DisputeResolved(string indexed taskId, DisputeStatus resolution);
    event ReputationUpdated(address indexed agent, uint256 newReputation);

    constructor(address _mneeToken) {
        require(_mneeToken != address(0), "Invalid token address");
        mneeToken = IERC20(_mneeToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(AGENT_ROLE, msg.sender);
        _grantRole(JUDGE_ROLE, msg.sender);
    }

    /**
     * @dev Creates a new escrow for a task with milestone support.
     */
    function createEscrow(
        string memory taskId,
        address agent,
        uint256 amount,
        uint8 milestones
    ) external nonReentrant {
        require(amount > 0, "Amount must be greater than zero");
        require(agent != address(0), "Agent address cannot be zero");
        require(milestones > 0, "At least one milestone required");
        require(!escrows[taskId].isActive && !escrows[taskId].isCompleted, "Escrow exists");

        require(
            mneeToken.transferFrom(msg.sender, address(this), amount),
            "MNEE transfer failed"
        );

        escrows[taskId] = Escrow({
            payer: msg.sender,
            agent: agent,
            totalAmount: amount,
            paidAmount: 0,
            totalMilestones: milestones,
            milestonesCompleted: 0,
            isActive: true,
            isCompleted: false,
            disputeStatus: DisputeStatus.NONE
        });

        // Initialize default reputation if new agent
        if (reputations[agent] == 0) {
            reputations[agent] = 50; 
            emit ReputationUpdated(agent, 50);
        }

        emit EscrowCreated(taskId, msg.sender, agent, amount, milestones);
    }

    /**
     * @dev Submits proof for a specific milestone.
     */
    function submitWorkProof(string calldata taskId, uint8 milestoneIndex, bytes32 workHash) external {
        Escrow storage escrow = escrows[taskId];
        require(escrow.isActive, "Not active");
        require(msg.sender == escrow.agent, "Only agent");
        require(milestoneIndex < escrow.totalMilestones, "Invalid milestone");
        require(milestoneProofs[taskId][milestoneIndex].timestamp == 0, "Already submitted");

        milestoneProofs[taskId][milestoneIndex] = WorkProof({
            agent: msg.sender,
            workHash: workHash,
            timestamp: block.timestamp,
            isVerified: false
        });

        emit WorkProofSubmitted(taskId, milestoneIndex, msg.sender, workHash);
    }

    /**
     * @dev Verifies a milestone proof.
     */
    function verifyWorkProof(string calldata taskId, uint8 milestoneIndex) external onlyRole(AGENT_ROLE) {
        require(milestoneProofs[taskId][milestoneIndex].timestamp > 0, "No proof");
        require(!milestoneProofs[taskId][milestoneIndex].isVerified, "Already verified");

        milestoneProofs[taskId][milestoneIndex].isVerified = true;

        emit WorkProofVerified(taskId, milestoneIndex);
    }

    /**
     * @dev Releases funds for a verified milestone.
     */
    function releaseMilestone(string memory taskId, uint8 milestoneIndex) external nonReentrant onlyRole(AGENT_ROLE) {
        Escrow storage escrow = escrows[taskId];
        require(escrow.isActive, "Not active");
        require(escrow.disputeStatus == DisputeStatus.NONE, "In dispute");
        require(milestoneIndex == escrow.milestonesCompleted, "Sequence error");
        require(milestoneProofs[taskId][milestoneIndex].isVerified, "Not verified");

        uint256 milestoneAmount = escrow.totalAmount / escrow.totalMilestones;
        // Adjust for last milestone rounding
        if (milestoneIndex == escrow.totalMilestones - 1) {
            milestoneAmount = escrow.totalAmount - escrow.paidAmount;
        }

        escrow.paidAmount += milestoneAmount;
        escrow.milestonesCompleted += 1;

        if (escrow.milestonesCompleted == escrow.totalMilestones) {
            escrow.isActive = false;
            escrow.isCompleted = true;
            _updateReputation(escrow.agent, true);
            emit EscrowCompleted(taskId);
        }

        require(mneeToken.transfer(escrow.agent, milestoneAmount), "Transfer failed");
        emit MilestoneReleased(taskId, milestoneIndex, milestoneAmount);
    }

    /**
     * @dev Raises a dispute for an active task.
     */
    function raiseDispute(string memory taskId) external {
        Escrow storage escrow = escrows[taskId];
        require(escrow.isActive, "Not active");
        require(msg.sender == escrow.payer || msg.sender == escrow.agent, "Not authorized");
        
        escrow.disputeStatus = DisputeStatus.OPEN;
        emit DisputeRaised(taskId, msg.sender);
    }

    /**
     * @dev Resolves a dispute (Judge only).
     */
    function resolveDispute(string memory taskId, DisputeStatus resolution) external onlyRole(JUDGE_ROLE) {
        Escrow storage escrow = escrows[taskId];
        require(escrow.disputeStatus == DisputeStatus.OPEN, "No open dispute");
        
        uint256 remaining = escrow.totalAmount - escrow.paidAmount;
        escrow.isActive = false;
        escrow.disputeStatus = resolution;

        if (resolution == DisputeStatus.RESOLVED_FULL) {
            require(mneeToken.transfer(escrow.agent, remaining), "Full release failed");
            _updateReputation(escrow.agent, true);
        } else if (resolution == DisputeStatus.REFUNDED) {
            require(mneeToken.transfer(escrow.payer, remaining), "Refund failed");
            _updateReputation(escrow.agent, false);
        } else if (resolution == DisputeStatus.RESOLVED_PARTIAL) {
            uint256 half = remaining / 2;
            require(mneeToken.transfer(escrow.agent, half), "Partial agent failed");
            require(mneeToken.transfer(escrow.payer, remaining - half), "Partial payer failed");
        }

        emit DisputeResolved(taskId, resolution);
    }

    /**
     * @dev Emergency human override for specific tasks.
     */
    function emergencyRefund(string memory taskId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Escrow storage escrow = escrows[taskId];
        require(escrow.isActive, "Not active");
        
        uint256 remaining = escrow.totalAmount - escrow.paidAmount;
        escrow.isActive = false;
        escrow.isCompleted = false;

        require(mneeToken.transfer(escrow.payer, remaining), "Emergency refund failed");
        emit EscrowCancelled(taskId, escrow.payer, remaining);
    }

    function _updateReputation(address agent, bool success) internal {
        uint256 current = reputations[agent];
        if (success) {
            if (current < 100) reputations[agent] = current + 5 > 100 ? 100 : current + 5;
        } else {
            if (current > 10) reputations[agent] = current - 10 < 0 ? 0 : current - 10;
        }
        emit ReputationUpdated(agent, reputations[agent]);
    }

    function grantAgentRole(address agent) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(AGENT_ROLE, agent);
    }

    function grantJudgeRole(address judge) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(JUDGE_ROLE, judge);
    }
}
