// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {HandshakeTestBase} from "./Handshake.Base.t.sol";
import {Handshake} from "../Handshake.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract HandshakeHappyTest is HandshakeTestBase {

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. openJob → deliver → release → claim (buyer gets nothing, seller gets all)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_OpenJob_StoresJobAndPullsTokens() public {
        uint256 contractBalBefore = usdc.balanceOf(address(hs));
        uint256 buyerBalBefore    = usdc.balanceOf(buyer);

        vm.prank(buyer);
        vm.expectEmit(true, true, true, true, address(hs));
        emit Handshake.JobOpened(
            1, buyer, seller, address(0), AMOUNT, deadline,
            REVIEW_WINDOW, DISPUTE_WINDOW, "test job"
        );
        uint256 jobId = hs.openJob(
            seller, address(0), AMOUNT, "test job",
            deadline, REVIEW_WINDOW, DISPUTE_WINDOW
        );

        assertEq(jobId, 1, "first jobId should be 1");
        assertEq(usdc.balanceOf(address(hs)), contractBalBefore + AMOUNT, "contract balance");
        assertEq(usdc.balanceOf(buyer), buyerBalBefore - AMOUNT, "buyer balance");

        Handshake.Job memory job = hs.getJob(jobId);
        assertEq(job.buyer,  buyer);
        assertEq(job.seller, seller);
        assertEq(job.amount, AMOUNT);
        assertEq(uint8(job.status), uint8(Handshake.JobStatus.OPEN));
    }

    function test_Deliver_SetsStatusAndRef() public {
        uint256 jobId = _openJob();

        vm.prank(seller);
        vm.expectEmit(true, false, false, true, address(hs));
        emit Handshake.JobDelivered(jobId, "ipfs://delivery", uint64(block.timestamp));
        hs.deliver(jobId, "ipfs://delivery");

        Handshake.Job memory job = hs.getJob(jobId);
        assertEq(uint8(job.status), uint8(Handshake.JobStatus.DELIVERED));
        assertEq(job.deliveryRef, "ipfs://delivery");
        assertGt(job.deliveredAt, 0);
    }

    function test_Release_CreditsSellerClaimable() public {
        uint256 jobId = _openJob();
        _deliver(jobId);

        vm.prank(buyer);
        vm.expectEmit(true, true, false, true, address(hs));
        emit Handshake.JobReleased(jobId, seller, AMOUNT);
        hs.release(jobId);

        assertEq(hs.claimable(seller), AMOUNT);
        assertEq(uint8(hs.getJob(jobId).status), uint8(Handshake.JobStatus.RELEASED));
    }

    function test_Claim_SellerReceivesTokens() public {
        uint256 jobId = _openJob();
        _deliver(jobId);
        vm.prank(buyer);
        hs.release(jobId);

        uint256 sellerBalBefore = usdc.balanceOf(seller);

        vm.prank(seller);
        vm.expectEmit(true, false, false, true, address(hs));
        emit Handshake.Claimed(seller, AMOUNT);
        hs.claim();

        assertEq(usdc.balanceOf(seller), sellerBalBefore + AMOUNT);
        assertEq(hs.claimable(seller), 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. openJob → deliver → autoRelease (after reviewWindow) → claim (seller)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_AutoRelease_AfterReviewWindow_CreditsSellerAndTransfers() public {
        uint256 jobId = _openJob();
        _deliver(jobId);
        _warpPastReviewWindow(jobId);

        // Anyone can call autoRelease
        vm.expectEmit(true, true, false, true, address(hs));
        emit Handshake.JobReleased(jobId, seller, AMOUNT);
        hs.autoRelease(jobId);

        assertEq(hs.claimable(seller), AMOUNT);
        assertEq(uint8(hs.getJob(jobId).status), uint8(Handshake.JobStatus.RELEASED));

        uint256 sellerBalBefore = usdc.balanceOf(seller);
        vm.prank(seller);
        hs.claim();
        assertEq(usdc.balanceOf(seller), sellerBalBefore + AMOUNT);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. openJob → refund (after deadline missed) → claim (buyer)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_Refund_AfterDeadline_CreditsBuyerAndTransfers() public {
        uint256 jobId = _openJob();
        _warpPastDeadline(jobId);

        vm.expectEmit(true, true, false, true, address(hs));
        emit Handshake.JobRefunded(jobId, buyer, AMOUNT);
        hs.refund(jobId);

        assertEq(hs.claimable(buyer), AMOUNT);
        assertEq(uint8(hs.getJob(jobId).status), uint8(Handshake.JobStatus.REFUNDED));

        uint256 buyerBalBefore = usdc.balanceOf(buyer);
        vm.prank(buyer);
        hs.claim();
        assertEq(usdc.balanceOf(buyer), buyerBalBefore + AMOUNT);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. openJob → deliver → dispute → settle (arbiter splits) → claim by both
    // ═══════════════════════════════════════════════════════════════════════════

    function test_Settle_ArbiterSplits_CreditsBothParties() public {
        uint256 jobId = _openJobWithArbiter();
        _deliver(jobId);

        vm.prank(buyer);
        hs.dispute(jobId);
        assertEq(uint8(hs.getJob(jobId).status), uint8(Handshake.JobStatus.DISPUTED));

        uint256 sellerShare = 600e6;
        uint256 buyerShare  = AMOUNT - sellerShare;

        vm.prank(arbiter);
        vm.expectEmit(true, false, false, true, address(hs));
        emit Handshake.JobSettled(jobId, sellerShare, buyerShare);
        hs.settle(jobId, sellerShare);

        assertEq(hs.claimable(seller), sellerShare);
        assertEq(hs.claimable(buyer),  buyerShare);
        assertEq(uint8(hs.getJob(jobId).status), uint8(Handshake.JobStatus.RELEASED));

        // Seller claims
        uint256 sellerBalBefore = usdc.balanceOf(seller);
        vm.prank(seller);
        hs.claim();
        assertEq(usdc.balanceOf(seller), sellerBalBefore + sellerShare);

        // Buyer claims
        uint256 buyerBalBefore = usdc.balanceOf(buyer);
        vm.prank(buyer);
        hs.claim();
        assertEq(usdc.balanceOf(buyer), buyerBalBefore + buyerShare);
    }

    // Full-amount settle: seller gets 100%
    function test_Settle_FullAmountToSeller() public {
        uint256 jobId = _openJobWithArbiter();
        _deliver(jobId);
        vm.prank(buyer);
        hs.dispute(jobId);

        vm.prank(arbiter);
        hs.settle(jobId, AMOUNT); // 100% to seller

        assertEq(hs.claimable(seller), AMOUNT);
        assertEq(hs.claimable(buyer),  0);
    }

    // Full refund via settle: buyer gets 100%
    function test_Settle_ZeroToSeller_FullToBuyer() public {
        uint256 jobId = _openJobWithArbiter();
        _deliver(jobId);
        vm.prank(buyer);
        hs.dispute(jobId);

        vm.prank(arbiter);
        hs.settle(jobId, 0); // 100% to buyer

        assertEq(hs.claimable(seller), 0);
        assertEq(hs.claimable(buyer),  AMOUNT);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. openJob → deliver → dispute → agreeToSplit (both agree) → claim by both
    // ═══════════════════════════════════════════════════════════════════════════

    function test_AgreeToSplit_BothAgree_ExecutesSplit() public {
        uint256 jobId = _openJob(); // no arbiter
        _deliver(jobId);

        vm.prank(buyer);
        hs.dispute(jobId);

        uint256 sellerShare = 500e6;
        uint256 buyerShare  = AMOUNT - sellerShare;

        // Buyer proposes first
        vm.prank(buyer);
        vm.expectEmit(true, true, false, true, address(hs));
        emit Handshake.SplitProposed(jobId, buyer, sellerShare);
        hs.agreeToSplit(jobId, sellerShare);

        // Job still DISPUTED after one proposal
        assertEq(uint8(hs.getJob(jobId).status), uint8(Handshake.JobStatus.DISPUTED));

        // Seller proposes the same value → executes
        vm.prank(seller);
        vm.expectEmit(true, false, false, true, address(hs));
        emit Handshake.JobSettled(jobId, sellerShare, buyerShare);
        hs.agreeToSplit(jobId, sellerShare);

        assertEq(hs.claimable(seller), sellerShare);
        assertEq(hs.claimable(buyer),  buyerShare);
        assertEq(uint8(hs.getJob(jobId).status), uint8(Handshake.JobStatus.RELEASED));

        // Claims
        uint256 sBefore = usdc.balanceOf(seller);
        vm.prank(seller);
        hs.claim();
        assertEq(usdc.balanceOf(seller), sBefore + sellerShare);

        uint256 bBefore = usdc.balanceOf(buyer);
        vm.prank(buyer);
        hs.claim();
        assertEq(usdc.balanceOf(buyer), bBefore + buyerShare);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. openJob → deliver → dispute → expireDispute → 50/50 split (FIX 1)
    //    Updated: expireDispute now calls _executeSplit(50/50), not a full refund.
    //    Status → RELEASED; both buyer and seller receive their share.
    // ═══════════════════════════════════════════════════════════════════════════

    function test_ExpireDispute_AfterDisputeDeadline_CreditsBuyer() public {
        uint256 jobId = _openJob(); // no arbiter
        _deliver(jobId);
        vm.prank(buyer);
        hs.dispute(jobId);
        _warpPastDisputeDeadline(jobId);

        uint256 sellerShare = AMOUNT / 2;
        uint256 buyerShare  = AMOUNT - sellerShare;

        vm.expectEmit(true, false, false, true, address(hs));
        emit Handshake.JobSettled(jobId, sellerShare, buyerShare);
        hs.expireDispute(jobId);

        assertEq(hs.claimable(seller), sellerShare, "seller share");
        assertEq(hs.claimable(buyer),  buyerShare,  "buyer share");
        assertEq(uint8(hs.getJob(jobId).status), uint8(Handshake.JobStatus.RELEASED));

        uint256 bBefore = usdc.balanceOf(buyer);
        vm.prank(buyer);
        hs.claim();
        assertEq(usdc.balanceOf(buyer), bBefore + buyerShare);

        uint256 sBefore = usdc.balanceOf(seller);
        vm.prank(seller);
        hs.claim();
        assertEq(usdc.balanceOf(seller), sBefore + sellerShare);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Multiple jobs: jobId increments correctly
    // ═══════════════════════════════════════════════════════════════════════════

    function test_MultipleJobs_IdsIncrement() public {
        uint256 id1 = _openJob();
        uint256 id2 = _openJob();
        uint256 id3 = _openJob();
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(id3, 3);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // dispute: event check
    // ═══════════════════════════════════════════════════════════════════════════

    function test_Dispute_EmitsEvent() public {
        uint256 jobId = _openJob();
        _deliver(jobId);

        vm.prank(buyer);
        vm.expectEmit(true, true, false, false, address(hs));
        emit Handshake.JobDisputed(jobId, buyer);
        hs.dispute(jobId);
    }
}
