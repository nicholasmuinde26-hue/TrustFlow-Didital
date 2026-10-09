import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import PlatformAdmin from '../models/PlatformAdmin.js';
import env from './env.js';

/**
 * Ensures the configured Super Admin account exists and has systemRole: 'super_admin'.
 * Creates the user with default credentials if not present in the database.
 * Runs automatically upon database connection.
 */
export async function bootstrapSuperAdmin() {
  try {
    // No hardcoded fallback email. This function grants super_admin to
    // whatever address it's given, so a personal address baked into
    // source meant every deployment built from this codebase shipped
    // with the same backdoor owner.
    const adminEmail = (env.superAdminEmail || '').trim().toLowerCase();

    if (!adminEmail) {
      console.log('[BOOTSTRAP] SUPER_ADMIN_EMAIL not set — skipping super admin bootstrap.');
      return;
    }

    const defaultPhone = process.env.SUPER_ADMIN_PHONE || '254700000000';
    const defaultPassword = process.env.SUPER_ADMIN_PASSWORD;

    // This used to auto-create a super_admin with the password
    // 'Admin@123456' on every boot, in every environment. Anyone who
    // knew the email (it was in this file) or the default phone owned
    // the platform. Production now requires an explicitly chosen
    // password and refuses to invent one.
    if (!defaultPassword) {
      if (env.isProduction) {
        console.error(
          '[BOOTSTRAP] SUPER_ADMIN_PASSWORD is not set — refusing to create or ' +
            'sync a super admin account with a default password. Set it and restart.'
        );
        return;
      }
      console.warn('[BOOTSTRAP] SUPER_ADMIN_PASSWORD not set — skipping bootstrap in non-production.');
      return;
    }

    // A short password on the single most privileged account in the
    // system is not worth failing quietly over.
    if (defaultPassword.length < 12) {
      console.error('[BOOTSTRAP] SUPER_ADMIN_PASSWORD must be at least 12 characters. Skipping.');
      return;
    }

    let user = await User.findOne({ email: adminEmail });

    if (!user) {
      // Check if phone exists
      user = await User.findOne({ phone: defaultPhone });
    }

    if (user) {
      let modified = false;
      if (user.systemRole !== 'super_admin') {
        user.systemRole = 'super_admin';
        modified = true;
      }
      if (user.status !== 'active') {
        user.status = 'active';
        modified = true;
      }
      if (!user.isPhoneVerified) {
        user.isPhoneVerified = true;
        modified = true;
      }
      if (!user.email) {
        user.email = adminEmail;
        modified = true;
      }
      // Ensure password is set to defaultPassword if user has no password or on localhost dev
      // Only ever resets an existing account's password outside
      // production. Silently overwriting a live super admin's password
      // on every deploy would undo any rotation they performed.
      if (!env.isProduction) {
        user.password = await bcrypt.hash(defaultPassword, 10);
        modified = true;
      }
      if (modified) {
        await user.save();
        console.log(`[BOOTSTRAP] Promoted existing account ${adminEmail} to super_admin (password synced).`);
      } else {
        console.log(`[BOOTSTRAP] Super Admin account verified: ${adminEmail}`);
      }
    } else {
      // Auto-create Super Admin
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);
      user = await User.create({
        name: 'Super Administrator',
        email: adminEmail,
        phone: defaultPhone,
        password: hashedPassword,
        systemRole: 'super_admin',
        status: 'active',
        isPhoneVerified: true,
      });

      console.log(`[BOOTSTRAP] Created default Super Admin user: ${adminEmail}`);
    }

    // Ensure PlatformAdmin record exists with all permissions
    await PlatformAdmin.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        adminRole: 'SUPER_ADMIN',
        status: 'ACTIVE',
        permissions: {
          users: true,
          chamas: true,
          businesses: true,
          contributionGroups: true,
          finance: true,
          auditLogs: true,
          settings: true,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    console.log(`
=======================================================
 [SUPER ADMIN READY FOR LOCALHOST / ADMIN LOGIN]
 Email    : ${adminEmail}
 Phone    : ${user.phone}
 Password : ${defaultPassword}
 Dev OTP  : 123456 (or use any generated code)
=======================================================
`);
  } catch (error) {
    console.error('[BOOTSTRAP] Error verifying Super Admin:', error.message);
  }
}