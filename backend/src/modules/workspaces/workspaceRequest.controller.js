import WorkspaceRequest from '../../models/WorkspaceRequest.js';
import AppError from '../../utils/AppError.js';
import { PRESET_KEYS, validateModuleSelection, sanitizeModuleLabels } from '../../constants/workspaceModules.constants.js';
import { isOrganizationTypeValid } from '../../constants/organizationTypes.constants.js';
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
      organizationFamily = 'chama',
      organizationType = 'custom',
      chamaId,
      contributionGroupDetails,
    } = req.body;
    const normalizedDescription = typeof description === 'string' ? description.trim() : '';

    if (!entityType || !['chama', 'business', 'contribution_group'].includes(entityType)) {
      throw new AppError('Valid entityType (chama, business, contribution_group) is required', 400);
    }

    let normalizedContributionDetails;
    let riskFlags = [];
    if (entityType === 'contribution_group') {
      if (!req.user?.isPhoneVerified) throw new AppError('Verify your phone number before requesting a fundraiser.', 403);
      const pendingRequest = await WorkspaceRequest.findOne({
        requestedBy: req.user._id,
        entityType: 'contribution_group',
        status: { $in: ['PENDING', 'UNDER_REVIEW'] },
      }).select('_id requestNumber');
      if (pendingRequest) throw new AppError(`You already have a contribution-group request under review (${pendingRequest.requestNumber}).`, 409);

      const input = contributionGroupDetails && typeof contributionGroupDetails === 'object' ? contributionGroupDetails : {};
      const strictPublicReview = Boolean(input.publicGivingRequested);
      const validTypes = ['party', 'wedding', 'graduation', 'funeral', 'birthday', 'emergency', 'medical_emergency', 'fundraiser', 'community', 'other'];
      const validVisibility = ['private', 'invite_only', 'public'];
      const targetAmount = Number(input.targetAmount ?? 0);
      if (!validTypes.includes(input.type || 'other')) throw new AppError('Choose a valid fundraiser category.', 400);
      if (!Number.isFinite(targetAmount) || targetAmount < 0) throw new AppError('Fundraising goal must be zero or more.', 400);
      if (!validVisibility.includes(input.visibility || 'invite_only')) throw new AppError('Choose a valid contribution-group visibility.', 400);
      if (!input.nationalIdNumber || String(input.nationalIdNumber).trim().length < 5) throw new AppError('Enter the organizer’s national ID number for verification.', 400);
      const evidence = Array.isArray(input.evidence) ? input.evidence.filter((item) => item?.url && /^https:\/\//i.test(item.url)).slice(0, 8) : [];
      if (strictPublicReview && evidence.length === 0) throw new AppError('Public-giving requests require supporting evidence.', 400);
      const referees = Array.isArray(input.referees) ? input.referees.filter((item) => item?.name && item?.phone).slice(0, 2) : [];
      if (strictPublicReview && referees.length < 2) throw new AppError('Public-giving requests require two referees with names and phone numbers.', 400);
      const payout = input.payout && typeof input.payout === 'object' ? input.payout : {};
      if (!['mpesa', 'paybill', 'till', 'bank'].includes(payout.method) || !payout.accountName) throw new AppError('Provide a payout method and the registered account name.', 400);
      if (payout.method === 'mpesa' && !payout.phone) throw new AppError('Provide the M-Pesa payout phone number.', 400);
      if (['paybill', 'till', 'bank'].includes(payout.method) && !payout.paybill) throw new AppError('Provide the payout account or paybill number.', 400);
      for (const [field, label] of [['eventDate', 'event date'], ['contributionEndDate', 'contribution close date']]) {
        if (input[field] && Number.isNaN(new Date(input[field]).getTime())) throw new AppError(`Enter a valid ${label}.`, 400);
      }
      if (input.contributionEndDate && new Date(input.contributionEndDate) <= new Date()) throw new AppError('The contribution close date must be in the future.', 400);
      const nationalIdNumber = String(input.nationalIdNumber).trim();
      const beneficiary = String(input.beneficiary || '').trim();
      const duplicateQuery = {
        entityType: 'contribution_group',
        requestedBy: { $ne: req.user._id },
        status: { $ne: 'CANCELLED' },
        $or: [
          { 'contributionGroupDetails.nationalIdNumber': nationalIdNumber },
          ...(payout.phone ? [{ 'contributionGroupDetails.payout.phone': String(payout.phone).trim() }] : []),
          ...(beneficiary ? [{ 'contributionGroupDetails.beneficiary': beneficiary }] : []),
        ],
      };
      const possibleDuplicate = await WorkspaceRequest.exists(duplicateQuery);
      if (possibleDuplicate) riskFlags.push('POTENTIAL_DUPLICATE_ID_PAYOUT_OR_BENEFICIARY');
      normalizedContributionDetails = {
        type: input.type || 'other', targetAmount,
        eventDate: input.eventDate || null, contributionEndDate: input.contributionEndDate || null,
        beneficiary, location: String(input.location || '').trim(), visibility: input.visibility || 'invite_only',
        nationalIdNumber, evidence,
        referees: referees.map((item) => ({ name: String(item.name).trim(), phone: String(item.phone).trim(), relationship: String(item.relationship || '').trim() })),
        payout: { method: payout.method, phone: String(payout.phone || '').trim(), paybill: String(payout.paybill || '').trim(), accountName: String(payout.accountName).trim() },
        publicGivingRequested: Boolean(input.publicGivingRequested),
      };
    }

    if (!name || !name.trim()) {
      throw new AppError('Entity name is required', 400);
    }
    if (entityType === 'contribution_group' && (name.trim().length > 100 || normalizedDescription.length > 1000)) {
      throw new AppError('Fundraiser name must be 100 characters or fewer and its description 1,000 characters or fewer.', 400);
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
          moduleLabels: sanitizeModuleLabels(workspaceConfig.moduleLabels),
        };
      }
    }
    if (entityType === 'chama' && !isOrganizationTypeValid(organizationFamily, organizationType)) {
      throw new AppError('Choose a valid organization family (chama, sacco, cooperative) and type.', 400);
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
      ...(entityType === 'chama' && { organizationFamily, organizationType }),
      ...(entityType === 'contribution_group' && { contributionGroupDetails: normalizedContributionDetails, riskFlags }),
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

export const updateMyContributionGroupRequest = async (req, res, next) => {
  try {
    const request = await WorkspaceRequest.findOne({
      _id: req.params.requestId,
      requestedBy: req.user._id,
      entityType: 'contribution_group',
      status: 'UNDER_REVIEW',
    });
    if (!request) throw new AppError('No contribution-group request awaiting your update was found.', 404);
    if (!req.user?.isPhoneVerified) throw new AppError('Verify your phone number before updating this request.', 403);

    const { name, description, contributionGroupDetails: input = {} } = req.body || {};
    const cleanName = String(name || '').trim();
    const cleanDescription = String(description || '').trim();
    if (cleanName.length < 2 || cleanName.length > 100) throw new AppError('Fundraiser name must be between 2 and 100 characters.', 400);
    if (!cleanDescription || cleanDescription.length > 1000) throw new AppError('Describe the fundraiser in 1,000 characters or fewer.', 400);
    const validTypes = ['party', 'wedding', 'graduation', 'funeral', 'birthday', 'emergency', 'medical_emergency', 'fundraiser', 'community', 'other'];
    const validVisibility = ['private', 'invite_only', 'public'];
    const targetAmount = Number(input.targetAmount ?? 0);
    if (!validTypes.includes(input.type) || !validVisibility.includes(input.visibility)) throw new AppError('Choose a valid fundraiser category and visibility.', 400);
    if (!Number.isFinite(targetAmount) || targetAmount < 0) throw new AppError('Fundraising goal must be zero or more.', 400);
    const evidence = Array.isArray(input.evidence) ? input.evidence.filter((item) => item?.url && /^https:\/\//i.test(item.url)).slice(0, 8) : [];
    const referees = Array.isArray(input.referees) ? input.referees.filter((item) => item?.name && item?.phone).slice(0, 2) : [];
    const payout = input.payout && typeof input.payout === 'object' ? input.payout : {};
    if (!String(input.nationalIdNumber || '').trim() || !payout.accountName) throw new AppError('Organizer ID and payout details are required.', 400);
    if (input.publicGivingRequested && (evidence.length === 0 || referees.length < 2)) throw new AppError('Public-giving requests require supporting evidence and two referees.', 400);
    if (!['mpesa', 'paybill', 'till', 'bank'].includes(payout.method)) throw new AppError('Choose a valid payout method.', 400);
    if (payout.method === 'mpesa' && !payout.phone) throw new AppError('Provide the M-Pesa payout phone number.', 400);
    if (payout.method !== 'mpesa' && !payout.paybill) throw new AppError('Provide the payout account or paybill number.', 400);
    for (const [field, label] of [['eventDate', 'event date'], ['contributionEndDate', 'contribution close date']]) {
      if (input[field] && Number.isNaN(new Date(input[field]).getTime())) throw new AppError(`Enter a valid ${label}.`, 400);
    }
    if (input.contributionEndDate && new Date(input.contributionEndDate) <= new Date()) throw new AppError('The contribution close date must be in the future.', 400);

    request.name = cleanName;
    request.description = cleanDescription;
    request.contributionGroupDetails = {
      ...input,
      type: input.type,
      targetAmount,
      eventDate: input.eventDate || null,
      contributionEndDate: input.contributionEndDate || null,
      beneficiary: String(input.beneficiary || '').trim(),
      location: String(input.location || '').trim(),
      nationalIdNumber: String(input.nationalIdNumber).trim(),
      evidence,
      referees,
      payout,
      publicGivingRequested: Boolean(input.publicGivingRequested),
    };
    request.status = 'PENDING';
    request.adminNotes = '';
    request.auditTrail.push({ action: 'RESUBMITTED', performedBy: req.user._id, performedAt: new Date(), notes: 'Requester supplied additional information for review.' });
    await request.save();
    res.status(200).json({ success: true, message: 'Your updated information has been submitted for review.', data: request });
  } catch (error) {
    next(error);
  }
};
