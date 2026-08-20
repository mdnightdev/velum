import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, ArrowLeft } from 'lucide-react';
import { LegalDocModal } from './LegalDocModal';
import { useAuthForm } from './Auth/hooks/useAuthForm';
import WelcomeScreen from './Auth/WelcomeScreen';
import AuthHeader from './Auth/AuthHeader';
import LoginForm from './Auth/LoginForm';
import RegisterForm from './Auth/RegisterForm';
import CompromisedNotice from './Auth/CompromisedNotice';
import AccountRecovery from './Auth/AccountRecovery';

interface AuthPortalProps {
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
  onLoginSuccess: (user: any, sessionId: string, deviceId: string, activeView: string) => void;
  onMigrationRequired?: (userId: number, username: string) => void;
  tabPrefix: string;
}

export default function AuthPortal({ onLoginSuccess, onMigrationRequired }: AuthPortalProps) {
  const [authView, setAuthView] = useState<'welcome' | 'auth'>('welcome');
  const auth = useAuthForm({ onLoginSuccess, onMigrationRequired });

  if (authView === 'welcome') {
    return (
      <>
        <WelcomeScreen
          onGetStarted={() => {
            auth.setAuthTab('register');
            setAuthView('auth');
          }}
          onLogIn={() => {
            auth.setAuthTab('login');
            setAuthView('auth');
          }}
          onPasskeyAuth={auth.handlePasskeyLogin}
          onOpenLegalDoc={(doc) => auth.setActiveLegalDoc(doc)}
        />
        <LegalDocModal docType={auth.activeLegalDoc} onClose={() => auth.setActiveLegalDoc(null)} />
      </>
    );
  }

  return (
    <div className="w-full min-h-dvh flex flex-col justify-between bg-velum-900 text-text-primary px-6 py-8 sm:px-12 sm:py-12 select-none overflow-y-auto">
      {/* Top Bar with Navigation */}
      <header className="flex items-center justify-between w-full max-w-md mx-auto pt-2 mb-4">
        <button
          onClick={() => {
            if (auth.showRecoveryOptions) {
              auth.resetRecoveryState();
            } else if (auth.showCompromisedFlow) {
              auth.resetCompromisedState();
            } else {
              setAuthView('welcome');
            }
          }}
          className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer py-1.5 px-2.5 -ml-2 rounded-lg hover:bg-white-5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <span className="text-xs font-semibold tracking-wider text-text-secondary uppercase">
          {auth.showRecoveryOptions 
            ? 'Account Recovery' 
            : (auth.authTab === 'login' ? 'Sign In' : 'Create Account')}
        </span>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center w-full max-w-md mx-auto my-auto">
        <AuthHeader />

        {auth.authError && (
          <div className="mb-6 p-4 rounded-xl bg-status-dnd-bg text-status-dnd text-xs font-mono flex items-start gap-2 animate-fadeIn">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{auth.authError}</span>
          </div>
        )}

        {auth.recoverySuccessMessage && (
          <div className="mb-6 p-4 rounded-xl bg-status-online-bg text-status-online text-xs font-mono flex items-start gap-2 animate-fadeIn">
            <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{auth.recoverySuccessMessage}</span>
          </div>
        )}

        {!auth.showRecoveryOptions && !auth.showCompromisedFlow ? (
          <>
            {auth.authTab === 'login' ? (
              <LoginForm
                username={auth.username}
                setUsername={auth.setUsername}
                password={auth.password}
                setPassword={auth.setPassword}
                adminToken={auth.adminToken}
                setAdminToken={auth.setAdminToken}
                showPassword={auth.showPassword}
                setShowPassword={auth.setShowPassword}
                isAdminPortal={auth.isAdminPortal}
                requiresRegisterPermanentOtp={auth.requiresRegisterPermanentOtp}
                isPermanentOtp={auth.isPermanentOtp}
                onSubmit={auth.handleLoginSubmit}
                onShowRecovery={() => auth.setShowRecoveryOptions(true)}
                onShowHelpDesk={() => {
                  auth.setRecoveryView('track');
                  auth.setShowRecoveryOptions(true);
                }}
                onPasskeyLogin={auth.handlePasskeyLogin}
                onSwitchToRegister={() => auth.setAuthTab('register')}
                onOpenLegalDoc={(doc) => auth.setActiveLegalDoc(doc)}
              />
            ) : (
              <RegisterForm
                username={auth.username}
                setUsername={auth.setUsername}
                inviteCode={auth.inviteCode}
                setInviteCode={auth.setInviteCode}
                password={auth.password}
                setPassword={auth.setPassword}
                safeWord={auth.safeWord}
                setSafeWord={auth.setSafeWord}
                panicPhrase={auth.panicPhrase}
                setPanicPhrase={auth.setPanicPhrase}
                hasAgreedToTerms={auth.hasAgreedToTerms}
                setHasAgreedToTerms={auth.setHasAgreedToTerms}
                enableBiometrics={auth.enableBiometrics}
                setEnableBiometrics={auth.setEnableBiometrics}
                onSubmit={auth.handleRegisterSubmit}
                onSwitchToLogin={() => auth.setAuthTab('login')}
                onOpenLegalDoc={(doc) => auth.setActiveLegalDoc(doc)}
              />
            )}
          </>
        ) : auth.showCompromisedFlow ? (
          <CompromisedNotice
            compromiseTicketId={auth.compromiseTicketId}
            onReturnToLogin={auth.resetCompromisedState}
          />
        ) : (
          <AccountRecovery
            recoveryView={auth.recoveryView}
            setRecoveryView={auth.setRecoveryView}
            activeTicket={auth.activeTicket}
            ticketReplyText={auth.ticketReplyText}
            setTicketReplyText={auth.setTicketReplyText}
            recoveryUsername={auth.recoveryUsername}
            setRecoveryUsername={auth.setRecoveryUsername}
            recoverySafeWord={auth.recoverySafeWord}
            setRecoverySafeWord={auth.setRecoverySafeWord}
            recoveryCodeInput={auth.recoveryCodeInput}
            setRecoveryCodeInput={auth.setRecoveryCodeInput}
            recoveryNewPassword={auth.recoveryNewPassword}
            setRecoveryNewPassword={auth.setRecoveryNewPassword}
            redeemUsername={auth.redeemUsername}
            setRedeemUsername={auth.setRedeemUsername}
            redeemCode={auth.redeemCode}
            setRedeemCode={auth.setRedeemCode}
            redeemNewPassword={auth.redeemNewPassword}
            setRedeemNewPassword={auth.setRedeemNewPassword}
            ticketTrackingId={auth.ticketTrackingId}
            setTicketTrackingId={auth.setTicketTrackingId}
            onBackToLogin={auth.resetRecoveryState}
            onRestoreAccountSubmit={auth.handleRestoreAccountSubmit}
            onRedeemRestoreCodeSubmit={auth.handleRedeemRestoreCode}
            onQueryTicketSubmit={auth.handleQueryTicket}
            onTicketReplySubmit={auth.handleTicketReplySubmit}
          />
        )}
      </main>

      <footer className="w-full max-w-md mx-auto text-center pt-4" />

      <LegalDocModal docType={auth.activeLegalDoc} onClose={() => auth.setActiveLegalDoc(null)} />
    </div>
  );
}
