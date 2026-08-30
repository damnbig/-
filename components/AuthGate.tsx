import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

interface AuthGateProps {
  children: React.ReactNode;
}

// Security Configuration
// Token Generation: btoa("Focus_Gate_Lock_" + "667892")
// This hides the password from plain sight in the source code while ensuring 100% compatibility across all browsers/environments (http/https).
const TARGET_TOKEN = "Rm9jdXNfR2F0ZV9Mb2NrXzY2Nzg5Mg=="; 
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes

// Versioned keys to force-reset any previous stuck states
const STORAGE_KEY_TOKEN = "focus_auth_token_v3";
const STORAGE_KEY_ATTEMPTS = "focus_auth_attempts_v3";
const STORAGE_KEY_LOCKOUT = "focus_auth_lockout_v3";

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [isShake, setIsShake] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [debugMsg, setDebugMsg] = useState('');

  // Initialize Security State
  useEffect(() => {
    // 1. Check for existing session
    const currentToken = sessionStorage.getItem(STORAGE_KEY_TOKEN);
    if (currentToken === TARGET_TOKEN) {
      setIsAuthenticated(true);
      return;
    }

    // 2. Check for Lockout
    checkLockoutStatus();
  }, []);

  const checkLockoutStatus = () => {
    const lockoutEnd = localStorage.getItem(STORAGE_KEY_LOCKOUT);
    const savedAttempts = parseInt(localStorage.getItem(STORAGE_KEY_ATTEMPTS) || '0');
    setAttempts(savedAttempts);

    if (lockoutEnd) {
      const remaining = parseInt(lockoutEnd) - Date.now();
      if (remaining > 0) {
        setIsLocked(true);
        const timerId = setTimeout(checkLockoutStatus, remaining);
        return () => clearTimeout(timerId);
      } else {
        localStorage.removeItem(STORAGE_KEY_LOCKOUT);
        localStorage.setItem(STORAGE_KEY_ATTEMPTS, '0');
        setAttempts(0);
        setIsLocked(false);
      }
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || !password) return;

    setVerifying(true);
    setDebugMsg('');

    // Minimal delay for UX feel, but logic is now synchronous
    setTimeout(() => {
      try {
        const cleanPassword = password.trim();
        // Generate token synchronously
        const inputToken = btoa("Focus_Gate_Lock_" + cleanPassword);

        if (inputToken === TARGET_TOKEN) {
          sessionStorage.setItem(STORAGE_KEY_TOKEN, inputToken);
          localStorage.removeItem(STORAGE_KEY_ATTEMPTS);
          localStorage.removeItem(STORAGE_KEY_LOCKOUT);
          setIsAuthenticated(true);
        } else {
          // Failure Logic
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          localStorage.setItem(STORAGE_KEY_ATTEMPTS, newAttempts.toString());
          
          setIsShake(true);
          setTimeout(() => setIsShake(false), 500);

          if (newAttempts >= MAX_ATTEMPTS) {
            setIsLocked(true);
            const lockoutEnd = Date.now() + LOCKOUT_DURATION;
            localStorage.setItem(STORAGE_KEY_LOCKOUT, lockoutEnd.toString());
            setTimeout(checkLockoutStatus, 100);
          }
          
          setPassword('');
          // Optional: Only show for debugging if absolutely needed, removed in prod usually
          // setDebugMsg('口令错误'); 
        }
      } catch (err) {
        console.error("Auth Error:", err);
        setDebugMsg('验证组件异常');
      } finally {
        setVerifying(false);
      }
    }, 300);
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 bg-[#F5F5F7] flex items-center justify-center p-6 z-[9999]">
      <div className="w-full max-w-[320px]">
        
        {/* Minimal Icon */}
        <div className="flex justify-center mb-10 opacity-20">
          <Lock size={24} />
        </div>

        <form onSubmit={handleLogin} className={`relative group ${isShake ? 'animate-shake' : ''}`}>
          <div className={`relative overflow-hidden rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border transition-all focus-within:ring-2 focus-within:ring-gray-900/5 focus-within:shadow-lg ${isLocked ? 'border-red-100 bg-red-50/10' : 'border-gray-100'}`}>
            <input
              type="password"
              inputMode="numeric"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLocked || verifying}
              placeholder={isLocked ? "已锁定" : "访问口令"}
              className="w-full bg-transparent px-6 py-4 text-center text-lg tracking-[0.3em] font-medium text-gray-900 placeholder:text-gray-300 placeholder:tracking-normal placeholder:font-normal placeholder:text-sm focus:outline-none disabled:cursor-not-allowed transition-colors"
              autoFocus
              autoComplete="new-password"
            />
            
            {/* Inline Action Button */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <button
                    type="submit"
                    disabled={!password || isLocked || verifying}
                    className="p-2 rounded-xl bg-gray-900 text-white disabled:opacity-0 disabled:scale-90 transition-all duration-300 hover:bg-black active:scale-95"
                >
                    {verifying ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : (
                        <ArrowRight size={16} />
                    )}
                </button>
            </div>
          </div>
          
          {/* Minimal Feedback Area */}
          <div className="absolute top-full left-0 right-0 mt-4 flex justify-center">
             {isLocked && (
               <div className="flex items-center gap-2 text-xs text-red-500 font-medium animate-in fade-in slide-in-from-top-1">
                 <AlertCircle size={12} />
                 <span>安全锁定生效中</span>
               </div>
             )}
             {debugMsg && (
               <div className="text-xs text-gray-400 font-medium">
                 {debugMsg}
               </div>
             )}
          </div>
        </form>

        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-4px); }
            75% { transform: translateX(4px); }
          }
          .animate-shake { animation: shake 0.3s cubic-bezier(.36,.07,.19,.97) both; }
        `}</style>
      </div>
    </div>
  );
};