import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../src/models/User.js";
import Chama from "../src/models/Chama.js";
import ChamaMembership from "../src/models/ChamaMembership.js";
import ContributionGroup from "../src/models/ContributionGroup.js";
import ContributionGroupMember from "../src/models/ContributionGroupMember.js";
import Business from "../src/models/Business.js";
import Announcement from "../src/models/Announcement.js";
import {
  createAnnouncement,
  listAnnouncements,
  togglePinAnnouncement,
  deleteAnnouncement,
} from "../src/modules/announcements/announcement.controller.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/NewRealitiesChama?retryWrites=false";

// Helper to create express-like mock response
function mockResponse() {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
}

// Helper to run the express middleware/controllers and return results/errors
async function runController(controllerFn, req) {
  const res = mockResponse();
  let nextCalledWithError = null;
  const next = (err) => {
    nextCalledWithError = err;
  };

  await controllerFn(req, res, next);

  if (nextCalledWithError) {
    throw nextCalledWithError;
  }
  return res;
}

async function runTests() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected successfully.\n");

  let testUser1, testUser2;
  let chama, membershipAdmin, membershipMember;
  let contributionGroup, cgMembershipAdmin, cgMembershipMember;
  let business;

  try {
    // 1. SETUP DUMMY DATA
    console.log("Setting up mock database records...");
    testUser1 = await User.create({
      name: "Admin User",
      email: "admin@test.com",
      password: "password123",
      phone: "+254700000001",
      status: "active",
      isPhoneVerified: true,
    });

    testUser2 = await User.create({
      name: "Regular Member",
      email: "member@test.com",
      password: "password123",
      phone: "+254700000002",
      status: "active",
      isPhoneVerified: true,
    });

    // CHAMA SETUP
    chama = await Chama.create({
      name: "Test Trust Chama",
      monthly_savings: 1000,
      created_by: testUser1._id,
      status: "active",
    });

    // Admin user is chairperson (allowed to manage announcements)
    membershipAdmin = await ChamaMembership.create({
      user_id: testUser1._id,
      chama_id: chama._id,
      role: "chairperson",
      status: "active",
    });

    // Regular user is normal member (read-only)
    membershipMember = await ChamaMembership.create({
      user_id: testUser2._id,
      chama_id: chama._id,
      role: "member",
      status: "active",
    });

    // CONTRIBUTION GROUP SETUP
    contributionGroup = await ContributionGroup.create({
      name: "Wedding Contribution Group",
      type: "wedding",
      created_by: testUser1._id,
      status: "active",
    });

    cgMembershipAdmin = await ContributionGroupMember.create({
      user_id: testUser1._id,
      contribution_group_id: contributionGroup._id,
      role: "organizer",
      status: "active",
    });

    cgMembershipMember = await ContributionGroupMember.create({
      user_id: testUser2._id,
      contribution_group_id: contributionGroup._id,
      role: "member",
      status: "active",
    });

    // BUSINESS SETUP (owned by testUser1)
    business = await Business.create({
      name: "Fast Growth Shop",
      created_by: testUser1._id,
    });

    console.log("Mock data setup completed.\n");

    // =========================================================================
    // TEST CASE 1: CHAMA ANNOUNCEMENT POSTING & TASTES
    // =========================================================================
    console.log("Running Test Case 1: Chama Announcements...");

    // A. Verify that member cannot post
    const req1A = {
      params: { workspaceId: chama._id.toString() },
      user: testUser2,
      body: { title: "Invalid Post", content: "Should fail" },
    };
    try {
      await runController(createAnnouncement, req1A);
      throw new Error("TC1A Failed: Member was allowed to post chama announcement");
    } catch (err) {
      if (err.statusCode === 403) {
        console.log("  ✓ Correctly blocked member from posting to Chama");
      } else {
        throw err;
      }
    }

    // B. Verify that chama details validation checks for transparencyReason
    const req1B = {
      params: { workspaceId: chama._id.toString() },
      user: testUser1,
      body: {
        title: "Transparency Announcement",
        content: "We are releasing funds for transparency test.",
        // missing chamaDetails
      },
    };
    try {
      await runController(createAnnouncement, req1B);
      throw new Error("TC1B Failed: Posted chama announcement without transparency reason");
    } catch (err) {
      if (err.statusCode === 400 && err.message.includes("transparency reason")) {
        console.log("  ✓ Correctly rejected missing transparencyReason");
      } else {
        throw err;
      }
    }

    // C. Verify successful chama post with correct taste fields
    const req1C = {
      params: { workspaceId: chama._id.toString() },
      user: testUser1,
      body: {
        title: "Chama Transparency Update",
        content: "This is our transparent monthly update.",
        chamaDetails: {
          transparencyReason: "To align with our trust and transparency goals of the quarter.",
          financialImpact: "Allocation of KES 50,000 to emergency reserve.",
          consensusVoted: true,
          consensusLink: "https://chama-decisions.org/vote-123",
        },
      },
    };
    const res1C = await runController(createAnnouncement, req1C);
    if (
      res1C.body.success &&
      res1C.body.data.announcement.chamaDetails.transparencyReason === req1C.body.chamaDetails.transparencyReason &&
      res1C.body.data.announcement.chamaDetails.consensusVoted === true
    ) {
      console.log("  ✓ Successfully created Chama announcement with trust & transparency goals!");
    } else {
      throw new Error("TC1C Failed to create Chama announcement");
    }

    // =========================================================================
    // TEST CASE 2: CONTRIBUTION GROUP ANNOUNCEMENT POSTING & TASTES
    // =========================================================================
    console.log("\nRunning Test Case 2: Contribution Group Announcements...");

    // A. Verify validation of penalty details
    const req2A = {
      params: { workspaceId: contributionGroup._id.toString() },
      user: testUser1,
      body: {
        title: "Action Plan",
        content: "Deadline is next week.",
        contributionDetails: {
          deadline: new Date(Date.now() + 86400000 * 7),
          // missing penaltyDetails
        },
      },
    };
    try {
      await runController(createAnnouncement, req2A);
      throw new Error("TC2A Failed: Posted CG announcement without penalty details");
    } catch (err) {
      if (err.statusCode === 400 && err.message.includes("penalty details")) {
        console.log("  ✓ Correctly rejected missing penalty details");
      } else {
        throw err;
      }
    }

    // B. Verify successful post with CG accountability/clarity details
    const req2B = {
      params: { workspaceId: contributionGroup._id.toString() },
      user: testUser1,
      body: {
        title: "Strict Wedding Budget Contribution",
        content: "All wedding contributions must be updated by the weekend.",
        contributionDetails: {
          deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
          penaltyDetails: "Late fees of 5% applied after Saturday midnight. No exceptions.",
          actionItems: ["Jack: follow up with caterer", "Jill: complete M-Pesa setup"],
          accountabilityChecklist: ["Verify payment receipt", "Log transaction reference"],
        },
      },
    };
    const res2B = await runController(createAnnouncement, req2B);
    if (
      res2B.body.success &&
      res2B.body.data.announcement.contributionDetails.penaltyDetails.includes("Late fees") &&
      res2B.body.data.announcement.contributionDetails.actionItems.length === 2
    ) {
      console.log("  ✓ Successfully created Contribution Group announcement with clarity & accountability fields!");
    } else {
      throw new Error("TC2B Failed to create Contribution Group announcement");
    }

    // =========================================================================
    // TEST CASE 3: BUSINESS ANNOUNCEMENT POSTING & TASTES
    // =========================================================================
    console.log("\nRunning Test Case 3: Business Announcements...");

    // A. Verify block for non-owner
    const req3A = {
      params: { workspaceId: business._id.toString() },
      user: testUser2, // testUser2 does not own the business
      body: {
        title: "Corporate Resolution",
        content: "Opening new branch.",
        businessDetails: {
          decisionMade: "Expand to Nairobi CBD.",
          authorizedBy: "Board of Directors",
        },
      },
    };
    try {
      await runController(createAnnouncement, req3A);
      throw new Error("TC3A Failed: Non-owner posted to Business workspace");
    } catch (err) {
      if (err.statusCode === 403) {
        console.log("  ✓ Correctly blocked unauthorized user from Business workspace");
      } else {
        throw err;
      }
    }

    // B. Verify successful post with business growth/compliance details
    const req3B = {
      params: { workspaceId: business._id.toString() },
      user: testUser1,
      body: {
        title: "Q3 Expansion & Compliance Resolution",
        content: "Board resolution concerning business operations expansion.",
        businessDetails: {
          decisionMade: "Authorize rent budget for CBD branch.",
          growthMetrics: "Targeting 25% revenue increase in retail channels.",
          complianceReference: "Section 7.3 of Company Regulations 2026",
          authorizedBy: "Board of Directors and General Manager",
        },
      },
    };
    const res3B = await runController(createAnnouncement, req3B);
    if (
      res3B.body.success &&
      res3B.body.data.announcement.businessDetails.authorizedBy === "Board of Directors and General Manager" &&
      res3B.body.data.announcement.businessDetails.complianceReference === "Section 7.3 of Company Regulations 2026"
    ) {
      console.log("  ✓ Successfully created Business announcement with decision, growth, and compliance details!");
    } else {
      throw new Error("TC3B Failed to create Business announcement");
    }

    // =========================================================================
    // TEST CASE 4: LISTING & PINNING LOGIC
    // =========================================================================
    console.log("\nRunning Test Case 4: Listing & Pinning logic...");

    // Add another Chama announcement to test pinning/sorting
    const req4Setup = {
      params: { workspaceId: chama._id.toString() },
      user: testUser1,
      body: {
        title: "Older Chama Announcement",
        content: "Some older details.",
        chamaDetails: {
          transparencyReason: "Older transparency reason.",
        },
      },
    };
    const res4Setup = await runController(createAnnouncement, req4Setup);
    const olderAnnId = res4Setup.body.data.announcement.id;

    // Pin the older announcement
    const req4Pin = {
      params: { workspaceId: chama._id.toString(), announcementId: olderAnnId.toString() },
      user: testUser1,
    };
    const res4Pin = await runController(togglePinAnnouncement, req4Pin);
    if (res4Pin.body.success && res4Pin.body.data.announcement.isPinned === true) {
      console.log("  ✓ Successfully toggled isPinned to true for older announcement");
    } else {
      throw new Error("TC4 Pin Toggle Failed");
    }

    // Retrieve the list and assert the pinned one comes first despite being older
    const req4List = {
      params: { workspaceId: chama._id.toString() },
      user: testUser2, // normal members can read
    };
    const res4List = await runController(listAnnouncements, req4List);
    const announcementsList = res4List.body.data.announcements;

    if (announcementsList.length === 2 && announcementsList[0].id.toString() === olderAnnId.toString()) {
      console.log("  ✓ Correctly sorted pinned announcement to the top!");
    } else {
      throw new Error("TC4 Listing/Pin Sorting Failed");
    }

    // =========================================================================
    // TEST CASE 5: DELETION
    // =========================================================================
    console.log("\nRunning Test Case 5: Deletion...");

    const req5Del = {
      params: { workspaceId: chama._id.toString(), announcementId: olderAnnId.toString() },
      user: testUser1,
    };
    const res5Del = await runController(deleteAnnouncement, req5Del);
    if (res5Del.body.success && res5Del.body.message.includes("deleted")) {
      console.log("  ✓ Successfully deleted announcement");
    } else {
      throw new Error("TC5 Deletion Failed");
    }

    // Verify it is gone from the list
    const res5List = await runController(listAnnouncements, req4List);
    if (res5List.body.data.announcements.length === 1) {
      console.log("  ✓ Verified announcement is no longer in the workspace");
    } else {
      throw new Error("TC5 Verification of deletion failed");
    }

    console.log("\nALL TESTS PASSED SUCCESSFULLY! 🎉");
  } catch (error) {
    console.error("\n❌ TEST RUN ENCOUNTERED AN ERROR:");
    console.error(error);
  } finally {
    // 2. CLEAN UP DUMMY DATA
    console.log("\nCleaning up test database records...");
    if (testUser1) await User.deleteOne({ _id: testUser1._id });
    if (testUser2) await User.deleteOne({ _id: testUser2._id });
    if (chama) {
      await Chama.deleteOne({ _id: chama._id });
      await ChamaMembership.deleteMany({ chama_id: chama._id });
    }
    if (contributionGroup) {
      await ContributionGroup.deleteOne({ _id: contributionGroup._id });
      await ContributionGroupMember.deleteMany({ contribution_group_id: contributionGroup._id });
    }
    if (business) {
      await Business.deleteOne({ _id: business._id });
    }
    await Announcement.deleteMany({ workspace_id: { $in: [chama?._id, contributionGroup?._id, business?._id] } });

    console.log("Cleanup complete. Disconnecting Mongoose...");
    await mongoose.disconnect();
    console.log("Mongoose disconnected. Exit.");
  }
}

runTests();
