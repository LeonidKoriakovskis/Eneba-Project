import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, KeyRound, Loader2, Lock, Mail, Sparkles, User } from 'lucide-react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { sanitizeRedirect } from '../utils/format';
import { useDocumentTitle } from '../utils/hooks';

interface AuthPageProps {
  mode: 'login' | 'register';
}

export interface AuthValidationParams {
  isRegister: boolean;
  fullName: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

/** Validates sign-in or registration form inputs and returns an inline error message, or null when valid. */
export function validateAuthInput({
  isRegister,
  fullName,
  email,
  password,
  confirmPassword = '',
}: AuthValidationParams): string | null {
  const trimmedEmail = email.trim();
  const trimmedName = fullName.trim();

  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    return 'Please enter a valid email address.';
  }
  if (isRegister && trimmedName.length < 2) {
    return 'Full name must be at least 2 characters.';
  }
  if (isRegister && password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (isRegister && password !== confirmPassword) {
    return 'Passwords do not match';
  }
  if (!isRegister && !password) {
    return 'Please enter your password.';
  }
  return null;
}

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  autoComplete: string;
  placeholder: string;
  minLength: number;
  className: string;
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggleVisible,
  autoComplete,
  placeholder,
  minLength,
  className,
}: PasswordFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-eneba-muted">
        {label}
      </span>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-eneba-muted" aria-hidden />
        <input
          type={visible ? 'text' : 'password'}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-none p-1 text-eneba-muted transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-eneba-yellow"
        >
          {visible ? <FiEyeOff className="h-4 w-4" aria-hidden /> : <FiEye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    </label>
  );
}

export default function AuthPage({ mode }: AuthPageProps) {
  const isRegister = mode === 'register';
  useDocumentTitle(isRegister ? 'Create Account' : 'Sign In');

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, login, register } = useAuth();

  const rawRedirect = searchParams.get('redirect');
  const redirectTarget = sanitizeRedirect(rawRedirect, '/');
  const redirectQuery = rawRedirect ? `?redirect=${encodeURIComponent(redirectTarget)}` : '';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError(null);
  }, [mode]);

  if (isAuthenticated) {
    return <Navigate to={redirectTarget} replace />;
  }

  const fillDemoBuyer = () => {
    setEmail('gamer@eneba-demo.com');
    setPassword('Password123!');
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validateAuthInput({
      isRegister,
      fullName,
      email,
      password,
      confirmPassword,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    const trimmedEmail = email.trim();
    const trimmedName = fullName.trim();

    setSubmitting(true);
    try {
      if (isRegister) {
        await register({ email: trimmedEmail, password, full_name: trimmedName });
      } else {
        await login(trimmedEmail, password);
      }
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-none bg-eneba-canvas/80 py-3 pl-11 pr-4 text-sm font-medium text-white placeholder-eneba-muted ring-1 ring-inset ring-white/15 transition focus:bg-eneba-canvas focus:outline-none focus:ring-2 focus:ring-eneba-yellow';
  const passwordInputClass =
    'w-full rounded-none bg-eneba-canvas/80 py-3 pl-11 pr-11 text-sm font-medium text-white placeholder-eneba-muted ring-1 ring-inset ring-white/15 transition focus:bg-eneba-canvas focus:outline-none focus:ring-2 focus:ring-eneba-yellow';

  return (
    <div className="mx-auto max-w-md py-6">
      <div className="overflow-hidden rounded-none bg-eneba-card shadow-card ring-1 ring-white/10">
        {/* Mode Switch Tabs */}
        <div className="grid grid-cols-2 border-b border-white/10 bg-black/20">
          <Link
            to={`/login${redirectQuery}`}
            className={`py-4 text-center text-sm font-extrabold transition ${
              !isRegister ? 'border-b-2 border-eneba-yellow text-eneba-yellow' : 'text-eneba-muted hover:text-white'
            }`}
          >
            Sign In
          </Link>
          <Link
            to={`/register${redirectQuery}`}
            className={`py-4 text-center text-sm font-extrabold transition ${
              isRegister ? 'border-b-2 border-eneba-yellow text-eneba-yellow' : 'text-eneba-muted hover:text-white'
            }`}
          >
            Create Account
          </Link>
        </div>

        <div className="p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-black">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
            <p className="mt-1 text-sm text-eneba-muted">
              {redirectTarget === '/checkout'
                ? 'Sign in or register to complete your checkout and reveal your keys.'
                : isRegister
                  ? 'Join to purchase instant digital keys and track your orders.'
                  : 'Sign in to access checkout and your purchased game keys.'}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-none bg-eneba-magenta/15 p-3.5 text-sm font-semibold text-white ring-1 ring-eneba-magenta/50"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-eneba-magenta" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {isRegister && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-eneba-muted">
                  Full Name
                </span>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-eneba-muted" aria-hidden />
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    autoComplete="name"
                    placeholder="Alex Gamer"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-eneba-muted">
                Email Address
              </span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-eneba-muted" aria-hidden />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="gamer@eneba-demo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
            </label>

            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              visible={showPassword}
              onToggleVisible={() => setShowPassword((prev) => !prev)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              placeholder={isRegister ? 'At least 8 characters' : 'Enter your password'}
              minLength={isRegister ? 8 : 1}
              className={passwordInputClass}
            />

            {isRegister && (
              <PasswordField
                label="Confirm Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                visible={showConfirmPassword}
                onToggleVisible={() => setShowConfirmPassword((prev) => !prev)}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                minLength={8}
                className={passwordInputClass}
              />
            )}

            <button type="submit" disabled={submitting} className="btn-yellow mt-2 w-full py-3.5 text-base">
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  {isRegister ? 'Creating account…' : 'Signing in…'}
                </>
              ) : (
                <>
                  <KeyRound className="h-5 w-5" aria-hidden />
                  {isRegister ? 'Create Account & Continue' : 'Sign In'}
                </>
              )}
            </button>
          </form>

          {!isRegister && (
            <div className="mt-6 rounded-none bg-eneba-canvas/60 p-4 ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-eneba-teal">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    Demo Account
                  </div>
                  <p className="mt-0.5 truncate text-xs text-eneba-muted">gamer@eneba-demo.com / Password123!</p>
                </div>
                <button
                  type="button"
                  onClick={fillDemoBuyer}
                  className="shrink-0 rounded-none bg-eneba-brand px-3 py-1.5 text-xs font-extrabold text-white ring-1 ring-white/15 transition hover:bg-eneba-cardHover"
                >
                  Quick-fill
                </button>
              </div>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-eneba-muted">
            {isRegister ? (
              <>
                Already have an account?{' '}
                <Link to={`/login${redirectQuery}`} className="font-bold text-eneba-yellow hover:underline">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New to Eneba?{' '}
                <Link to={`/register${redirectQuery}`} className="font-bold text-eneba-yellow hover:underline">
                  Create an account
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
