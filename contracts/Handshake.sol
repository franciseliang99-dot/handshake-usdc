// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Handshake {
    using SafeERC20 for IERC20;

    enum JobStatus {
        OPEN,
        DELIVERED,
        RELEASED,
        REFUNDED,
        DISPUTED
    }

    struct Job {
        address buyer;
        address seller;
        address arbiter;
        uint256 amount;
        uint64 deadline;
        uint64 reviewWindow;
        uint64 disputeWindow;
        uint64 deliveredAt;
        uint64 disputeDeadline;
        string description;
        string deliveryRef;
        JobStatus status;
    }

    struct SplitProposal {
        bool exists;
        uint256 sellerShare;
    }

    error ArbiterNotNeutral();
    error ZeroAddress();
    error InvalidAmount();
    error TokenTransferMismatch();
    error InvalidDeadline();
    error InvalidReviewWindow();
    error InvalidDisputeWindow();
    error ReviewWindowTooLong();
    error DisputeWindowTooLong();
    error DeadlineTooFar();
    error InvalidJobId();
    error NotBuyer();
    error NotSeller();
    error NotArbiter();
    error NotParticipant();
    error InvalidStatus(JobStatus expected, JobStatus actual);
    error DeadlinePassed();
    error DeadlineNotReached();
    error ReviewWindowElapsed();
    error ReviewWindowNotElapsed();
    error DisputeWindowNotElapsed();
    error DisputeWindowElapsed();
    error DisputeRequiresNoArbiter();
    error DisputeRequiresArbiter();
    error InvalidSellerShare();
    error NothingToClaim();

    event JobOpened(
        uint256 indexed jobId,
        address indexed buyer,
        address indexed seller,
        address arbiter,
        uint256 amount,
        uint64 deadline,
        uint64 reviewWindow,
        uint64 disputeWindow,
        string description
    );
    event JobDelivered(uint256 indexed jobId, string deliveryRef, uint64 deliveredAt);
    event JobReleased(uint256 indexed jobId, address indexed recipient, uint256 amount);
    event JobRefunded(uint256 indexed jobId, address indexed buyer, uint256 amount);
    event JobDisputed(uint256 indexed jobId, address indexed buyer);
    event JobSettled(uint256 indexed jobId, uint256 sellerShare, uint256 buyerShare);
    event SplitProposed(uint256 indexed jobId, address indexed proposer, uint256 sellerShare);
    event FundsClaimable(uint256 indexed jobId, address indexed recipient, uint256 amount);
    event Claimed(address indexed recipient, uint256 amount);

    IERC20 public immutable usdcToken;

    uint256 private _nextJobId = 1;
    mapping(uint256 => Job) private _jobs;
    mapping(uint256 => mapping(address => SplitProposal)) private _splitProposals;
    mapping(address => uint256) public claimable;

    uint64 public constant MAX_WINDOW = 30 days;
    uint64 public constant MAX_DEADLINE_OFFSET = 365 days;

    constructor(address _usdcToken) {
        if (_usdcToken == address(0)) revert ZeroAddress();
        usdcToken = IERC20(_usdcToken);
    }

    function openJob(
        address seller,
        address arbiter,
        uint256 amount,
        string calldata description,
        uint64 deadline,
        uint64 reviewWindow,
        uint64 disputeWindow
    ) external returns (uint256 jobId) {
        if (seller == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (deadline <= block.timestamp) revert InvalidDeadline();
        if (reviewWindow == 0) revert InvalidReviewWindow();
        if (disputeWindow == 0) revert InvalidDisputeWindow();
        if (arbiter != address(0) && (arbiter == msg.sender || arbiter == seller)) revert ArbiterNotNeutral();
        if (reviewWindow > MAX_WINDOW) revert ReviewWindowTooLong();
        if (disputeWindow > MAX_WINDOW) revert DisputeWindowTooLong();
        if (deadline > uint64(block.timestamp) + MAX_DEADLINE_OFFSET) revert DeadlineTooFar();

        jobId = _nextJobId;
        unchecked {
            _nextJobId = jobId + 1;
        }

        uint256 balanceBefore = usdcToken.balanceOf(address(this));
        usdcToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 balanceAfter = usdcToken.balanceOf(address(this));
        uint256 received = balanceAfter - balanceBefore;
        if (received != amount) revert TokenTransferMismatch();

        _jobs[jobId] = Job({
            buyer: msg.sender,
            seller: seller,
            arbiter: arbiter,
            amount: received,
            deadline: deadline,
            reviewWindow: reviewWindow,
            disputeWindow: disputeWindow,
            deliveredAt: 0,
            disputeDeadline: 0,
            description: description,
            deliveryRef: "",
            status: JobStatus.OPEN
        });

        emit JobOpened(jobId, msg.sender, seller, arbiter, received, deadline, reviewWindow, disputeWindow, description);
    }

    function deliver(uint256 jobId, string calldata deliveryRef) external {
        Job storage job = _job(jobId);
        if (msg.sender != job.seller) revert NotSeller();
        if (job.status != JobStatus.OPEN) revert InvalidStatus(JobStatus.OPEN, job.status);
        if (block.timestamp >= job.deadline) revert DeadlinePassed();

        uint64 deliveredAt = uint64(block.timestamp);
        job.deliveredAt = deliveredAt;
        job.deliveryRef = deliveryRef;
        job.status = JobStatus.DELIVERED;

        emit JobDelivered(jobId, deliveryRef, deliveredAt);
    }

    function release(uint256 jobId) external {
        Job storage job = _job(jobId);
        if (msg.sender != job.buyer) revert NotBuyer();
        if (job.status != JobStatus.DELIVERED) revert InvalidStatus(JobStatus.DELIVERED, job.status);
        // Buyer may only release within the review window; after that autoRelease is the path
        if (block.timestamp >= job.deliveredAt + job.reviewWindow) revert ReviewWindowElapsed();

        uint256 amount = job.amount;
        address seller = job.seller;

        job.status = JobStatus.RELEASED;
        claimable[seller] += amount;

        emit JobReleased(jobId, seller, amount);
        emit FundsClaimable(jobId, seller, amount);
    }

    function dispute(uint256 jobId) external {
        Job storage job = _job(jobId);
        if (msg.sender != job.buyer) revert NotBuyer();
        if (job.status != JobStatus.DELIVERED) revert InvalidStatus(JobStatus.DELIVERED, job.status);
        if (block.timestamp >= job.deliveredAt + job.reviewWindow) revert ReviewWindowElapsed();

        job.status = JobStatus.DISPUTED;
        job.disputeDeadline = uint64(block.timestamp) + job.disputeWindow;

        emit JobDisputed(jobId, msg.sender);
    }

    function autoRelease(uint256 jobId) external {
        Job storage job = _job(jobId);
        if (job.status != JobStatus.DELIVERED) revert InvalidStatus(JobStatus.DELIVERED, job.status);
        if (block.timestamp < job.deliveredAt + job.reviewWindow) revert ReviewWindowNotElapsed();

        uint256 amount = job.amount;
        address seller = job.seller;

        job.status = JobStatus.RELEASED;
        claimable[seller] += amount;

        emit JobReleased(jobId, seller, amount);
        emit FundsClaimable(jobId, seller, amount);
    }

    function refund(uint256 jobId) external {
        Job storage job = _job(jobId);
        if (job.status != JobStatus.OPEN) revert InvalidStatus(JobStatus.OPEN, job.status);
        if (block.timestamp < job.deadline) revert DeadlineNotReached();

        uint256 amount = job.amount;
        address buyer = job.buyer;

        job.status = JobStatus.REFUNDED;
        claimable[buyer] += amount;

        emit JobRefunded(jobId, buyer, amount);
        emit FundsClaimable(jobId, buyer, amount);
    }

    function settle(uint256 jobId, uint256 sellerShare) external {
        Job storage job = _job(jobId);
        if (job.arbiter == address(0)) revert DisputeRequiresArbiter();
        if (msg.sender != job.arbiter) revert NotArbiter();
        if (job.status != JobStatus.DISPUTED) revert InvalidStatus(JobStatus.DISPUTED, job.status);
        // Once the dispute window has elapsed, only expireDispute may resolve it (50/50 split)
        if (block.timestamp >= job.disputeDeadline) revert DisputeWindowElapsed();
        if (sellerShare > job.amount) revert InvalidSellerShare();

        _executeSplit(jobId, job, sellerShare);
    }

    function agreeToSplit(uint256 jobId, uint256 sellerShare) external {
        Job storage job = _job(jobId);
        if (job.status != JobStatus.DISPUTED) revert InvalidStatus(JobStatus.DISPUTED, job.status);
        if (job.arbiter != address(0)) revert DisputeRequiresNoArbiter();
        if (msg.sender != job.buyer && msg.sender != job.seller) revert NotParticipant();
        // Once the dispute window has elapsed, only expireDispute may resolve it (50/50 split)
        if (block.timestamp >= job.disputeDeadline) revert DisputeWindowElapsed();
        if (sellerShare > job.amount) revert InvalidSellerShare();

        _splitProposals[jobId][msg.sender] = SplitProposal({exists: true, sellerShare: sellerShare});
        emit SplitProposed(jobId, msg.sender, sellerShare);

        address counterparty = msg.sender == job.buyer ? job.seller : job.buyer;
        SplitProposal memory otherProposal = _splitProposals[jobId][counterparty];

        if (otherProposal.exists && otherProposal.sellerShare == sellerShare) {
            _executeSplit(jobId, job, sellerShare);
        }
    }

    function expireDispute(uint256 jobId) external {
        Job storage job = _job(jobId);
        if (job.status != JobStatus.DISPUTED) revert InvalidStatus(JobStatus.DISPUTED, job.status);
        if (block.timestamp < job.disputeDeadline) revert DisputeWindowNotElapsed();

        uint256 amount = job.amount;
        // seller gets the odd smallest unit: amount - (amount/2) rounds up for seller
        uint256 sellerShare = amount - amount / 2;

        _executeSplit(jobId, job, sellerShare);
    }

    function claim() external {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToClaim();

        claimable[msg.sender] = 0;
        usdcToken.safeTransfer(msg.sender, amount);

        emit Claimed(msg.sender, amount);
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return _job(jobId);
    }

    function _executeSplit(uint256 jobId, Job storage job, uint256 sellerShare) internal {
        uint256 amount = job.amount;
        uint256 buyerShare = amount - sellerShare;
        address seller = job.seller;
        address buyer = job.buyer;

        job.status = JobStatus.RELEASED;

        if (sellerShare != 0) {
            claimable[seller] += sellerShare;
        }
        if (buyerShare != 0) {
            claimable[buyer] += buyerShare;
        }

        emit JobSettled(jobId, sellerShare, buyerShare);
        emit JobReleased(jobId, seller, sellerShare);
        if (sellerShare != 0) {
            emit FundsClaimable(jobId, seller, sellerShare);
        }
        if (buyerShare != 0) {
            emit FundsClaimable(jobId, buyer, buyerShare);
        }
    }

    function _job(uint256 jobId) internal view returns (Job storage job) {
        if (jobId == 0 || jobId >= _nextJobId) revert InvalidJobId();
        job = _jobs[jobId];
    }
}
