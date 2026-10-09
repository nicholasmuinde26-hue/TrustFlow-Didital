import { useEffect, useRef, useState } from "react";
import {
  Building2,
  FilePlus2,
  LifeBuoy,
  SlidersHorizontal,
  X,
  BookOpen,
  Lock,
} from "lucide-react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { isChamaBackedType } from "@/modules/workspaces/config/workspaceModules";

import Logo from "../Logo";
import SidebarSection from "./SidebarSection";
import BrandMark from "../BrandMark";
import AdminInquiryBottomPanel from "@/modules/workspaces/components/AdminInquiryBottomPanel";
import useAuth from "@/app/hooks/useAuth";
import { findWorkspaceNavigationMatch, getLeadershipDeskItem } from "@/modules/workspaces/config/workspaceNavigation";
import { useNotificationBadges } from "@/modules/notifications/hooks/useNotifications";

// -----------------------------------------------------------------------------
// DEFAULT / NON-CHAMA RAIL
// -----------------------------------------------------------------------------

const RAIL_PRIORITIES = [
  "Overview",
  "Dashboard",
  "Finance",
  "Loans",
  "Members",
  "Messages",
  "Chat",
  "Meeting Records",
  "Trust Score",
  "Command Center",
];

// -----------------------------------------------------------------------------
// CHAMA RAIL
// -----------------------------------------------------------------------------
//
// The order here directly controls the order of the chama workspace rail.
//
// Overview  -> workspace command/home
// Dashboard -> money, contributions, savings and payouts
// Loans     -> lending
// Members   -> membership and member standing
// Trust     -> trust score
// Books     -> official financial records / statements
// Messages  -> chama chat
//
// "Books" is a synthetic navigation item resolved by pickBooksItem() below.
//

const CHAMA_RAIL_ORDER = [
  "Overview",
  "Dashboard",
  "Loans",
  "Members",
  "Trust Score",
  "Books",
  "Messages",
];

// -----------------------------------------------------------------------------
// BURIAL CHAMA RAIL
// -----------------------------------------------------------------------------
//
// A burial chama is chama-backed, but its workspace type is "burial-chama", so
// it used to fall through to the generic rail and show only Overview, Members
// and Meetings. Titles must match the burial shell wording in chamaNavigation.js
// ("Contributions" is the welfare contributions page, "Welfare Fund" is the
// burial name for Savings). Items hidden by a disabled module or by role are
// simply skipped by pickRailItems.
//

const BURIAL_RAIL_ORDER = [
  "Overview",
  "Members",
  "Contributions",
  "Burial Cases",
  "Welfare Fund",
  "Meeting Records",
  "Messages",
  "Books",
];

// -----------------------------------------------------------------------------
// BUSINESS RAIL ORDERS
// -----------------------------------------------------------------------------

const BUSINESS_RAIL_ORDERS = {
  rental: [
    "Overview",
    "Rooms & Plots",
    "Tenant Inquiries",
    "Rent Collections",
    "Cash & Accounts",
    "Reports",
  ],

  restaurant: [
    "Overview",
    "Point of Sale (POS)",
    "Orders & Sales",
    "Menu Items",
    "Customers",
    "Cash & Accounts",
  ],

  service: [
    "Overview",
    "Appointments & Jobs",
    "Services",
    "Clients & Customers",
    "Cash & Accounts",
    "Reports",
  ],

  retail: [
    "Overview",
    "Point of Sale (POS)",
    "Sales & Invoicing",
    "Inventory & Stock",
    "Customers",
    "Cash & Accounts",
  ],

  other: [
    "Overview",
    "Point of Sale (POS)",
    "Sales & Invoicing",
    "Inventory & Stock",
    "Customers",
    "Cash & Accounts",
  ],
};

// -----------------------------------------------------------------------------
// SHORT LABELS
// -----------------------------------------------------------------------------

const RAIL_SHORT_LABELS = {
  Dashboard: "Money",
  "Trust Score": "Trust",
  Contributions: "Money",
  "Burial Cases": "Cases",
  "Welfare Fund": "Welfare",
  "Meeting Records": "Meetings",
  Messages: "Chat",
  Chat: "Chat",
  Books: "Books",

  "Rooms & Plots": "Units",
  "Tenant Inquiries": "Tenants",
  "Rent Collections": "Rent",

  "Point of Sale (POS)": "POS",
  "Orders & Sales": "Orders",
  "Menu Items": "Menu",

  "Appointments & Jobs": "Jobs",
  Services: "Services",
  "Clients & Customers": "Clients",

  "Sales & Invoicing": "Sales",
  "Inventory & Stock": "Stock",

  "Cash & Accounts": "Cash",
  Reports: "Reports",
};

