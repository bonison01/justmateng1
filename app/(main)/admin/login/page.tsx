//app/(main)/admin/login
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/admin/dashboard';

  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Single form, two possible accounts. Try the admin table first —
      // most people landing on this page are admins, so this keeps the
      // common case to one request. Only on an actual "wrong
      // credentials" result do we retry against the staff table, so a
      // real server error (500) on the admin check surfaces immediately
      // instead of being masked by a second failing request.
      const adminRes = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrPhone, password }),
      });

      if (adminRes.ok) {
        // Session cookie is set server-side as httpOnly by the API
        // route above — there is nothing to store here. It can't (and
        // shouldn't) be read by client JS; that's what makes it secure
        // against XSS-based token theft. middleware.ts verifies it on
        // every request to /admin/*.
        router.push(redirect);
        return;
      }

      if (adminRes.status !== 401) {
        const adminData = await adminRes.json().catch(() => ({}));
        setError(adminData.message || 'Login failed.');
        return;
      }

      // Admin check said "invalid credentials" — try staff before
      // giving up, rather than assuming the person typed something
      // wrong.
      const staffRes = await fetch('/api/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrPhone, password }),
      });

      const staffData = await staffRes.json().catch(() => ({}));

      if (!staffRes.ok) {
        if (staffRes.status === 401) {
          // Neither account matched — show one generic message rather
          // than revealing which check failed.
          setError('Invalid credentials.');
        } else {
          // The staff endpoint itself failed (500, etc.) — this is NOT
          // the same as a wrong password, and hiding that distinction
          // makes a broken server look like a typo. Surface it plainly.
          setError(staffData.message || 'Something went wrong checking staff login. Please try again.');
        }
        return;
      }

      router.push(redirect);
    } catch (err) {
      console.error('Login error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
          padding: 32,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: 0 }}>Admin Login</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>
            Restricted area. Staff and admin credentials both work here.
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Email or Phone
            </label>
            <input
              type="text"
              value={emailOrPhone}
              onChange={e => setEmailOrPhone(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                fontSize: 14,
                color: '#111827',
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                fontSize: 14,
                color: '#111827',
              }}
            />
          </div>

          {error && (
            <div
              style={{
                background: '#fee2e2',
                color: '#991b1b',
                fontSize: 13,
                padding: '10px 14px',
                borderRadius: 10,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 18px',
              borderRadius: 10,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              background: loading ? '#9ca3af' : '#111827',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>}>
      <AdminLoginContent />
    </Suspense>
  );
}