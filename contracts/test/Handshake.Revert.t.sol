// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {HandshakeTestBase} from "./Handshake.Base.t.sol";
import {Handshake} from "../Handshake.sol";

contract HandshakeRevertTest is HandshakeTestBase {

    // ─── openJob reverts ──────────────────────────────────────────────────────

    // 21. Revert: openJob with zero amount
    function test_Revert_OpenJob_ZeroAmount() public {
        vm.prank(buyer);
        vm.expectRevert(Handshake.InvalidAmount.selector);
        hs.openJob(seller, address(0), 0, "desc", deadline, REVIEW_WINDOW, DISPUTE_WINDOW);
    }

    // 22. Revert: openJob with past deadline (deadline == block.timestamp counts as past)
    function test_Revert_OpenJob_PastDeadline() public {
        vm.prank(buyer);
        vm.expectRevert(Handshake.InvalidDeadline.selector);
        hs.openJob(seller, address(0), AMOUNT, "desc",
                   uint64(block.timestamp), // not strictly future
                   REVIEW_WINDOW, DISPUTE_WINDOW);
    }

    function test_Revert_OpenJob_ZeroSeller() public {
        vm.prank(buyer);
        vm.expectRevert(Handshake.ZeroAddress.selector);
        hs.openJob(address(0), address(0), AMOUNT, "desc", deadline, REVIEW_WINDOW, DISPUTE_WINDOW);
    }

    function test_Revert_OpenJob_ZeroReviewWindow() public {
        vm.prank(buyer);
        vm.expectRevert(Handshake.InvalidReviewWindow.selector);
        hs.openJob(seller, address(0), AMOUNT, "desc", deadline, 0, DISPUTE_WINDOW);
    }

    function test_Revert_OpenJob_ZeroDisputeWindow() public {
        vm.prank(buyer);
        vm.expectRevert(Handshake.InvalidDisputeWindow.selector);
        hs.openJob(seller, address(0), AMOUNT, "desc", deadline, REVIEW_WINDOW, 0);
    }

    // ─── deliver reverts ──────────────────────────────────────────────────────

    // 7. Revert: deliver after deadline
    function test_Revert_Deliver_AfterDeadline() public {
        uint256 jobId = _openJob();
        _warpPastDeadline(jobId);

        vm.prank(seller);
        vm.expectRevert(Handshake.DeadlinePassed.selector);
        hs.deliver(jobId, "ref");
    }

    // 8. Revert: deliver by non-seller
    function test_Revert_Deliver_NotSeller() public {
        uint256 jobId = _openJob();

        vm.prank(stranger);
        vm.expectRevert(Handshake.NotSeller.selector);
        hs.deliver(jobId, "ref");
    }

    function test_Revert_Deliver_WrongStatus() public {
        uint256 jobId = _openJob();
        _deliver(jobId); // status → DELIVERED

        vm.prank(seller);
        vm.expectRevert(
            abi.encodeWithSelector(
                Handshake.InvalidStatus.selector,
                Handshake.JobStatus.OPEN,
                Handshake.JobStatus.DELIVERED
            )
        );
        hs.deliver(jobId, "ref2");
    }

    // ─── release reverts ──────────────────────────────────────────────────────

    // 9. Revert: release by non-buyer
    function test_Revert_Release_NotBuyer() public {
        uint256 jobId = _openJob();
        _deliver(jobId);

        vm.prank(stranger);
        vm.expectRevert(Handshake.NotBuyer.selector);
        hs.release(jobId);
    }

    // 10. Revert: release when status is DISPUTED
    function test_Revert_Release_WhenDisputed() public {
        uint256 jobId = _openJob();
        _deliver(jobId);
        vm.prank(buyer);
        hs.dispute(jobId);

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                Handshake.InvalidStatus.selector,
                Handshake.JobStatus.DELIVERED,
                Handshake.JobStatus.DISPUTED
            )
        );
        hs.release(jobId);
    }

    // 19. Revert: double-release
    function test_Revert_Release_DoubleRelease() public {
        uint256 jobId = _openJob();
        _deliver(jobId);
        vm.prank(buyer);
        hs.release(jobId); // first release → RELEASED

        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(
                Handshake.InvalidStatus.selector,
                Handshake.JobStatus.DELIVERED,
                Handshake.JobStatus.RELEASED
            )
        );
        hs.release(jobId);
    }

    // ─── dispute reverts ──────────────────────────────────────────────────────

    // 11. Revert: dispute by non-buyer
    function test_Revert_Dispute_NotBuyer() public {
        uint256 jobId = _openJob();
        _deliver(jobId);

        vm.prank(stranger);
        vm.expectRevert(Handshake.NotBuyer.selector);
        hs.dispute(jobId);
    }

    // 12. Revert: dispute after reviewWindow elapsed
    function test_Revert_Dispute_AfterReviewWindow() public {
        uint256 jobId = _openJob();
        _deliver(jobId);
        _warpPastReviewWindow(jobId);

        vm.prank(buyer);
        vm.expectRevert(Handshake.ReviewWindowElapsed.selector);
        hs.dispute(jobId);
    }

    // ─── autoRelease reverts ─────────────────────────────────────────────────

    // 13. Revert: autoRelease before reviewWindow elapsed
    function test_Revert_AutoRelease_BeforeReviewWindow() public {
        uint256 jobId = _openJob();
        _deliver(jobId);

        vm.expectRevert(Handshake.ReviewWindowNotElapsed.selector);
        hs.autoRelease(jobId);
    }

    // ─── refund reverts ───────────────────────────────────────────────────────

    // 14. Revert: refund before deadline
    function test_Revert_Refund_BeforeDeadline() public {
        uint256 jobId = _openJob();

        vm.expectRevert(Handshake.DeadlineNotReached.selector);
        hs.refund(jobId);
    }

    // 20. Revert: refund after delivery (status is DELIVERED, not OPEN)
    function test_Revert_Refund_AfterDelivery() public {
        uint256 jobId = _openJob();
        _deliver(jobId);
        _warpPastDeadline(jobId);

        vm.expectRevert(
            abi.encodeWithSelector(
                Handshake.InvalidStatus.selector,
                Handshake.JobStatus.OPEN,
                Handshake.JobStatus.DELIVERED
            )
        );
        hs.refund(jobId);
    }

    // ─── settle reverts ───────────────────────────────────────────────────────

    // 15. Revert: settle by non-arbiter (job has no arbiter)
    function test_Revert_Settle_NoArbiterSet() public {
        uint256 jobId = _openJob(); // no arbiter → arbiter == address(0)
        _deliver(jobId);
        vm.prank(buyer);
        hs.dispute(jobId);

        vm.prank(stranger);
        vm.expectRevert(Handshake.DisputeRequiresArbiter.selector);
        hs.settle(jobId, 500e6);
    }

    // 16. Revert: settle when job has an arbiter but caller is wrong
    function test_Revert_Settle_WrongArbiter() public {
        uint256 jobId = _openJobWithArbiter();
        _deliver(jobId);
        vm.prank(buyer);
        hs.dispute(jobId);

        vm.prank(stranger);
        vm.expectRevert(Handshake.NotArbiter.selector);
        hs.settle(jobId, 500e6);
    }

    function test_Revert_Settle_ExceedsAmount() public {
        uint256 jobId = _openJobWithArbiter();
        _deliver(jobId);
        vm.prank(buyer);
        hs.dispute(jobId);

        vm.prank(arbiter);
        vm.expectRevert(Handshake.InvalidSellerShare.selector);
        hs.settle(jobId, AMOUNT + 1);
    }

    function test_Revert_Settle_StatusNotDisputed() public {
        uint256 jobId = _openJobWithArbiter();
        _deliver(jobId);
        // status is DELIVERED, not DISPUTED

        vm.prank(arbiter);
        vm.expectRevert(
            abi.encodeWithSelector(
                Handshake.InvalidStatus.selector,
                Handshake.JobStatus.DISPUTED,
                Handshake.JobStatus.DELIVERED
            )
        );
        hs.settle(jobId, 500e6);
    }

    // ─── agreeToSplit reverts ─────────────────────────────────────────────────

    function test_Revert_AgreeToSplit_HasArbiter() public {
        uint256 jobId = _openJobWithArbiter();
        _deliver(jobId);
        vm.prank(buyer);
        hs.dispute(jobId);

        vm.prank(buyer);
        vm.expectRevert(Handshake.DisputeRequiresNoArbiter.selector);
        hs.agreeToSplit(jobId, 500e6);
    }

    function test_Revert_AgreeToSplit_NotParticipant() public {
        uint256 jobId = _openJob();
        _deliver(jobId);
        vm.prank(buyer);
        hs.dispute(jobId);

        vm.prank(stranger);
        vm.expectRevert(Handshake.NotParticipant.selector);
        hs.agreeToSplit(jobId, 500e6);
    }

    // ─── expireDispute reverts ────────────────────────────────────────────────

    // 17. Revert: expireDispute before disputeDeadline elapsed
    function test_Revert_ExpireDispute_TooEarly() public {
        uint256 jobId = _openJob();
        _deliver(jobId);
        vm.prank(buyer);
        hs.dispute(jobId);

        // disputeDeadline has NOT elapsed
        vm.expectRevert(Handshake.DisputeWindowNotElapsed.selector);
        hs.expireDispute(jobId);
    }

    // ─── claim reverts ────────────────────────────────────────────────────────

    // 18. Revert: claim with nothing to claim
    function test_Revert_Claim_NothingToClaim() public {
        vm.prank(stranger);
        vm.expectRevert(Handshake.NothingToClaim.selector);
        hs.claim();
    }

    // ─── invalid jobId ────────────────────────────────────────────────────────

    function test_Revert_InvalidJobId_Zero() public {
        vm.prank(seller);
        vm.expectRevert(Handshake.InvalidJobId.selector);
        hs.deliver(0, "ref");
    }

    function test_Revert_InvalidJobId_NotYetCreated() public {
        vm.prank(seller);
        vm.expectRevert(Handshake.InvalidJobId.selector);
        hs.deliver(999, "ref");
    }
}
