import express from 'express';
import committeeService from './committee.service.js';
import { protect } from '../../middleware/auth.middleware.js';
import { requireChamaMember, requireChamaChairperson } from '../../middleware/chama.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';

const router = express.Router();

// ========================================
// COMMITTEE MANAGEMENT ROUTES
// ========================================

/**
 * @route   POST /api/committees
 * @desc    Create a new committee
 * @access  Private (Chairperson only)
 */
router.post('/', protect, requireChamaChairperson, requirePermission('roles.assign'), async (req, res) => {
  try {
    const {
      chamaId,
      committeeType,
      name,
      description,
      chairpersonId,
      memberIds,
      settings
    } = req.body;

    const committee = await committeeService.createCommittee({
      chamaId,
      committeeType,
      name,
      description,
      chairpersonId,
      memberIds,
      settings,
      createdBy: req.membership._id
    });

    res.status(201).json({
      success: true,
      message: 'Committee created successfully',
      data: committee
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/committees/chama/:chamaId
 * @desc    Get all committees for a chama
 * @access  Private (Chama members)
 */
router.get('/chama/:chamaId', protect, requireChamaMember, requirePermission('roles.view'), async (req, res) => {
  try {
    const committees = await committeeService.getChamaCommittees(req.params.chamaId);

    res.json({
      success: true,
      data: committees
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/committees/:committeeId
 * @desc    Get committee details
 * @access  Private (Chama members)
 */
router.get('/:committeeId', protect, requireChamaMember, requirePermission('roles.view'), async (req, res) => {
  try {
    const committee = await committeeService.getCommittee(req.params.committeeId);

    res.json({
      success: true,
      data: committee
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/committees/:committeeId/members
 * @desc    Add member to committee
 * @access  Private (Chairperson only)
 */
router.post('/:committeeId/members', protect, requireChamaChairperson, requirePermission('roles.assign'), async (req, res) => {
  try {
    const { membershipId, role } = req.body;

    const committee = await committeeService.addMember(
      req.params.committeeId,
      membershipId,
      role || 'member',
      req.membership._id
    );

    res.json({
      success: true,
      message: 'Member added to committee successfully',
      data: committee
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   DELETE /api/committees/:committeeId/members/:membershipId
 * @desc    Remove member from committee
 * @access  Private (Chairperson only)
 */
router.delete('/:committeeId/members/:membershipId', protect, requireChamaChairperson, requirePermission('roles.remove'), async (req, res) => {
  try {
    const committee = await committeeService.removeMember(
      req.params.committeeId,
      req.params.membershipId,
      req.membership._id
    );

    res.json({
      success: true,
      message: 'Member removed from committee successfully',
      data: committee
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   PATCH /api/committees/:committeeId/chairperson
 * @desc    Update committee chairperson
 * @access  Private (Chairperson only)
 */
router.patch('/:committeeId/chairperson', protect, requireChamaChairperson, requirePermission('roles.assign'), async (req, res) => {
  try {
    const { newChairpersonId } = req.body;

    const committee = await committeeService.updateChairperson(
      req.params.committeeId,
      newChairpersonId,
      req.membership._id
    );

    res.json({
      success: true,
      message: 'Chairperson updated successfully',
      data: committee
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/committees/:committeeId/dissolve
 * @desc    Dissolve committee
 * @access  Private (Chairperson only)
 */
router.post('/:committeeId/dissolve', protect, requireChamaChairperson, requirePermission('roles.remove'), async (req, res) => {
  try {
    const { reason } = req.body;

    const committee = await committeeService.dissolveCommittee(
      req.params.committeeId,
      req.membership._id,
      reason || ''
    );

    res.json({
      success: true,
      message: 'Committee dissolved successfully',
      data: committee
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/committees/:committeeId/quorum
 * @desc    Check committee quorum status
 * @access  Private (Chama members)
 */
router.get('/:committeeId/quorum', protect, requireChamaMember, requirePermission('roles.view'), async (req, res) => {
  try {
    const quorumStatus = await committeeService.checkQuorum(req.params.committeeId);

    res.json({
      success: true,
      data: quorumStatus
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/committees/membership/:membershipId
 * @desc    Get committees for a membership
 * @access  Private
 */
router.get('/membership/:membershipId', protect, async (req, res) => {
  try {
    // Only allow users to see their own committees
    if (String(req.membership._id) !== String(req.params.membershipId)) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own committee assignments'
      });
    }

    const committees = await committeeService.getMembershipCommittees(req.params.membershipId);

    res.json({
      success: true,
      data: committees
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

export default router;