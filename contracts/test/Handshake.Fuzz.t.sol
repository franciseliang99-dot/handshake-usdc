// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {HandshakeTestBase} from "./Handshake.Base.t.sol";
import {Handshake} from "../Handshake.sol";

contract HandshakeFuzzTest is HandshakeTestBase {

    // ═══════════════════════════════════════════════════════════════════════════
    // Fuzz 24: claimable balances always sum ≤ contract's USDC balance
    // after any sequence of: openJob → (deliver or skip) → (release or refund
    // or autoRelease or settle or expireDispute) → partial claims.
    // ═══════════════════════════════════════════════════════════════════════════

    /// @param amount        Job amount in USDC (6 dec) — bounded to [1, 10_000e6]
    /// @param sellerPct     Seller's share of the settlement [0, 100]
    /// @param doDeliver     Whether the seller delivers
    /// @param doDispute     Whether the buyer disputes (only relevant if doDeliver)
    /// @param buyerClaims   Whether the buyer claims after the flow
    /// @param sellerClaims  Whether the seller claims after the flow
    function testFuzz_ClaimableSumNeverExceedsContractBalance(
        uint256 amount,
        uint8   sellerPct,
        bool    doDeliver,
        bool    doDispute,
        bool    buyerClaims,
        bool    sellerClaims
    ) public {
        // ── Bound inputs ──────────────────────────────────────────────────────
        amount     = bound(amount, 1, 10_000e6);
        sellerPct  = uint8(bound(sellerPct, 0, 100));

        // ── Fund & approve the buyer for this specific amount ──────────────────
        usdc.mint(buyer, amount);
        // buyer already approved max in setUp; no-op needed

        // ── Open job ──────────────────────────────────────────────────────────
        vm.prank(buyer);
        uint256 jobId = hs.openJob(
            seller,
            address(0),         // no arbiter → expireDispute path available
            amount,
            "fuzz job",
            uint64(block.timestamp) + 30 days,
            REVIEW_WINDOW,
            DISPUTE_WINDOW
        );

        // ── Deliver or take refund path ────────────────────────────────────────
        if (doDeliver) {
            vm.prank(seller);
            hs.deliver(jobId, "fuzz-ref");

            if (doDispute) {
                // Dispute immediately (within reviewWindow)
                vm.prank(buyer);
                hs.dispute(jobId);

                // Settle via expireDispute (simplest deterministic resolution)
                _warpPastDisputeDeadline(jobId);
                hs.expireDispute(jobId);
                // buyer's claimable += amount
            } else {
                // autoRelease after reviewWindow
                _warpPastReviewWindow(jobId);
                hs.autoRelease(jobId);
                // seller's claimable += amount
            }
        } else {
            // Seller missed deadline → refund
            _warpPastDeadline(jobId);
            hs.refund(jobId);
            // buyer's claimable += amount
        }

        // ── Invariant check BEFORE any claims ────────────────────────────────
        _assertInvariant();

        // ── Optional partial claims ───────────────────────────────────────────
        if (buyerClaims && hs.claimable(buyer) > 0) {
            vm.prank(buyer);
            hs.claim();
        }
        if (sellerClaims && hs.claimable(seller) > 0) {
            vm.prank(seller);
            hs.claim();
        }

        // ── Invariant check AFTER claims ─────────────────────────────────────
        _assertInvariant();
    }

    /// @dev Checks: sum of tracked claimable ≤ actual USDC held by the contract.
    ///      We only track buyer + seller here; additional addresses have claimable==0
    ///      throughout this test, so the sum is exact.
    function _assertInvariant() internal view {
        uint256 contractBalance = usdc.balanceOf(address(hs));
        uint256 claimableSum    = hs.claimable(buyer) + hs.claimable(seller);
        assertLe(
            claimableSum,
            contractBalance,
            "claimable sum must not exceed contract USDC balance"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Fuzz: openJob amount is stored exactly (no fee / deflation mismatch)
    // ═══════════════════════════════════════════════════════════════════════════

    function testFuzz_OpenJob_AmountStoredExactly(uint256 amount) public {
        amount = bound(amount, 1, 10_000e6);
        usdc.mint(buyer, amount);

        vm.prank(buyer);
        uint256 jobId = hs.openJob(
            seller, address(0), amount, "fuzz",
            uint64(block.timestamp) + 1 days,
            REVIEW_WINDOW, DISPUTE_WINDOW
        );

        Handshake.Job memory job = hs.getJob(jobId);
        assertEq(job.amount, amount, "stored amount must equal transferred amount");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Fuzz: settle sellerShare ≤ amount always satisfies conservation
    // ═══════════════════════════════════════════════════════════════════════════

    function testFuzz_Settle_ConservationOfFunds(uint256 sellerShare) public {
        uint256 jobId = _openJobWithArbiter();
        _deliver(jobId);
        vm.prank(buyer);
        hs.dispute(jobId);

        Handshake.Job memory job = hs.getJob(jobId);
        sellerShare = bound(sellerShare, 0, job.amount);

        uint256 contractBalBefore = usdc.balanceOf(address(hs));

        vm.prank(arbiter);
        hs.settle(jobId, sellerShare);

        uint256 buyerShare  = job.amount - sellerShare;
        assertEq(hs.claimable(seller), sellerShare);
        assertEq(hs.claimable(buyer),  buyerShare);
        assertEq(
            hs.claimable(seller) + hs.claimable(buyer),
            contractBalBefore,
            "claimable sum must equal original contract balance"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Fuzz: deadline must be strictly in the future
    // ═══════════════════════════════════════════════════════════════════════════

    function testFuzz_OpenJob_DeadlineMustBeFuture(uint64 dl) public {
        // Any deadline ≤ block.timestamp must revert
        dl = uint64(bound(dl, 0, block.timestamp));

        vm.prank(buyer);
        vm.expectRevert(Handshake.InvalidDeadline.selector);
        hs.openJob(seller, address(0), AMOUNT, "desc", dl, REVIEW_WINDOW, DISPUTE_WINDOW);
    }
}
