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
    const adminEmail = (env.superAdminEmail || 'nicholasmuinde26@gmail.com').trim().toLowerCase();
    if (!adminEmail) return;

    let user = await User.findOne({ email: adminEmail });

    const defaultPhone = process.env.SUPER_ADMIN_PHONE || '254700000000';
    const defaultPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123456';

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
      const isDev = process.env.NODE_ENV === 'development' || env?.nodeEnv === 'development';
      if (isDev) {
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
      { upsert: true, new: true }
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
