import { Home, Layers, MessageCircle, User } from "lucide-react";
import { NavLink, useParams } from "react-router-dom";

/**
 * The four permanent mobile destinations from the Doc1 mockups —
 * Home, Workspaces, Messages, Profile — rendered as a fixed bottom
 * tab bar on small screens only (lg:hidden). Shown by both
 * PlatformLayout and WorkspaceLayout so navigation never disappears
 * on mobile, matching every mobile screen in the design doc.
 *
 * "Messages" has no cross-workspace inbox yet (chat is scoped to a
 * single workspace's /chat route), so while inside a workspace it
 * deep-links to that workspace's chat; from the platform layer
 * (/home, /workspaces) it lands on /workspaces, since there's no
 * active workspace to attach a conversation to yet.
 */
export default function MobileBottomNav() {
  const { workspaceId } = useParams();

  const items = [
    { label: "Home", to: "/home", icon: Home, end: true },
    { label: "Workspaces", to: "/workspaces", icon: Layers },
    {
      label: "Messages",
      to: workspaceId ? `/workspace/${workspaceId}/chat` : "/workspaces",
      icon: MessageCircle,
    },
    { label: "Profile", to: "/account/settings", icon: User },
  ];

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-between border-t border-obsidian-border bg-obsidian/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 backdrop-blur-xl lg:hidden"
    >
      {items.map(({ label, to, icon: Icon, end }) => (
        <NavLink
          key={label}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-medium transition ${
              isActive ? "text-mint" : "text-mist-muted"
            }`
          }
        >
          <Icon size={22} strokeWidth={2} aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}