// -----------------------------------------------------------------------------
// RAIL LABEL OVERRIDES
// -----------------------------------------------------------------------------

const RAIL_LABEL_OVERRIDES = {
  Dashboard: "Money & Contributions",
};

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

function pickBooksItem(sections) {
  const booksSection = sections.find(
    (section) =>
      section.title === "Books" || section.title === "Books & Reports"
  );

  const firstItem = booksSection?.items?.[0];

  if (!firstItem) return null;

  return {
    title: "Books",
    icon: BookOpen,
    to: firstItem.to,
    sectionKey: booksSection.sectionKey,
  };
}

function pickRailItems(
  sections,
  priorities = RAIL_PRIORITIES,
  limit = 5
) {
  const items = sections.flatMap((section) => section.items || []);

  const seen = new Set();

  return priorities
    .map((title) => {
      const item = title === "Books"
        ? pickBooksItem(sections)
        : items.find((candidate) => candidate.title === title);
      if (!item || item.sectionKey) return item;
      const section = sections.find((candidate) => candidate.items?.some((navItem) => navItem.to === item.to));
      return { ...item, sectionKey: section?.sectionKey };
    })
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item.to)) {
        return false;
      }

      seen.add(item.to);
      return true;
    })
    .slice(0, limit);
}

// -----------------------------------------------------------------------------
// SIDEBAR
// -----------------------------------------------------------------------------

