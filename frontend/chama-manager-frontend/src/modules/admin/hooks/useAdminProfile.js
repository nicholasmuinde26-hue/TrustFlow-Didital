import { useEffect, useState } from 'react';
import adminService from '../services/admin.service';

// The server is the source of truth for category and permissions. Keeping
// this out of the login token prevents a stale client from rendering a
// workspace after a super-admin changes an appointment.
export default function useAdminProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    adminService.getMyProfile()
      .then((next) => active && setProfile(next))
      .catch(() => active && setProfile(null))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return { profile, loading };
}
