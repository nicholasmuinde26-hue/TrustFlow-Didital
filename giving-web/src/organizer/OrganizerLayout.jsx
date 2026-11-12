import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Heart, LoaderCircle, LogOut } from 'lucide-react';
import { useOrganizerAuth } from './AuthContext.jsx';

export function Brand() {
  return <Link className="brand" to="/"><span className="brand-mark"><Heart size={17} fill="currentColor" /></span> GiveTogether</Link>;
}

/** Signed-in area: sends anonymous visitors to the giving web's own login. */
export function RequireOrganizer() {
  const { isAuthenticated, loading, user, logout } = useOrganizerAuth();
  const location = useLocation();
  const navigate = useNavigate();
  if (loading) return <main className="center-state"><LoaderCircle className="spin" size={32} /><span>Opening your workspace…</span></main>;
  if (!isAuthenticated) return <Navigate to="/organizer/login" replace state={{ from: location }} />;
  return (
    <main className="org-shell">
      <nav className="topbar">
        <Brand />
        <div className="org-userbar">
          <span className="org-user">{user?.name || user?.phone || 'Organizer'}</span>
          <button type="button" className="org-ghost" onClick={() => { logout(); navigate('/organizer/login', { replace: true }); }}><LogOut size={15} /> Sign out</button>
        </div>
      </nav>
      <Outlet />
    </main>
  );
}

/** Login / register screens: signed-in people skip straight to their console. */
export function GuestOnly({ children }) {
  const { isAuthenticated, loading, handoffPending } = useOrganizerAuth();
  const location = useLocation();
  if (loading) return <main className="center-state"><LoaderCircle className="spin" size={32} /></main>;
  if (isAuthenticated && !handoffPending) {
    const from = location.state?.from;
    return <Navigate to={from ? `${from.pathname}${from.search || ''}` : '/organizer'} replace />;
  }
  return children;
}
