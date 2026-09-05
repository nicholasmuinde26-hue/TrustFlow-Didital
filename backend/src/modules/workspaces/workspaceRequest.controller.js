import WorkspaceRequest from '../../models/WorkspaceRequest.js';
import AppError from '../../utils/AppError.js';

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
    } = req.body;

    if (!entityType || !['chama', 'business', 'contribution_group'].includes(entityType)) {
      throw new AppError('Valid entityType (chama, business, contribution_group) is required', 400);
    }

    if (!name || !name.trim()) {
      throw new AppError('Entity name is required', 400);
    }

    // NOTE: the requester only ever submits a *request*. Approving it (see
    // admin.service.js:approveWorkspaceRequest) provisions the chairperson/
    // treasurer/secretary named below as the actual owners/members of the
    // new workspace — the reviewing platform admin is recorded solely as
    // `reviewedBy` on the request and is never added as a member.
    const newRequest = await WorkspaceRequest.create({
      requestedBy: req.user._id,
      entityType,
      name: name.trim(),
      description: (description || '').trim(),
      category: (category || 'standard').trim(),
      monthlySavings: Number(monthlySavings) || 1000,
      details: details && typeof details === 'object' ? details : undefined,
      chairperson: {
        fullName: chairperson?.fullName || req.user.name || '',
        phone: chairperson?.phone || req.user.phone || '',
        email: chairperson?.email || req.user.email || '',
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