export default function Sidebar({
  sections = [],
  isOpen,
  onClose,
  onOpen,
  workspace,
  workspaceId,
}) {
  const isChama = workspace?.type === "chama";
  const isBusiness = workspace?.type === "business";
  const isBurial = workspace?.type === "burial-chama";
  const chamaBacked = isChamaBackedType(workspace?.type);
  const { pathname } = useLocation();
  const routeOwner = findWorkspaceNavigationMatch(sections, pathname);

  const leadershipItem = getLeadershipDeskItem(
    workspaceId,
    workspace?.type,
    workspace?.role
  );

  const booksItem = pickBooksItem(sections);

  const { countForRoute } = useNotificationBadges();
  const { user } = useAuth();

  // ---------------------------------------------------------------------------
  // BUSINESS RAIL
  // ---------------------------------------------------------------------------

  const businessRailOrder =
    BUSINESS_RAIL_ORDERS[workspace?.category] ||
    BUSINESS_RAIL_ORDERS.other;

  // ---------------------------------------------------------------------------
  // PRIMARY NAVIGATION
  // ---------------------------------------------------------------------------

  const primaryNavItems = isChama
    ? pickRailItems(
        sections,
        CHAMA_RAIL_ORDER,
        CHAMA_RAIL_ORDER.length
      )
    : isBurial
    ? pickRailItems(
        sections,
        BURIAL_RAIL_ORDER,
        BURIAL_RAIL_ORDER.length
      )
    : isBusiness
      ? pickRailItems(
          sections,
          businessRailOrder,
          businessRailOrder.length
        )
      : [
          ...pickRailItems(sections, RAIL_PRIORITIES),
          ...(booksItem ? [booksItem] : []),
        ];

  // ---------------------------------------------------------------------------
  // USER
  // ---------------------------------------------------------------------------

  const userName =
    user?.name ||
    user?.first_name ||
    "User";

  const userInitials =
    userName
      .split(" ")
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  const userPhoto =
    user?.avatar_url ||
    user?.photoURL ||
    user?.avatar ||
    null;

  // ---------------------------------------------------------------------------
  // ASSETS MENU
  // ---------------------------------------------------------------------------

  const [assetsOpen, setAssetsOpen] = useState(false);
  const [supportOpenSignal, setSupportOpenSignal] = useState(0);

  const assetsLauncherRef = useRef(null);

  const memberRole = String(workspace?.role || "")
    .toLowerCase()
    .replaceAll(" ", "_");

  const canRegisterAssets = [
    "chairperson",
    "treasurer",
  ].includes(memberRole);

  // ---------------------------------------------------------------------------
  // CLOSE ASSETS MENU
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!assetsOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (
        !assetsLauncherRef.current?.contains(event.target)
      ) {
        setAssetsOpen(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setAssetsOpen(false);
      }
    };

    document.addEventListener(
      "pointerdown",
      closeOnOutsideClick
    );

    document.addEventListener(
      "keydown",
      closeOnEscape
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        closeOnOutsideClick
      );

      document.removeEventListener(
        "keydown",
        closeOnEscape
      );
    };
  }, [assetsOpen]);

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* ------------------------------------------------------------------- */}
      {/* DESKTOP RAIL                                                       */}
      {/* ------------------------------------------------------------------- */}

      <aside
        className="
          hidden
          w-[76px]
          shrink-0
          flex-col
          items-center
          justify-between
          overflow-y-auto
          border-r
          border-obsidian-border/60
          bg-obsidian-rail
          py-5
          text-mist/70
          transition-colors
          lg:flex
        "
      >
        <div className="flex w-full flex-col items-center">
          {/* Logo */}
          <Link
            to={`/workspace/${workspaceId}`}
            className="mb-7 block rounded-xl shadow-sm transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-mint"
            title={workspace?.name || "Chama Manager"}
            aria-label={workspace?.name ? `${workspace.name} home` : "Chama Manager home"}
          >
            <BrandMark size={40} />
          </Link>

          {/* Primary navigation */}
          <nav
            className="flex w-full flex-col items-center gap-2"
            aria-label="Primary workspace navigation"
          >
            {primaryNavItems.map(
              ({ title, icon: Icon, to, locked, sectionKey }) => {
                const label =
                  RAIL_LABEL_OVERRIDES[title] ||
                  title;

                const updateCount = countForRoute(to);
                const hasUpdate = updateCount > 0;

                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={title === "Overview" || title === "Books" || (title === "Dashboard" && sectionKey === "money")}
                    aria-label={
                      locked
                        ? `${label} - locked, upgrade your plan to use`
                        : hasUpdate
                        ? `${label} - ${updateCount} new`
                        : label
                    }
                    title={locked ? `${label} (upgrade to unlock)` : label}
                    className={({ isActive }) => {
                      const isSectionOwnedRailItem = (title === "Books" && sectionKey === "books") ||
                        (title === "Dashboard" && sectionKey === "money");
                      const active = isSectionOwnedRailItem
                        ? routeOwner?.section.sectionKey === sectionKey
                        : isActive;
                      return `
                        relative
                        flex
                        h-[52px]
                        w-14
                        flex-col
                        items-center
                        justify-center
                        gap-1
                        rounded-xl
                        transition
                        ${
                          active
                            ? "bg-mint-deep text-mint shadow-xs shadow-black/30"
                            : "text-mist/60 hover:bg-obsidian-card hover:text-mist"
                        }
                        ${locked ? "opacity-70" : ""}
                      `;
                    }}
                  >
                    {Icon && (
                      <Icon
                        size={19}
                        aria-hidden="true"
                      />
                    )}

                    <span className="text-[10px] font-medium leading-none">
                      {RAIL_SHORT_LABELS[title] ||
                        title}
                    </span>

                    {locked && (
                      <span
                        aria-hidden="true"
                        className="absolute right-1 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-amber-400 text-obsidian-rail ring-2 ring-obsidian-rail"
                      >
                        <Lock size={9} strokeWidth={3} />
                      </span>
                    )}

                    {!locked && hasUpdate && (
                      <span
                        aria-hidden="true"
                        className="absolute right-1 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-obsidian-rail"
                      >
                        {updateCount > 9 ? "9+" : updateCount}
                      </span>
                    )}
                  </NavLink>
                );
              }
            )}
          </nav>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* BOTTOM ACTIONS                                                   */}
        {/* ----------------------------------------------------------------- */}

        <div className="flex w-full flex-col items-center gap-3">
          {/* Leadership Desk */}
          {leadershipItem ? (
            <NavLink
              to={leadershipItem.to}
              aria-label={leadershipItem.title}
              title={leadershipItem.title}
              className={({ isActive }) =>
                `
                  flex
                  h-[52px]
                  w-14
                  flex-col
                  items-center
                  justify-center
                  gap-1
                  rounded-xl
                  transition
                  ${
                    isActive
                      ? "bg-mint-deep text-mint shadow-xs shadow-black/30"
                      : "text-mist/60 hover:bg-obsidian-card hover:text-mist"
                  }
                `
              }
            >
              {leadershipItem.icon && (
                <leadershipItem.icon
                  size={19}
                  aria-hidden="true"
                />
              )}

              <span className="text-[10px] font-medium leading-none">
                Desk
              </span>
            </NavLink>
          ) : null}

          {/* All tools */}
          {/* Chama-backed workspaces open the drawer from the top bar. */}
          {!chamaBacked && (
          <button
            type="button"
            onClick={onOpen}
            className="
              flex
              h-[52px]
              w-14
              flex-col
              items-center
              justify-center
              gap-1
              rounded-xl
              border
              border-obsidian-border
              text-mist/80
              transition
              hover:bg-obsidian-card
              hover:text-mist
            "
            aria-label="Open all workspace tools"
            title="All tools"
          >
            <SlidersHorizontal
              size={18}
              aria-hidden="true"
            />

            <span className="text-[10px] font-medium leading-none">
              All tools
            </span>
          </button>
          )}

          {/* Chama assets */}
          {isChama ? (
            <div
              ref={assetsLauncherRef}
              className="relative"
            >
              <button
                type="button"
                aria-label="Open chama assets menu"
                aria-expanded={assetsOpen}
                aria-controls="chama-assets-launcher"
                title="Assets & investments"
                onClick={() =>
                  setAssetsOpen(
                    (value) => !value
                  )
                }
                className={`
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  border
                  transition
                  ${
                    assetsOpen
                      ? "border-mint/50 bg-mint-deep text-mint shadow-[0_0_18px_rgba(94,234,212,0.18)]"
                      : "border-obsidian-border bg-obsidian-card text-mist/80 hover:border-mint/40 hover:text-mint"
                  }
                `}
              >
                <Building2
                  size={18}
                  aria-hidden="true"
                />
              </button>

              {/* Assets popup */}
              <div
                id="chama-assets-launcher"
                className={`
                  fixed
                  bottom-5
                  left-[84px]
                  z-[60]
                  w-max
                  max-w-[calc(100vw-6rem)]
                  origin-left
                  transition
                  duration-200
                  ${
                    assetsOpen
                      ? "translate-x-0 scale-100 opacity-100"
                      : "pointer-events-none invisible -translate-x-3 scale-95 opacity-0"
                  }
                `}
                aria-hidden={!assetsOpen}
              >
                <div
                  className="
                    flex
                    items-center
                    gap-2
                    overflow-x-auto
                    rounded-xl
                    border
                    border-mint/20
                    bg-obsidian-card
                    p-2.5
                    shadow-2xl
                    shadow-black/40
                    ring-1
                    ring-white/5
                  "
                >
                  {/* Header */}
                  <div
                    className="
                      flex
                      shrink-0
                      items-center
                      gap-2
                      border-r
                      border-white/10
                      px-2
                      pr-3
                    "
                  >
                    <Building2
                      size={17}
                      className="text-mint"
                      aria-hidden="true"
                    />

                    <div>
                      <p className="text-xs font-semibold text-mist">
                        Chama assets
                      </p>

                      <p className="text-[10px] text-mist-muted">
                        Investments and property
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <nav
                    aria-label="Chama asset actions"
                    className="
                      flex
                      w-max
                      shrink-0
                      items-center
                      gap-1
                    "
                  >
                    <Link
                      to={`/workspace/${workspaceId}/assets?assetAction=view`}
                      onClick={() =>
                        setAssetsOpen(false)
                      }
                      className="
                        inline-flex
                        shrink-0
                        items-center
                        gap-2
                        rounded-lg
                        px-3
                        py-2
                        text-xs
                        font-medium
                        text-mist/85
                        transition
                        hover:bg-mint-deep/50
                        hover:text-mint
                      "
                    >
                      <Building2
                        size={15}
                        className="text-mint"
                        aria-hidden="true"
                      />

                      View assets
                    </Link>

                    {canRegisterAssets && (
                      <Link
                        to={`/workspace/${workspaceId}/assets?assetAction=register`}
                        onClick={() =>
                          setAssetsOpen(false)
                        }
                        className="
                          inline-flex
                          shrink-0
                          items-center
                          gap-2
                          rounded-lg
                          px-3
                          py-2
                          text-xs
                          font-medium
                          text-mist/85
                          transition
                          hover:bg-mint-deep/50
                          hover:text-mint
                        "
                      >
                        <FilePlus2
                          size={15}
                          className="text-mint"
                          aria-hidden="true"
                        />

                        Register asset
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setAssetsOpen(false);
                        setSupportOpenSignal(
                          (value) => value + 1
                        );
                      }}
                      className="
                        inline-flex
                        shrink-0
                        items-center
                        gap-2
                        rounded-lg
                        px-3
                        py-2
                        text-xs
                        font-medium
                        text-mist/70
                        transition
                        hover:bg-white/5
                        hover:text-mint
                      "
                    >
                      <LifeBuoy
                        size={14}
                        aria-hidden="true"
                      />

                      Admin support
                    </button>
                  </nav>

                  {/* Close */}
                  <button
                    type="button"
                    aria-label="Close assets menu"
                    onClick={() =>
                      setAssetsOpen(false)
                    }
                    className="
                      ml-1
                      shrink-0
                      rounded-md
                      p-1.5
                      text-mist-muted
                      transition
                      hover:bg-white/5
                      hover:text-mist
                    "
                  >
                    <X
                      size={14}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* User */
            <Link
              to="/account/settings"
              title={userName}
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                overflow-hidden
                rounded-full
                border
                border-obsidian-border
                bg-obsidian-card
                text-xs
                font-bold
                text-mist
                transition
                hover:ring-2
                hover:ring-mint
              "
            >
              {userPhoto ? (
                <img
                  src={userPhoto}
                  alt={userName}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                userInitials
              )}
            </Link>
          )}
        </div>
      </aside>

      {/* ------------------------------------------------------------------- */}
      {/* MOBILE / DESKTOP OVERLAY                                            */}
      {/* ------------------------------------------------------------------- */}

      <div
        className={`
          fixed
          inset-0
          z-40
          bg-slate-900/60
          backdrop-blur-xs
          transition-opacity
          ${
            isOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          }
        `}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ------------------------------------------------------------------- */}
      {/* ALL TOOLS DRAWER                                                    */}
      {/* ------------------------------------------------------------------- */}

      <aside
        className={`
          fixed
          inset-y-0
          left-0
          z-50
          flex
          w-[min(23rem,calc(100vw-1.5rem))]
          flex-col
          border-r
          border-slate-200
          bg-white
          shadow-2xl
          transition-transform
          duration-300
          dark:border-obsidian-border
          dark:bg-obsidian
          lg:left-[76px]
          lg:w-[360px]
          ${
            isOpen
              ? "translate-x-0"
              : "-translate-x-[calc(100%+76px)]"
          }
        `}
        aria-label="All workspace tools"
      >
        {/* Header */}
        <header
          className="
            flex
            items-center
            justify-between
            border-b
            border-slate-200
            px-5
            py-5
            dark:border-obsidian-border
          "
        >
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <Logo />
            </div>

            <div>
              <p className="text-sm font-bold text-slate-950 dark:text-mist">
                All tools
              </p>

              <p className="text-xs text-slate-500 dark:text-mist-muted">
                Everything available to your role
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="
              rounded-lg
              p-2
              text-slate-500
              hover:bg-slate-100
              dark:text-mist-muted
              dark:hover:bg-obsidian-card
            "
            aria-label="Close all tools"
          >
            <X size={20} />
          </button>
        </header>

        {/* Workspace hint */}
        <div
          className="
            mx-5
            mt-4
            flex
            items-center
            gap-2
            rounded-xl
            border
            border-emerald-100
            bg-emerald-50
            px-3
            py-2
            text-xs
            font-medium
            text-emerald-800
            dark:border-mint-deep
            dark:bg-mint-deep/40
            dark:text-mint
          "
        >
          <BrandMark
            size={20}
            className="shrink-0"
            title=""
          />

          Choose a workspace or tool
        </div>

        {/* Sections */}
        <nav
          onClick={(event) => {
            if (event.target.closest("a")) {
              onClose?.();
            }
          }}
          className="
            flex-1
            space-y-6
            overflow-y-auto
            px-5
            py-5
          "
        >
          {sections.map((section) => (
            <SidebarSection
              key={section.title || "workspace"}
              {...section}
            />
          ))}
        </nav>

        {/* Footer */}
        <footer
          className="
            border-t
            border-slate-200
            p-4
            dark:border-obsidian-border
          "
        >
          {!isChama && (
            <AdminInquiryBottomPanel
              workspace={workspace}
              workspaceId={workspaceId}
            />
          )}
        </footer>
      </aside>

      {/* ------------------------------------------------------------------- */}
      {/* CHAMA SUPPORT LAUNCHER                                              */}
      {/* ------------------------------------------------------------------- */}

      {isChama && (
        <AdminInquiryBottomPanel
          workspace={workspace}
          workspaceId={workspaceId}
          hideLauncher
          openSignal={supportOpenSignal}
        />
      )}
    </>
  );
}
