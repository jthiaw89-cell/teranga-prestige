"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  ChevronDown,
  ChevronsRight,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  X,
} from "lucide-react";
import type { NotificationItem } from "../../types";
import { resolveMediaUrl } from "../../lib/mediaAssets";
import { CompanyLogo } from "./MediaAvatar";

export interface SidebarNavItem {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  notifs?: number;
}

export interface OrganizationBrandOption {
  id: string;
  name: string;
  subtitle?: string;
  logoUrl?: string;
}

interface PlatformShellProps {
  brandTitle: string;
  brandSubtitle: string;
  brandLogoUrl?: string;
  organizations: OrganizationBrandOption[];
  selectedOrganizationId: string;
  onSelectOrganization: (orgId: string) => void;
  navItems: SidebarNavItem[];
  activeId: string;
  onSelectNav: (id: string) => void;
  pageTitle: string;
  pageSubtitle?: string;
  userName: string;
  userRole: string;
  onSignOut: () => void;
  unreadNotificationsCount?: number;
  recentNotifications?: NotificationItem[];
  onOpenNotifications?: () => void;
  onMarkAllNotificationsRead?: () => void;
  accentColor?: string;
  children: React.ReactNode;
}

export const PlatformShell: React.FC<PlatformShellProps> = ({
  brandTitle,
  brandSubtitle,
  brandLogoUrl,
  organizations,
  selectedOrganizationId,
  onSelectOrganization,
  navItems,
  activeId,
  onSelectNav,
  pageTitle,
  userName,
  userRole,
  onSignOut,
  unreadNotificationsCount = 0,
  recentNotifications = [],
  onOpenNotifications,
  onMarkAllNotificationsRead,
  accentColor,
  children,
}) => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem("tpd_theme") === "dark";
    } catch {
      return false;
    }
  });
  const [open, setOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [mobileOrgMenuOpen, setMobileOrgMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      try {
        localStorage.setItem("tpd_theme", "dark");
      } catch {
        // ignore
      }
    } else {
      document.documentElement.classList.remove("dark");
      try {
        localStorage.setItem("tpd_theme", "light");
      } catch {
        // ignore
      }
    }
  }, [isDark]);

  // Close mobile drawer on Escape & prevent background scroll while open
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMenuOpen]);

  const currentOrg = organizations.find((o) => o.id === selectedOrganizationId) || organizations[0];
  const canSwitchOrganizations = organizations.length > 1;
  const activeNavItem = navItems.find((item) => item.id === activeId);

  function handleSelectNavAndClose(id: string) {
    onSelectNav(id);
    setMobileMenuOpen(false);
  }

  function handleDrawerTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  }

  function handleDrawerTouchEnd(e: React.TouchEvent) {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartXRef.current;
    const dy = Math.abs(touch.clientY - touchStartYRef.current);
    // Swipe left to dismiss off-canvas menu
    if (dx < -55 && dy < 80) {
      setMobileMenuOpen(false);
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  }

  return (
    <div className={`flex min-h-screen w-full ${isDark ? "dark" : ""}`}>
      <div className="flex flex-col lg:flex-row w-full min-w-0 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-x-hidden">
        {/* Mobile Off-Canvas Backdrop */}
        <div
          aria-hidden="true"
          onClick={() => setMobileMenuOpen(false)}
          className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity duration-200 lg:hidden no-print ${
            mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        />

        {/* Mobile Off-Canvas Drawer */}
        <aside
          role="dialog"
          aria-modal={mobileMenuOpen}
          aria-label="Menu de navigation"
          onTouchStart={handleDrawerTouchStart}
          onTouchEnd={handleDrawerTouchEnd}
          className={`fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[300px] border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl flex flex-col transform transition-transform duration-300 ease-out will-change-transform lg:hidden no-print ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
          }`}
        >
          {/* Drawer Brand Header & Close Button */}
          <div className="flex items-center justify-between gap-2 p-3 border-b border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={() => canSwitchOrganizations && setMobileOrgMenuOpen((v) => !v)}
              className={`flex-1 min-w-0 min-h-[44px] flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-left transition-colors ${
                canSwitchOrganizations
                  ? "hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-[0.99] touch-manipulation"
                  : "cursor-default"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Logo accentColor={accentColor} logoUrl={currentOrg?.logoUrl || brandLogoUrl} brandName={currentOrg?.name || brandTitle} />
                <div className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {currentOrg?.name || brandTitle}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                    {currentOrg?.subtitle || brandSubtitle}
                  </span>
                </div>
              </div>
              {canSwitchOrganizations && (
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
                    mobileOrgMenuOpen ? "rotate-180" : ""
                  }`}
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Fermer le menu"
              className="min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all touch-manipulation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Inline Organization Switcher inside Off-Canvas Drawer */}
          {canSwitchOrganizations && mobileOrgMenuOpen && (
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/60 space-y-1">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Changer d&apos;organisation
              </div>
              {organizations.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => {
                    onSelectOrganization(org.id);
                    setMobileOrgMenuOpen(false);
                  }}
                  className={`w-full min-h-[44px] text-left px-3 py-2 rounded-xl text-xs transition-colors touch-manipulation flex items-center gap-2.5 ${
                    org.id === selectedOrganizationId
                      ? "bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold"
                      : "text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800"
                  }`}
                >
                  <CompanyLogo src={org.logoUrl} name={org.name} size="xs" />
                  <div className="min-w-0">
                    <div className="truncate">{org.name}</div>
                    {org.subtitle && (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                        {org.subtitle}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Drawer Navigation Items */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isSelected = activeId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectNavAndClose(item.id)}
                  className={`w-full min-h-[48px] flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98] touch-manipulation ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-800/80"
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </span>
                  {item.notifs ? (
                    <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs font-mono tabular-nums shrink-0">
                      {item.notifs}
                    </span>
                  ) : null}
                </button>
              );
            })}

            <div className="border-t border-gray-200 dark:border-gray-800 pt-3 mt-3 space-y-1.5">
              <div className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                Compte &amp; Session
              </div>
              <div className="px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/70">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {userName}
                </div>
                <div className="text-xs font-mono text-blue-600 dark:text-blue-400 truncate mt-0.5">
                  {userRole}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDark(!isDark)}
                className="w-full min-h-[46px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-[0.98] transition-all touch-manipulation"
              >
                {isDark ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
                <span>{isDark ? "Mode Clair" : "Mode Sombre"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onSignOut();
                }}
                className="w-full min-h-[46px] flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 active:scale-[0.98] transition-all touch-manipulation"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                <span>Changer de compte</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Desktop Collapsible Sidebar */}
        <nav
          aria-label="Navigation principale"
          className={`hidden lg:flex sticky top-0 h-screen shrink-0 border-r transition-all duration-300 ease-in-out no-print flex-col ${
            open ? "w-64" : "w-16"
          } border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2 shadow-sm`}
        >
          <TitleSection
            open={open}
            brandTitle={currentOrg?.name || brandTitle}
            brandSubtitle={currentOrg?.subtitle || brandSubtitle}
            brandLogoUrl={currentOrg?.logoUrl || brandLogoUrl}
            organizations={organizations}
            selectedOrganizationId={selectedOrganizationId}
            canSwitchOrganizations={canSwitchOrganizations}
            onSelectOrganization={(id) => {
              onSelectOrganization(id);
              setOrgMenuOpen(false);
            }}
            orgMenuOpen={orgMenuOpen}
            setOrgMenuOpen={setOrgMenuOpen}
            accentColor={accentColor}
          />

          <div className="flex-1 overflow-y-auto min-h-0 pr-0.5">
            <div className="space-y-1 mb-4">
              {navItems.map((item) => (
                <Option
                  key={item.id}
                  Icon={item.icon}
                  title={item.title}
                  isSelected={activeId === item.id}
                  onClick={() => onSelectNav(item.id)}
                  open={open}
                  notifs={item.notifs}
                />
              ))}
            </div>

            {open && (
              <div className="border-t border-gray-200 dark:border-gray-800 pt-3 space-y-1">
                <div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                  Compte &amp; Session
                </div>
                <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 mx-1 mb-1">
                  <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {userName}
                  </div>
                  <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400 truncate">
                    {userRole}
                  </div>
                </div>
                <Option
                  Icon={Settings}
                  title={isDark ? "Mode Clair" : "Mode Sombre"}
                  isSelected={false}
                  onClick={() => setIsDark(!isDark)}
                  open={open}
                />
                <Option
                  Icon={LogOut}
                  title="Changer de compte"
                  isSelected={false}
                  onClick={onSignOut}
                  open={open}
                />
              </div>
            )}
          </div>

          <ToggleClose open={open} setOpen={setOpen} />
        </nav>

        {/* Mobile / Tablet Sticky Top App Bar (<= lg, touch targets >= 44x44px) */}
        <div className="lg:hidden sticky top-0 z-30 h-14 px-2.5 sm:px-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-2 no-print">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Ouvrir le menu de navigation"
              aria-expanded={mobileMenuOpen}
              className="min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all touch-manipulation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                {activeNavItem?.title || pageTitle}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {currentOrg?.name || brandTitle}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs whitespace-nowrap">
              <span className="font-semibold text-gray-900 dark:text-gray-100 max-w-[140px] truncate">
                {userName}
              </span>
              <span className="text-gray-300 dark:text-gray-700" aria-hidden="true">·</span>
              <span className="font-mono text-[11px] text-blue-700 dark:text-blue-300">
                {userRole}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              aria-label="Notifications"
              className="relative min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all touch-manipulation"
            >
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                  {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsDark(!isDark)}
              aria-label="Changer le thème"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all touch-manipulation"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Déconnexion"
              title="Se déconnecter ou changer d'utilisateur"
              className="min-h-[40px] px-2.5 sm:px-3 py-1.5 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-700 dark:hover:text-rose-300 hover:border-rose-200 dark:hover:border-rose-800 active:scale-95 transition-all touch-manipulation text-xs font-semibold whitespace-nowrap"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 bg-gray-50 dark:bg-gray-950 px-3.5 py-4 sm:p-6 overflow-x-hidden">
          {/* Mobile Vertical Page Title Block (<= lg) */}
          <div className="lg:hidden mb-4 no-print space-y-2">
            <div className="sm:hidden flex items-center justify-end gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-[11px] max-w-full">
                <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {userName}
                </span>
                <span className="text-gray-300 dark:text-gray-700" aria-hidden="true">·</span>
                <span className="font-mono text-blue-700 dark:text-blue-300 shrink-0">
                  {userRole}
                </span>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 text-[11px] font-semibold shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Déconnexion</span>
              </button>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 text-balance">
                {pageTitle}
              </h1>
            </div>
          </div>

          {/* Desktop Header (pinned top-right widget) */}
          <header className="hidden lg:flex items-center justify-between gap-4 mb-5 no-print">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                {pageTitle}
              </h1>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 ml-auto pt-0.5 relative whitespace-nowrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{userName}</span>
                <span className="text-gray-300 dark:text-gray-700" aria-hidden="true">·</span>
                <span className="font-mono text-[11px] text-blue-700 dark:text-blue-300">
                  {userRole}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label="Notifications"
                className="relative p-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <Bell className="h-5 w-5" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[19px] h-[19px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                    {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsDark(!isDark)}
                aria-label="Changer le thème"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={onSignOut}
                title="Se déconnecter ou changer d'utilisateur"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-700 dark:hover:text-rose-300 hover:border-rose-200 dark:hover:border-rose-800 transition-colors text-xs font-semibold"
              >
                <LogOut className="h-4 w-4" />
                <span>Déconnexion</span>
              </button>
            </div>
          </header>

          {/* Responsive Session & Notifications Popover */}
          {notifOpen && (
            <div className="fixed left-3 right-3 top-16 lg:left-auto lg:right-6 lg:top-20 lg:w-96 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-xl z-40 space-y-3 no-print">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                    Notifications
                  </span>
                  {unreadNotificationsCount > 0 && (
                    <span className="font-mono text-[11px] font-bold text-rose-600 dark:text-rose-400">
                      {unreadNotificationsCount} non lue(s)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {onMarkAllNotificationsRead && unreadNotificationsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => onMarkAllNotificationsRead()}
                      className="px-2 py-1 rounded-lg text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 inline-flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Tout lu
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setNotifOpen(false)}
                    aria-label="Fermer"
                    className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="text-xs p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200">
                Session : <span className="font-semibold">{userName}</span> ({userRole})
              </div>

              {recentNotifications.length === 0 ? (
                <div className="text-xs p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                  Aucune alerte récente.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                  {recentNotifications.slice(0, 4).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        if (n.targetSection) {
                          onSelectNav(n.targetSection);
                        } else if (onOpenNotifications) {
                          onOpenNotifications();
                        }
                      }}
                      className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                        n.read
                          ? "border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/40"
                          : "border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {n.title}
                        </span>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-gray-600 dark:text-gray-400 line-clamp-2 mt-0.5">
                        {n.message}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {onOpenNotifications && (
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen(false);
                    onOpenNotifications();
                  }}
                  className="w-full min-h-[38px] rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold hover:opacity-90 transition"
                >
                  Ouvrir le Centre de notifications
                </button>
              )}
            </div>
          )}

          {children}
        </main>
      </div>
    </div>
  );
};

interface OptionProps {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  isSelected: boolean;
  onClick: () => void;
  open: boolean;
  notifs?: number;
}

const Option: React.FC<OptionProps> = ({ Icon, title, isSelected, onClick, open, notifs }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      title={!open ? title : undefined}
      className={`relative flex h-11 w-full items-center rounded-md transition-all duration-200 ${
        isSelected
          ? "bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 shadow-sm"
          : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
      }`}
    >
      <div className="grid h-full w-12 shrink-0 place-content-center">
        <Icon className="h-4 w-4" />
      </div>

      {open && (
        <span className="text-sm font-medium truncate pr-8 transition-opacity duration-200">
          {title}
        </span>
      )}

      {notifs && open ? (
        <span className="absolute right-3 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 dark:bg-blue-600 text-xs text-white font-medium">
          {notifs}
        </span>
      ) : null}
    </button>
  );
};

interface TitleSectionProps {
  open: boolean;
  brandTitle: string;
  brandSubtitle: string;
  brandLogoUrl?: string;
  organizations: OrganizationBrandOption[];
  selectedOrganizationId: string;
  canSwitchOrganizations: boolean;
  onSelectOrganization: (orgId: string) => void;
  orgMenuOpen: boolean;
  setOrgMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  accentColor?: string;
}

const TitleSection: React.FC<TitleSectionProps> = ({
  open,
  brandTitle,
  brandSubtitle,
  brandLogoUrl,
  organizations,
  selectedOrganizationId,
  canSwitchOrganizations,
  onSelectOrganization,
  orgMenuOpen,
  setOrgMenuOpen,
  accentColor,
}) => {
  return (
    <div className="relative mb-3 border-b border-gray-200 dark:border-gray-800 pb-3">
      <button
        type="button"
        onClick={() => open && canSwitchOrganizations && setOrgMenuOpen((v) => !v)}
        className={`w-full flex items-center justify-between rounded-md p-2 text-left transition-colors ${
          canSwitchOrganizations ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" : "cursor-default"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Logo accentColor={accentColor} logoUrl={brandLogoUrl} brandName={brandTitle} />
          {open && (
            <div className="min-w-0">
              <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {brandTitle}
              </span>
              <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                {brandSubtitle}
              </span>
            </div>
          )}
        </div>
        {open && canSwitchOrganizations && (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
        )}
      </button>

      {open && canSwitchOrganizations && orgMenuOpen && (
        <div className="absolute left-0 right-0 top-16 z-50 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-1.5 shadow-lg space-y-1">
          {organizations.map((org) => (
            <button
              key={org.id}
              type="button"
              onClick={() => onSelectOrganization(org.id)}
              className={`w-full text-left px-2.5 py-2 rounded-md text-xs transition-colors flex items-center gap-2 ${
                org.id === selectedOrganizationId
                  ? "bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <CompanyLogo src={org.logoUrl} name={org.name} size="xs" />
              <div className="min-w-0">
                <div className="truncate">{org.name}</div>
                {org.subtitle && (
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{org.subtitle}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Logo: React.FC<{ accentColor?: string; logoUrl?: string; brandName?: string }> = ({
  accentColor,
  logoUrl,
  brandName,
}) => {
  const resolved = resolveMediaUrl(logoUrl);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [resolved]);

  if (resolved && !imgFailed) {
    return (
      <div className="size-10 shrink-0 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-1 flex items-center justify-center shadow-sm overflow-hidden">
        <img
          src={resolved}
          alt={brandName || "Logo"}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain rounded"
        />
      </div>
    );
  }

  return (
    <div
      className="grid size-10 shrink-0 place-content-center rounded-lg shadow-sm"
      style={{ backgroundColor: accentColor || "#2563eb" }}
    >
      <svg
        width="20"
        height="auto"
        viewBox="0 0 50 39"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="fill-white"
      >
        <path d="M16.4992 2H37.5808L22.0816 24.9729H1L16.4992 2Z" />
        <path d="M17.4224 27.102L11.4192 36H33.5008L49 13.0271H32.7024L23.2064 27.102H17.4224Z" />
      </svg>
    </div>
  );
};

interface ToggleCloseProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const ToggleClose: React.FC<ToggleCloseProps> = ({ open, setOpen }) => {
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className="w-full border-t border-gray-200 dark:border-gray-800 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 rounded-b-md"
    >
      <div className="flex items-center p-2">
        <div className="grid size-10 place-content-center">
          <ChevronsRight
            className={`h-4 w-4 transition-transform duration-300 text-gray-500 dark:text-gray-400 ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
        {open && (
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300 transition-opacity duration-200">
            Réduire
          </span>
        )}
      </div>
    </button>
  );
};

export default PlatformShell;
