// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {HandshakeTestBase} from "./Handshake.Base.t.sol";
import {Handshake} from "../Handshake.sol";

/// @dev Test scenario 23: multi-step agreeToSplit negotiation
contract HandshakeAgreeToSplitTest is HandshakeTestBase {

    // ─── Scenario 23 ─────────────────────────────────────────────────────────
    // One party proposes → still DISPUTED
    // Other party proposes a DIFFERENT value → still DISPUTED
    // Both agree on same value → executes immediately

    function test_AgreeToSplit_Negotiation_ThenAgree() public {
        uint256 jobId = _openJob(); // no arbiter
        _deliver(jobId);
        vm.prank(buyer);
        hs.dispute(jobId);

        // ── Step 1: Buyer proposes 600e6 to seller ────────────────────────────
        vm.prank(buyer);
        vm.expectEmit(true, true, false, true, address(hs));
        emit Handshake.SplitProposed(jobId, buyer, 600e6);
        hs.agreeToSplit(jobId, 600e6);

        // Still DISPUTED after one proposal
        assertEq(
            uint8(hs.getJob(jobId).status),
            uint8(Handshake.JobStatus.DISPUTED),
            "should remain DISPUTED after one proposal"
        );

        // ── Step 2: Seller proposes a different value (400e6) ─────────────────
        vm.prank(seller);
        vm.expectEmit(true, true, false, true, address(hs));
        emit Handshake.SplitProposed(jobId, seller, 400e6);
        hs.agreeToSplit(jobId, 400e6);

        // Still DISPUTED because the values differ
        assertEq(
            uint8(hs.getJob(jobId).status),
            uint8(Handshake.JobStatus.DISPUTED),
            "should remain DISPUTED when proposals differ"
        );

        // ── Step 3: Buyer changes proposal to match seller (400e6) ───────────
        // The agreed sellerShare is 400e6 → buyerShare is 600e6
        uint256 sellerShare = 400e6;
        uint256 buyerShare  = AMOUNT - sellerShare;

        vm.prank(buyer);
        // Expect both SplitProposed and JobSettled because this triggers execution
        vm.expectEmit(true, true, false, true, address(hs));
        emit Handshake.SplitProposed(jobId, buyer, sellerShare);
        vm.expectEmit(true, false, false, true, address(hs));
        emit Handshake.JobSettled(jobId, sellerShare, buyerShare);
        hs.agreeToSplit(jobId, sellerShare);

        // Status is now RELEASED
        assertEq(
            uint8(hs.getJob(jobId).status),
            uint8(Handshake.JobStatus.RELEASED),
            "should be RELEASED after both agree"
        );

        // Claimable balances correct
        assertEq(hs.claimable(seller), sellerShare, "seller claimable");
        assertEq(hs.claimable(buyer),  buyerShare,  "buyer claimable");
    }

    // ─── agreeToSplit: seller proposes first, buyer agrees ───────────────────

    function test_AgreeToSplit_SellerProposesFirst_BuyerAgrees() public {
        uint256 jobId = _openJob();
        _deliver(jobId);
        vm.prank(buyer);
        hs.dispute(jobId);

        uint256 sellerShare = 700e6;
        uint256 buyerShare  = AMOUNT - sellerShare;

        // Seller proposes first
        vm.prank(seller);
        hs.agreeToSplit(jobId, sellerShare);
        assertEq(
            uint8(hs.getJob(jobId).status),
            uint8(Handshake.JobStatus.DISPUTED)
        );

        // Buyer agrees to the same value → executes
        vm.prank(buyer);
        hs.agreeToSplit(jobId, sellerShare);

        assertEq(uint8(hs.getJob(jobId).status), uint8(Handshake.JobStatus.RELEASED));
        assertEq(hs.claimable(seller), sellerShare);
        assertEq(hs.claimable(buyer),  buyerShare);
    }

    // ─── agreeToSplit: overwrite own proposal ─────────────────────────────────

    function test_AgreeToSplit_CanOverwriteOwnProposal() public {
        uint256 jobId = _openJob();
        _deliver(jobId);
        vm.prank(buyer);
        hs.dispute(jobId);

        // Buyer proposes 600e6
        vm.prank(buyer);
        hs.agreeToSplit(jobId, 600e6);

        // Seller proposes 500e6
        vm.prank(seller);
        hs.agreeToSplit(jobId, 500e6);

        // Buyer overwrites to 500e6 → triggers execution
        vm.prank(buyer);
        hs.agreeToSplit(jobId, 500e6);

        assertEq(uint8(hs.getJob(jobId).status), uint8(Handshake.JobStatus.RELEASED));
        assertEq(hs.claimable(seller), 500e6);
        assertEq(hs.claimable(buyer),  500e6);
    }

    // ─── agreeToSplit: full amount to seller (buyer share = 0) ───────────────

    function test_AgreeToSplit_FullAmountToSeller() public {
        uint256 jobId = _openJob();
        _deliver(jobId);
        vm.prank(buyer);
        hs.dispute(jobId);

        vm.prank(buyer);
        hs.agreeToSplit(jobId, AMOUNT);
        vm.prank(seller);
        hs.agreeToSplit(jobId, AMOUNT);

        assertEq(hs.claimable(seller), AMOUNT);
        assertEq(hs.claimable(buyer),  0);
        assertEq(uint8(hs.getJob(jobId).status), uint8(Handshake.JobStatus.RELEASED));
    }

    // ─── agreeToSplit: full refund to buyer (seller share = 0) ───────────────

    function test_AgreeToSplit_FullAmountToBuyer() public {
        uint256 jobId = _openJob();
        _deliver(jobId);
        vm.prank(buyer);
        hs.dispute(jobId);

        vm.prank(buyer);
        hs.agreeToSplit(jobId, 0);
        vm.prank(seller);
        hs.agreeToSplit(jobId, 0);

        assertEq(hs.claimable(seller), 0);
        assertEq(hs.claimable(buyer),  AMOUNT);
        assertEq(uint8(hs.getJob(jobId).status), uint8(Handshake.JobStatus.RELEASED));
    }
}
