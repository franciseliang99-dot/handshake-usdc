// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Handshake} from "../Handshake.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";

/// @dev Shared fixtures for all Handshake test categories.
///      No test_* / testFuzz_* / invariant_* functions here — each category
///      file imports this and calls super.setUp().
abstract contract HandshakeTestBase is Test {
    // ── Actors ────────────────────────────────────────────────────────────────
    address internal buyer   = makeAddr("buyer");
    address internal seller  = makeAddr("seller");
    address internal arbiter = makeAddr("arbiter");
    address internal stranger = makeAddr("stranger");

    // ── Contracts ─────────────────────────────────────────────────────────────
    MockERC20  internal usdc;
    Handshake  internal hs;

    // ── Default job parameters ────────────────────────────────────────────────
    uint256 internal constant AMOUNT         = 1_000e6;   // 1 000 USDC (6 dec mock)
    uint64  internal constant REVIEW_WINDOW  = 3 days;
    uint64  internal constant DISPUTE_WINDOW = 7 days;

    // Absolute timestamps; set relative to block.timestamp in setUp
    uint64 internal deadline;

    // ── Setup ─────────────────────────────────────────────────────────────────
    function setUp() public virtual {
        // Pin a known base timestamp so warps are deterministic
        vm.warp(1_000_000);

        usdc = new MockERC20("Mock USDC", "mUSDC", 6);
        hs   = new Handshake(address(usdc));

        deadline = uint64(block.timestamp) + 30 days;

        // Fund buyer with plenty of USDC and approve the contract
        usdc.mint(buyer, 100_000e6);
        vm.prank(buyer);
        usdc.approve(address(hs), type(uint256).max);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// Open a job with default parameters (arbiter = address(0) → no arbiter).
    function _openJob() internal returns (uint256 jobId) {
        vm.prank(buyer);
        jobId = hs.openJob(
            seller,
            address(0),
            AMOUNT,
            "test job",
            deadline,
            REVIEW_WINDOW,
            DISPUTE_WINDOW
        );
    }

    /// Open a job with an arbiter set.
    function _openJobWithArbiter() internal returns (uint256 jobId) {
        vm.prank(buyer);
        jobId = hs.openJob(
            seller,
            arbiter,
            AMOUNT,
            "test job with arbiter",
            deadline,
            REVIEW_WINDOW,
            DISPUTE_WINDOW
        );
    }

    /// Deliver for a job (called as seller).
    function _deliver(uint256 jobId) internal {
        vm.prank(seller);
        hs.deliver(jobId, "ipfs://delivery");
    }

    /// Advance time so the review window has elapsed since delivery.
    function _warpPastReviewWindow(uint256 jobId) internal {
        Handshake.Job memory job = hs.getJob(jobId);
        vm.warp(uint256(job.deliveredAt) + uint256(job.reviewWindow) + 1);
    }

    /// Advance time so the dispute window has elapsed.
    function _warpPastDisputeDeadline(uint256 jobId) internal {
        Handshake.Job memory job = hs.getJob(jobId);
        vm.warp(uint256(job.disputeDeadline) + 1);
    }

    /// Advance time past the job deadline.
    function _warpPastDeadline(uint256 jobId) internal {
        Handshake.Job memory job = hs.getJob(jobId);
        vm.warp(uint256(job.deadline) + 1);
    }
}
