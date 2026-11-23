import { useEffect, useState } from 'react';
import { cloudConfigured, signInWithEmail, signInWithGoogle } from '../services/cloud';
import { useAccount } from '../store/useAccount';

const STATUS_TEXT = {
  idle: '',
  syncing: 'Syncing…',
  synced: 'Stats synced',
  error: 'Sync failed',
} as const;

/** Optional sign-in for cloud save. Renders nothing when accounts aren't configured. */
export function AccountPanel() {
  const { user, status, error, init, signOut } = useAccount();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    void init();
  }, [init]);

  if (!cloudConfigured) return null;

  if (user) {
    return (
      <div className="account" data-testid="account">
        <div className="account-line">
          <span>
            Signed in as <b>{user.email}</b>
          </span>
          <span className={`sync ${status}`}>{STATUS_TEXT[status]}</span>
        </div>
        {error && <p className="form-error">{error}</p>}
        <button type="button" className="ghost-btn" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    );
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setFormError(null);
    try {
      await fn();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="account" data-testid="account">
      <span className="field-label">Account (optional)</span>
      <p className="muted small">
        Sign in to keep your stats and settings across devices. Playing as a guest works too.
      </p>
      {sent ? (
        <p>Check your email for a sign-in link.</p>
      ) : (
        <form
          className="account-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (email)
              void run(async () => {
                await signInWithEmail(email);
                setSent(true);
              });
          }}
        >
          <input
            type="email"
            required
            placeholder="you@example.com"
            aria-label="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <button type="submit" className="ghost-btn" disabled={busy}>
            Email me a link
          </button>
        </form>
      )}
      <button
        type="button"
        className="ghost-btn"
        disabled={busy}
        onClick={() => void run(signInWithGoogle)}
      >
        Continue with Google
      </button>
      {formError && <p className="form-error">{formError}</p>}
    </div>
  );
}
