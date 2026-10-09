import WorkspaceRequest from '../../models/WorkspaceRequest.js';
import AppError from '../../utils/AppError.js';
import { PRESET_KEYS, validateModuleSelection } from '../../constants/workspaceModules.constants.js';
import { BUSINESS_CATEGORIES } from '../../models/Business.js';

export const createWorkspaceRequest = async (req, res, next) => {
  try {
    const {
      entityType,
      name,
      description,
      category,
      monthlySavings,
      details,
      chairperson,
      treasurer,
      secretary,
      committeeMembers,
      extraNotes,
      workspaceConfig,
      chamaId,
    } = req.body;
    const normalizedDescription = typeof description === 'string' ? description.trim() : '';

    if (!entityType || !['chama', 'business', 'contribution_group'].includes(entityType)) {
      throw new AppError('Valid entityType (chama, business, contribution_group) is required', 400);
    }

    if (!name || !name.trim()) {
      throw new AppError('Entity name is required', 400);
    }

    if (entityType === 'chama') {
      if (!normalizedDescription) {
        throw new AppError('Please describe the Chama and the features it needs', 400);
      }
      if (normalizedDescription.length > 2000) {
        throw new AppError('Chama description must be 2,000 characters or fewer', 400);
      }
    }

    // Optional: the requester can propose which modules the chama should have
    // (a preset and/or a module list). The reviewing admin makes the final
    // call at approval time. Only meaningful for chamas.
    let proposedConfig;
    if (entityType === 'chama' && workspaceConfig && typeof workspaceConfig === 'object') {
      const modules = Array.isArray(workspaceConfig.modules) ? workspaceConfig.modules : [];
      if (modules.length > 0) {
        const result = validateModuleSelection(modules);
        if (!result.ok) {
          throw new AppError(`Workspace modules are not valid: ${result.errors.join('; ')}`, 400);
        }
        proposedConfig = {
          preset: PRESET_KEYS.includes(workspaceConfig.preset) ? workspaceConfig.preset : 'custom',
          modules: result.enabled,
        };
      }
    }

    // Chama-owned businesses are NOT requested here. They go through the
    // Leadership Desk endpoint (POST /chamas/:chamaId/business-workspace-requests),
    // which enforces the chairperson/treasurer role, a leadership session and a
    // PIN step-up. This endpoint only files personal business requests.
    let resolvedCategory = String(category || 'standard').trim();
    if (entityType === 'business') {
      if (chamaId) {
        throw new AppError(
          'A chama business must be requested by the chairperson or treasurer from the chama Leadership Desk',
          400
        );
      }
      const wanted = String(category || '').trim().toLowerCase();
      resolvedCategory = BUSINESS_CATEGORIES.includes(wanted) ? wanted : 'other';
    } else if (chamaId) {
      throw new AppError('chamaId only applies to business requests', 400);
    }
    if (entityType === 'chama') {
      const chamaType = String(category || 'standard').trim().toLowerCase();
      if (!['standard', 'burial'].includes(chamaType)) {
        throw new AppError('Chama type must be standard or burial', 400);
      }
      resolvedCategory = chamaType;
    }

    // NOTE: the requester only ever submits a *request*. Approving it (see
    // admin.service.js:approveWorkspaceRequest) provisions the chairperson/
    // treasurer/secretary named below as the actual owners/members of the
    // new workspace — the reviewing platform admin is recorded solely as
    // `reviewedBy` on the request and is never added as a member.
    const requesterIsAdmin = ['super_admin', 'sub_admin'].includes(req.user?.systemRole);

    const newRequest = await WorkspaceRequest.create({
      requestedBy: req.user._id,
      entityType,
      name: name.trim(),
      description: normalizedDescription,
      category: resolvedCategory,
      ownerType: 'user',
      monthlySavings: Number(monthlySavings) || 1000,
      ...(proposedConfig && { workspaceConfig: proposedConfig }),
      details: details && typeof details === 'object' ? details : undefined,
      // A normal requester is the chairperson unless they name someone else.
      // A platform admin filing on someone's behalf is not: their own details
      // are never pre-filled, so they can't become the chairperson by default.
      chairperson: {
        fullName: chairperson?.fullName || (requesterIsAdmin ? '' : req.user.name) || '',
        phone: chairperson?.phone || (requesterIsAdmin ? '' : req.user.phone) || '',
        email: chairperson?.email || (requesterIsAdmin ? '' : req.user.email) || '',
        idNumber: chairperson?.idNumber || '',
      },
      treasurer: {
        fullName: treasurer?.fullName || '',
        phone: treasurer?.phone || '',
        email: treasurer?.email || '',
        idNumber: treasurer?.idNumber || '',
      },
      secretary: {
        fullName: secretary?.fullName || '',
        phone: secretary?.phone || '',
        email: secretary?.email || '',
        idNumber: secretary?.idNumber || '',
      },
      committeeMembers: Array.isArray(committeeMembers)
        ? committeeMembers.map((cm) => ({
            role: cm?.role || 'Committee Member',
            fullName: cm?.fullName || '',
            phone: cm?.phone || '',
            email: cm?.email || '',
            idNumber: cm?.idNumber || '',
          }))
        : [],
      applicantNotes: (extraNotes || '').trim(),
      // status intentionally omitted — the schema default ('PENDING') already
      // matches the enum; hardcoding a lowercase 'pending' here was the
      // cause of the ValidationError.
    });

    res.status(201).json({
      success: true,
      message: 'Workspace request submitted successfully! An administrator will review and create your workspace.',
      data: newRequest,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyWorkspaceRequests = async (req, res, next) => {
  try {
    const requests = await WorkspaceRequest.find({ requestedBy: req.user._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    next(error);
  }
};
