import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Video, ShieldAlert, Lock, Mail, Loader, X, User } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';

export const Login = ({ onNavigate }) => {
  const { login, error, clearError, loginWithGoogle, loginWithSSO } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [validationErr, setValidationErr] = useState('');
  
  const [showSSOPrompt, setShowSSOPrompt] = useState(false);
  const [ssoProvider, setSsoProvider] = useState('');
  const [ssoEmail, setSsoEmail] = useState('');
  const [ssoName, setSsoName] = useState('');

  const ProviderIcons = {
    Google: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
      </svg>
    ),
    Apple: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 384 512" fill="currentColor">
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
      </svg>
    ),
    Microsoft: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" fill="#00a4ef"/>
      </svg>
    ),
    GitHub: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 496 512" fill="currentColor">
        <path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z"/>
      </svg>
    )
  };

  const handleSSOLoginClick = (provider) => {
    setSsoProvider(provider);
    setShowSSOPrompt(true);
    setSsoEmail('');
    setSsoName('');
  };

  const handleSSOSubmit = async (e) => {
    e.preventDefault();
    const emailLower = ssoEmail.toLowerCase();
    
    // Validations based on provider
    if (ssoProvider === 'Google' && !emailLower.endsWith('@gmail.com')) {
      setValidationErr('Please use a valid @gmail.com address for Google Login.');
      return;
    }
    if (ssoProvider === 'Microsoft' && !emailLower.endsWith('@outlook.com') && !emailLower.endsWith('@hotmail.com')) {
      setValidationErr('Please use a valid @outlook.com or @hotmail.com address.');
      return;
    }
    if (ssoProvider === 'Apple' && !emailLower.endsWith('@icloud.com') && !emailLower.endsWith('@me.com')) {
      setValidationErr('Please use a valid @icloud.com address.');
      return;
    }

    setShowSSOPrompt(false);
    setValidationErr('');
    clearError();
    setOauthLoading(true);
    
    setTimeout(async () => {
      try {
        await loginWithSSO(ssoEmail, ssoName || `${ssoProvider} User`, ssoProvider);
      } catch (err) {
        setValidationErr(err.message || `${ssoProvider} SSO login failed.`);
        setOauthLoading(false);
      }
    }, 1200);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationErr('');
    clearError();

    if (!email || !password) {
      setValidationErr('Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full overflow-hidden bg-slate-950">
      
      {/* Left Panel: Image & Quote */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-12 bg-slate-900 border-r border-white/10 shadow-2xl">
        <img 
          src="/meeting_video_call.png" 
          alt="Video Meeting" 
          className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
        
        {/* Brand Top Left */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-tr from-cyan-400 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Video className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-md">
            Intell<span className="text-purple-400">Meet</span>
          </h1>
        </div>

        {/* Quote Bottom Left */}
        <div className="relative z-10 max-w-lg mb-8">
          <h2 className="text-4xl font-bold text-white leading-tight mb-4 drop-shadow-lg">
            "Coming together is a beginning, staying together is progress, and working together is success."
          </h2>
          <p className="text-purple-300 font-semibold text-lg drop-shadow-md">- Henry Ford</p>
        </div>
      </div>

      {/* Right Panel: Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      
      {oauthLoading && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex flex-col items-center justify-center space-y-4">
          <Loader className="w-10 h-10 animate-spin text-purple-400" />
          <span className="text-sm font-bold text-gray-300">OAuth2 Secure Authenticating...</span>
        </div>
      )}

      {showSSOPrompt && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-[#121727] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative">
            <button 
              onClick={() => setShowSSOPrompt(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center mb-6 mt-2">
              <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-full flex items-center justify-center shadow-lg mb-3">
                {ProviderIcons[ssoProvider]}
              </div>
              <h3 className="text-lg font-bold text-white">{ssoProvider} Sign In</h3>
              <p className="text-xs text-gray-400 text-center mt-1">Enter your {ssoProvider} account details to proceed.</p>
            </div>
            <form onSubmit={handleSSOSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="email"
                    required
                    placeholder={`user@${ssoProvider.toLowerCase()}.com`}
                    value={ssoEmail}
                    onChange={(e) => setSsoEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1.5">Display Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={ssoName}
                    onChange={(e) => setSsoName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-black/30 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 mt-2 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all text-sm shadow-lg shadow-white/10"
              >
                Authenticate
              </button>
            </form>
          </div>
        </div>
      )}
      
      {/* Absolute Decorative Glow Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Glass Panel Card */}
      <div className="w-full max-w-md glass-panel rounded-2xl p-8 shadow-2xl relative z-10 glow-purple border border-white/5">
        
        {/* Brand Logo & Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-tr from-cyan-400 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20 mb-3">
            <Video className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">
            Intell<span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">Meet</span>
          </h1>
          <p className="text-gray-400 text-sm">AI-Powered Enterprise Collaboration</p>
        </div>

        {/* Errors & Alerts */}
        {(validationErr || error) && (
          <div className="mb-6 bg-red-950/40 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 text-red-200 text-sm">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <span>{validationErr || error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="w-5 h-5 text-gray-500" />
              </span>
              <input
                type="email"
                placeholder="you@enterprise.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/10 bg-black/30 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="w-5 h-5 text-gray-500" />
              </span>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/10 bg-black/30 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm"
              />
            </div>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={loading || oauthLoading}
            className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-purple-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
          >
            {loading ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : (
              'Sign In to Workspace'
            )}
          </button>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-[#121727] px-2 text-gray-500 font-extrabold tracking-wider">Or continue with</span>
            </div>
          </div>

          {/* Real Google OAuth Button */}
          <div className="flex justify-center mb-4">
            <GoogleLogin
              onSuccess={async (credentialResponse) => {
                setValidationErr('');
                clearError();
                setOauthLoading(true);
                try {
                  await loginWithGoogle(credentialResponse.credential);
                } catch (err) {
                  setValidationErr(err.message || 'Google OAuth2 login failed.');
                } finally {
                  setOauthLoading(false);
                }
              }}
              onError={() => {
                setValidationErr('Google Login was unsuccessful or canceled.');
              }}
              useOneTap
              theme="filled_black"
              shape="pill"
            />
          </div>

          {/* Other SSO Options */}
          <div className="grid grid-cols-3 gap-3">
            {['Microsoft', 'Apple', 'GitHub'].map(provider => (
              <button
                key={provider}
                type="button"
                onClick={() => handleSSOLoginClick(provider)}
                disabled={loading || oauthLoading}
                className="py-3 bg-black/40 hover:bg-black/60 border border-white/10 rounded-xl transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 text-white hover:scale-105"
                title={`Sign In with ${provider}`}
              >
                {ProviderIcons[provider]}
              </button>
            ))}
          </div>
        </form>

        {/* Footer Nav */}
        <div className="mt-8 text-center text-sm text-gray-400 border-t border-white/5 pt-6">
          Don't have an enterprise account?{' '}
          <button
            onClick={() => onNavigate('register')}
            className="text-cyan-400 hover:text-cyan-300 font-semibold transition-all ml-1 cursor-pointer"
          >
            Register here
          </button>
        </div>

      </div>
    </div>
  </div>
  );
};
