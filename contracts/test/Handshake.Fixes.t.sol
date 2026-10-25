// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {HandshakeTestBase} from "./Handshake.Base.t.sol";
import {Handshake} from "../Handshake.sol";

/// @dev Tests covering the three contract fixes:
///   FIX 1 — expireDispute even split (50/50 via _executeSplit)
///   FIX 2 — arbiter neutrality (ArbiterNotNeutral on buyer/seller as arbiter)
///   FIX 3 — window caps and deadline cap
contract HandshakeFixesTest is HandshakeTestBase {

    // ═══════════════════════════════════════════════════════════════════════════
    // FIX 1 — expireDispute splits funds via _executeSplit, status = RELEASED
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Helper: open a job with a custom amount, deliver, dispute, then
    ///      warp past the dispute deadline.  Returns the jobId.
    function _openDeliverDisputeExpire(uint256 amount)
        internal
        returns (uint256 jobId)
    {
        // Ensure buyer has enough and approval is max
        usdc.mint(buyer, amount);
        vm.prank(buyer);
        usdc.approve(address(hs), type(uint256).max);

        // Open with no arbiter so dispute path is valid for expireDispute
        vm.prank(buyer);
        jobId = hs.openJob(
            seller,
            address(0),
            amount,
            "fix1 job",
            deadline,
            REVIEW_WINDOW,
            DISPUTE_WINDOW
        );

        _deliver(jobId);

        vm.prank(buyer);
        hs.dispute(jobId);

        _warpPastDisputeDeadline(jobId);
    }

    // ── FIX 1a: even amount (100e6) — seller 50e6, buyer 50e6, status RELEASED ─

    function test_Fix1_ExpireDispute_EvenAmount_SplitsEquallyAndReleases()
        public
    {
        uint256 amount = 100e6;
        uint256 jobId = _openDeliverDisputeExpire(amount);

        uint256 sellerShare = amount / 2; // 50e6
        uint256 buyerShare  = amount - sellerShare; // 50e6

        vm.expectEmit(true, false, false, true, address(hs));
        emit Handshake.JobSettled(jobId, sellerShare, buyerShare);

        hs.expireDispute(jobId);

        // Status must be RELEASED (not REFUNDED)
        Handshake.Job memory job = hs.getJob(jobId);
        assertEq(
            uint8(job.status),
            uint8(Handshake.JobStatus.RELEASED),
            "status should be RELEASED after expireDispute"
        );

        // Both parties credited correctly
        assertEq(hs.claimable(seller), sellerShare, "seller claimable");
        assertEq(hs.claimable(buyer),  buyerShare,  "buyer claimable");
    }

    function test_Fix1_ExpireDispute_EvenAmount_BothCanClaim() public {
        uint256 amount = 100e6;
        uint256 jobId = _openDeliverDisputeExpire(amount);
        hs.expireDispute(jobId);

        uint256 sellerShare = amount / 2; // 50e6
        uint256 buyerShare  = amount - sellerShare; // 50e6

        // Seller claims
        uint256 sellerBalBefore = usdc.balanceOf(seller);
        vm.prank(seller);
        hs.claim();
        assertEq(
            usdc.balanceOf(seller),
            sellerBalBefore + sellerShare,
            "seller balance after claim"
        );

        // Buyer claims
        uint256 buyerBalBefore = usdc.balanceOf(buyer);
        vm.prank(buyer);
        hs.claim();
        assertEq(
            usdc.balanceOf(buyer),
            buyerBalBefore + buyerShare,
            "buyer balance after claim"
        );
    }

    // ── FIX 1b: odd raw-unit amount (101 units) — sellerShare=51, buyerShare=50 ──
    // Use 101 token-units (not 101e6) so the odd bit is at the smallest unit.
    // sellerShare = amount - amount/2 = 101 - 50 = 51  (seller gets the odd unit)
    // buyerShare  = amount / 2        = 50

    function test_Fix1_ExpireDispute_OddAmount_SellerGetsExtraUnit() public {
        uint256 amount = 101; // 101 raw token units — genuinely odd
        uint256 jobId = _openDeliverDisputeExpire(amount);

        uint256 sellerShare = amount - amount / 2;  // 51 — seller gets odd unit
        uint256 buyerShare  = amount / 2;           // 50

        hs.expireDispute(jobId);

        assertEq(hs.claimable(seller), sellerShare, "seller claimable odd");
        assertEq(hs.claimable(buyer),  buyerShare,  "buyer claimable odd");

        // Sanity: seller strictly gets more than buyer on an odd amount
        assertGt(sellerShare, buyerShare, "seller share > buyer share for odd");
    }

    // ── FIX 1c: expireDispute is NOT a full-refund-to-buyer path ────────────────
    // Pre-fix behaviour would have given buyer 100% of funds via a refund path.
    // Post-fix: both get 50 / 50, not buyer 100.

    function test_Fix1_ExpireDispute_DoesNotGiveBuyerFullRefund() public {
        uint256 amount = 100e6;
        uint256 jobId = _openDeliverDisputeExpire(amount);
        hs.expireDispute(jobId);

        // Buyer must NOT receive the full amount
        assertLt(hs.claimable(buyer), amount, "buyer must not receive full amount");
        // Seller must receive something
        assertGt(hs.claimable(seller), 0, "seller must receive something");
        // Together they account for the full amount
        assertEq(
            hs.claimable(buyer) + hs.claimable(seller),
            amount,
            "shares must sum to total"
        );
    }

    // ── FIX 1d: expireDispute status is RELEASED, not REFUNDED ─────────────────

    function test_Fix1_ExpireDispute_StatusIsReleasedNotRefunded() public {
        uint256 amount = 100e6;
        uint256 jobId = _openDeliverDisputeExpire(amount);
        hs.expireDispute(jobId);

        Handshake.Job memory job = hs.getJob(jobId);
        assertTrue(
            job.status == Handshake.JobStatus.RELEASED,
            "should be RELEASED"
        );
        assertTrue(
            job.status != Handshake.JobStatus.REFUNDED,
            "must NOT be REFUNDED"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FIX 2 — arbiter neutrality
    // ═══════════════════════════════════════════════════════════════════════════

    // ── FIX 2a: arbiter == buyer (msg.sender) reverts ArbiterNotNeutral ─────────

    function test_Fix2_OpenJob_ArbiterEqualsBuyer_Reverts() public {
        vm.prank(buyer);
        vm.expectRevert(Handshake.ArbiterNotNeutral.selector);
        hs.openJob(
            seller,
            buyer,        // arbiter == buyer == msg.sender
            AMOUNT,
            "arbiter=buyer",
            deadline,
            REVIEW_WINDOW,
            DISPUTE_WINDOW
        );
    }

    // ── FIX 2b: arbiter == seller reverts ArbiterNotNeutral ─────────────────────

    function test_Fix2_OpenJob_ArbiterEqualsSeller_Reverts() public {
        vm.prank(buyer);
        vm.expectRevert(Handshake.ArbiterNotNeutral.selector);
        hs.openJob(
            seller,
            seller,       // arbiter == seller
            AMOUNT,
            "arbiter=seller",
            deadline,
            REVIEW_WINDOW,
            DISPUTE_WINDOW
        );
    }

    // ── FIX 2c: neutral third-party arbiter succeeds ─────────────────────────────

    function test_Fix2_OpenJob_NeutralArbiter_Succeeds() public {
        vm.prank(buyer);
        uint256 jobId = hs.openJob(
            seller,
            arbiter,      // neutral third address
            AMOUNT,
            "neutral arbiter",
            deadline,
            REVIEW_WINDOW,
            DISPUTE_WINDOW
        );
        assertGt(jobId, 0, "job should be created");
        assertEq(hs.getJob(jobId).arbiter, arbiter, "arbiter stored");
    }

    // ── FIX 2d: arbiter == address(0) succeeds (no arbiter) ─────────────────────

    function test_Fix2_OpenJob_ZeroArbiter_Succeeds() public {
        vm.prank(buyer);
        uint256 jobId = hs.openJob(
            seller,
            address(0),   // no arbiter
            AMOUNT,
            "no arbiter",
            deadline,
            REVIEW_WINDOW,
            DISPUTE_WINDOW
        );
        assertGt(jobId, 0, "job should be created");
        assertEq(hs.getJob(jobId).arbiter, address(0), "arbiter is zero");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FIX 3 — window caps and deadline cap
    // Constants: MAX_WINDOW = 30 days, MAX_DEADLINE_OFFSET = 365 days
    // ═══════════════════════════════════════════════════════════════════════════

    // ── FIX 3a: reviewWindow > 30 days reverts ReviewWindowTooLong ──────────────

    function test_Fix3_OpenJob_ReviewWindowOver30Days_Reverts() public {
        uint64 tooLong = uint64(hs.MAX_WINDOW()) + 1; // 30 days + 1 second
        vm.prank(buyer);
        vm.expectRevert(Handshake.ReviewWindowTooLong.selector);
        hs.openJob(
            seller,
            address(0),
            AMOUNT,
            "review too long",
            deadline,
            tooLong,
            DISPUTE_WINDOW
        );
    }

    // ── FIX 3b: disputeWindow > 30 days reverts DisputeWindowTooLong ────────────

    function test_Fix3_OpenJob_DisputeWindowOver30Days_Reverts() public {
        uint64 tooLong = uint64(hs.MAX_WINDOW()) + 1; // 30 days + 1 second
        vm.prank(buyer);
        vm.expectRevert(Handshake.DisputeWindowTooLong.selector);
        hs.openJob(
            seller,
            address(0),
            AMOUNT,
            "dispute too long",
            deadline,
            REVIEW_WINDOW,
            tooLong
        );
    }

    // ── FIX 3c: deadline > now + 365 days reverts DeadlineTooFar ────────────────

    function test_Fix3_OpenJob_DeadlineTooFar_Reverts() public {
        uint64 tooFar = uint64(block.timestamp) + uint64(hs.MAX_DEADLINE_OFFSET()) + 1;
        vm.prank(buyer);
        vm.expectRevert(Handshake.DeadlineTooFar.selector);
        hs.openJob(
            seller,
            address(0),
            AMOUNT,
            "deadline too far",
            tooFar,
            REVIEW_WINDOW,
            DISPUTE_WINDOW
        );
    }

    // ── FIX 3d: reviewWindow == 30 days (boundary) succeeds ─────────────────────

    function test_Fix3_OpenJob_ReviewWindowExactly30Days_Succeeds() public {
        uint64 exactly = uint64(hs.MAX_WINDOW()); // 30 days exactly
        vm.prank(buyer);
        uint256 jobId = hs.openJob(
            seller,
            address(0),
            AMOUNT,
            "review window boundary",
            deadline,
            exactly,
            DISPUTE_WINDOW
        );
        assertGt(jobId, 0, "job should be created");
        assertEq(hs.getJob(jobId).reviewWindow, exactly, "reviewWindow stored");
    }

    // ── FIX 3e: disputeWindow == 30 days (boundary) succeeds ────────────────────

    function test_Fix3_OpenJob_DisputeWindowExactly30Days_Succeeds() public {
        uint64 exactly = uint64(hs.MAX_WINDOW()); // 30 days exactly
        vm.prank(buyer);
        uint256 jobId = hs.openJob(
            seller,
            address(0),
            AMOUNT,
            "dispute window boundary",
            deadline,
            REVIEW_WINDOW,
            exactly
        );
        assertGt(jobId, 0, "job should be created");
        assertEq(hs.getJob(jobId).disputeWindow, exactly, "disputeWindow stored");
    }

    // ── FIX 3f: deadline == now + 365 days (boundary) succeeds ──────────────────

    function test_Fix3_OpenJob_DeadlineExactly365Days_Succeeds() public {
        uint64 exactly = uint64(block.timestamp) + uint64(hs.MAX_DEADLINE_OFFSET());
        vm.prank(buyer);
        uint256 jobId = hs.openJob(
            seller,
            address(0),
            AMOUNT,
            "deadline boundary",
            exactly,
            REVIEW_WINDOW,
            DISPUTE_WINDOW
        );
        assertGt(jobId, 0, "job should be created");
        assertEq(hs.getJob(jobId).deadline, exactly, "deadline stored");
    }
}
