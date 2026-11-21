import React, { useCallback, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { AdminRestrictionDetail, ScreenType } from '../../types';
import { SplashScreen } from '../../screens/SplashScreen';
import { WelcomeScreen } from '../../screens/WelcomeScreen';
import { AccountRecoveryScreen } from '../../screens/AccountRecoveryScreen';
import { AccountRestrictionScreen } from './AccountRestrictionScreen';
import { FeatureRestrictionScreen } from './FeatureRestrictionScreen';

/**
 * Screens accessible without an active authenticated session.
 */
export const PUBLIC_AUTH_SCREENS: ReadonlySet<ScreenType> = new Set<ScreenType>([
  'splash',
  'welcome',
  'register',
  'signin',
  'privacy_policy',
  'terms_conditions',
  'delete_account',
  'account_recovery',
]);

/**
 * Public screens that render directly without waiting on protected auth/moderation gates.
 */
export const PUBLIC_PASSTHROUGH_SCREENS: ReadonlySet<ScreenType> = new Set<ScreenType>([
  'splash',
  'welcome',
  'register',
  'signin',
  'privacy_policy',
  'terms_conditions',
  'delete_account',
]);

/**
 * Screens permitted while an authenticated account is in a deactivated or pending-deletion lifecycle state.
 */
export const LIFECYCLE_ALLOWED_SCREENS: ReadonlySet<ScreenType> = new Set<ScreenType>([
  'account_recovery',
  'delete_account',
  'privacy_policy',
  'terms_conditions',
]);

/**
 * Screens governed by Live Streaming moderation restrictions.
 */
export const LIVE_RESTRICTED_SCREENS: ReadonlySet<ScreenType> = new Set<ScreenType>([
  'live_stream',
  'pk_battle',
]);

/**
 * Screens governed by Party Room moderation restrictions.
 */
export const PARTY_RESTRICTED_SCREENS: ReadonlySet<ScreenType> = new Set<ScreenType>([
  'party_room',
  'party',
]);

export interface ActiveAccountRestriction {
  mode: 'blocked' | 'suspended';
  detail: AdminRestrictionDetail;
}

export interface AuthModerationStatus {
  isRestrictedLifecycleAccount: boolean;
  isSessionReadyAndAuthed: boolean;
  isAccountBlocked: boolean;
  isAccountSuspended: boolean;
  isAccountAdminRestricted: boolean;
  isLiveRestricted: boolean;
  isPartyRestricted: boolean;
  activeAccountRestriction: ActiveAccountRestriction | null;
}

/**
 * Single source of truth for authentication, account-lifecycle, and admin moderation state.
 * Keeps route guards, native back-button behavior, wake-lock logic, and feature guards in sync.
 */
export function useAuthModerationStatus(): AuthModerationStatus {
  const {
    currentUser,
    isAuthenticated,
    firebaseUser,
    isEmailVerified,
    adminModerationState,
  } = useApp();

  return useMemo<AuthModerationStatus>(() => {
    const isRestrictedLifecycleAccount = Boolean(
      firebaseUser &&
        isEmailVerified &&
        (currentUser?.accountStatus === 'deactivated' ||
          currentUser?.accountStatus === 'pending_deletion' ||
          currentUser?.accountStatus === 'permanently_deleted')
    );

    const isSessionReadyAndAuthed = Boolean(
      isAuthenticated && firebaseUser && isEmailVerified && !isRestrictedLifecycleAccount
    );

    const isAccountBlocked = Boolean(
      isSessionReadyAndAuthed &&
        adminModerationState.isAccountBlocked &&
        adminModerationState.accountBlock
    );

    const isAccountSuspended = Boolean(
      isSessionReadyAndAuthed &&
        !isAccountBlocked &&
        adminModerationState.isAccountSuspended &&
        adminModerationState.accountSuspension
    );

    const activeAccountRestriction: ActiveAccountRestriction | null = isAccountBlocked &&
      adminModerationState.accountBlock
      ? { mode: 'blocked', detail: adminModerationState.accountBlock }
      : isAccountSuspended && adminModerationState.accountSuspension
      ? { mode: 'suspended', detail: adminModerationState.accountSuspension }
      : null;

    const isLiveRestricted = Boolean(
      isSessionReadyAndAuthed &&
        adminModerationState.isLiveRestricted &&
        adminModerationState.liveRestriction
    );

    const isPartyRestricted = Boolean(
      isSessionReadyAndAuthed &&
        adminModerationState.isPartyRestricted &&
        adminModerationState.partyRestriction
    );

    return {
      isRestrictedLifecycleAccount,
      isSessionReadyAndAuthed,
      isAccountBlocked,
      isAccountSuspended,
      isAccountAdminRestricted: isAccountBlocked || isAccountSuspended,
      isLiveRestricted,
      isPartyRestricted,
      activeAccountRestriction,
    };
  }, [
    currentUser?.accountStatus,
    isAuthenticated,
    firebaseUser,
    isEmailVerified,
    adminModerationState,
  ]);
}

export interface ModerationGuardProps {
  children: React.ReactNode;
  /**
   * - 'app'   (default): Wraps AppContent to enforce auth redirects, account lifecycle recovery,
   *                      account block/suspension screens, and full-screen Live/Party restrictions.
   * - 'live'           : Enforces Live streaming restriction for an embedded or scoped Live view.
   * - 'party'          : Enforces Party access restriction inside the Party tab while preserving
   *                      bottom navigation so users can still switch to unrestricted tabs.
   */
  scope?: 'app' | 'live' | 'party';
  onRestrictedClose?: () => void;
}

export const ModerationGuard: React.FC<ModerationGuardProps> = ({
  children,
  scope = 'app',
  onRestrictedClose,
}) => {
  const {
    currentScreen,
    setCurrentScreen,
    setActiveTab,
    deviceMode,
    activePartyRoom,
    activeStream,
    closePartyRoom,
    closeLiveStream,
    firebaseUser,
    firebaseAuthLoading,
    adminModerationState,
  } = useApp();

  const status = useAuthModerationStatus();

  const handleExitRestrictedFeature = useCallback(
    (feature: 'live' | 'party') => {
      if (onRestrictedClose) {
        onRestrictedClose();
        return;
      }
      if (feature === 'live' && activeStream !== null) {
        closeLiveStream();
      }
      if (feature === 'party' && activePartyRoom !== null) {
        closePartyRoom(false);
      }
      setActiveTab('home');
      setCurrentScreen('home');
    },
    [
      onRestrictedClose,
      activeStream,
      activePartyRoom,
      closeLiveStream,
      closePartyRoom,
      setActiveTab,
      setCurrentScreen,
    ]
  );

  // Unified route redirect guard for top-level app wrapper
  useEffect(() => {
    if (scope !== 'app') return;
    if (deviceMode === 'admin') return;
    if (firebaseAuthLoading) return;

    if (status.isRestrictedLifecycleAccount && !LIFECYCLE_ALLOWED_SCREENS.has(currentScreen)) {
      setCurrentScreen('account_recovery');
      return;
    }

    if (!status.isSessionReadyAndAuthed && !PUBLIC_AUTH_SCREENS.has(currentScreen)) {
      setCurrentScreen('welcome');
    }
  }, [
    scope,
    deviceMode,
    firebaseAuthLoading,
    status.isRestrictedLifecycleAccount,
    status.isSessionReadyAndAuthed,
    currentScreen,
    setCurrentScreen,
  ]);

  // Scoped feature guards (e.g., Party tab rendered inside the bottom-navigation shell)
  if (scope === 'live') {
    if (status.isLiveRestricted && adminModerationState.liveRestriction) {
      return (
        <FeatureRestrictionScreen
          scope="live"
          detail={adminModerationState.liveRestriction}
          onClose={() => handleExitRestrictedFeature('live')}
        />
      );
    }
    return <>{children}</>;
  }

  if (scope === 'party') {
    if (status.isPartyRestricted && adminModerationState.partyRestriction) {
      return (
        <FeatureRestrictionScreen
          scope="party"
          detail={adminModerationState.partyRestriction}
          onClose={() => handleExitRestrictedFeature('party')}
        />
      );
    }
    return <>{children}</>;
  }

  // =========================================================================
  // TOP-LEVEL APP GUARD (scope === 'app')
  // =========================================================================

  // 1. Admin Dashboard mode bypasses end-user auth/moderation overlays
  if (deviceMode === 'admin') {
    return <>{children}</>;
  }

  // 2. Always-public onboarding, auth, and legal screens render directly
  if (PUBLIC_PASSTHROUGH_SCREENS.has(currentScreen)) {
    return <>{children}</>;
  }

  // 3. Hold protected views on SplashScreen until Firebase Auth finishes resolving
  if (firebaseAuthLoading) {
    return <SplashScreen />;
  }

  // 4. Account lifecycle gate (deactivated / pending deletion / permanently deleted)
  if (status.isRestrictedLifecycleAccount || currentScreen === 'account_recovery') {
    return firebaseUser ? <AccountRecoveryScreen /> : <WelcomeScreen />;
  }

  // 5. Authentication gate for all protected screens
  if (!status.isSessionReadyAndAuthed) {
    return <WelcomeScreen />;
  }

  // 6. Account-level moderation gate (block / suspension cannot be bypassed)
  if (status.activeAccountRestriction) {
    return (
      <AccountRestrictionScreen
        mode={status.activeAccountRestriction.mode}
        detail={status.activeAccountRestriction.detail}
      />
    );
  }

  // 7. Full-screen Live & PK Battle moderation gate
  const isAttemptingLiveScreen =
    LIVE_RESTRICTED_SCREENS.has(currentScreen) || activeStream !== null;
  if (
    status.isLiveRestricted &&
    adminModerationState.liveRestriction &&
    isAttemptingLiveScreen
  ) {
    return (
      <FeatureRestrictionScreen
        scope="live"
        detail={adminModerationState.liveRestriction}
        onClose={() => handleExitRestrictedFeature('live')}
      />
    );
  }

  // 8. Full-screen Party Room moderation gate
  const isAttemptingPartyRoom = currentScreen === 'party_room' || activePartyRoom !== null;
  if (
    status.isPartyRestricted &&
    adminModerationState.partyRestriction &&
    isAttemptingPartyRoom
  ) {
    return (
      <FeatureRestrictionScreen
        scope="party"
        detail={adminModerationState.partyRestriction}
        onClose={() => handleExitRestrictedFeature('party')}
      />
    );
  }

  return <>{children}</>;
};
