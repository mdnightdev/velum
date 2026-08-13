import React from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { LegalDocModal } from './LegalDocModal';
import { useAuthForm } from './Auth/hooks/useAuthForm';
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

export default function AuthPortal({ isDark, onLoginSuccess, onMigrationRequired }: AuthPortalProps) {
  const auth = useAuthForm({ onLoginSuccess, onMigrationRequired });

  return (
    <div className={`h-full flex items-center justify-center p-4 font-sans ${isDark ? 'bg-velum-850 text-text-primary' : 'bg-velum-900 text-text-disabled'}`}>
      <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl relative overflow-hidden transition-all duration-300 ${isDark ? 'bg-velum-800 border-white-5' : 'bg-text-primary border-gray-200'}`}>
        
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
            <div className="flex border-b border-white-5 mb-6">
              <button
                onClick={() => auth.setAuthTab('login')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all ${auth.authTab === 'login' ? 'text-accent border-b-2 border-accent' : 'text-text-secondary hover:text-text-primary'}`}
              >
                Sign In
              </button>
              <button
                onClick={() => auth.setAuthTab('register')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all ${auth.authTab === 'register' ? 'text-accent border-b-2 border-accent' : 'text-text-secondary hover:text-text-primary'}`}
              >
                Registration
              </button>
            </div>

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
      </div>

      <LegalDocModal docType={auth.activeLegalDoc} onClose={() => auth.setActiveLegalDoc(null)} />
    </div>
  );
}
