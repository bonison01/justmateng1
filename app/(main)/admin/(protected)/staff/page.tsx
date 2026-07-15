// app/(main)/admin/(protected)/staff/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { SECTION_KEYS, SECTION_LABELS, type SectionKey } from '@/lib/permissions';

interface Role {
  id: string;
  name: string;
  description: string | null;
  sections: string[];
}

interface StaffMember {
  id: string;
  name: string;
  email_or_phone: string;
  status: 'active' | 'disabled';
  staff_roles: { id: string; name: string } | null;
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 14,
  padding: 24,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
  fontSize: 13,
  color: '#111827',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  display: 'block',
  marginBottom: 6,
};

const buttonStyle: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  background: '#111827',
  color: '#fff',
  fontWeight: 700,
  fontSize: 13,
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: '#fff',
  color: '#374151',
  border: '1px solid #e5e7eb',
};

export default function StaffAdminPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; kind: 'error' | 'success' } | null>(null);

  // New role form
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newRoleSections, setNewRoleSections] = useState<Set<SectionKey>>(new Set());
  const [creatingRole, setCreatingRole] = useState(false);

  // Editing an existing role's sections
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingSections, setEditingSections] = useState<Set<SectionKey>>(new Set());
  const [savingRole, setSavingRole] = useState(false);

  // New staff form
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffContact, setNewStaffContact] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRoleId, setNewStaffRoleId] = useState('');
  const [creatingStaff, setCreatingStaff] = useState(false);

  const showMessage = (text: string, kind: 'error' | 'success') => {
    setMessage({ text, kind });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, staffRes] = await Promise.all([
        fetch('/api/admin/staff-roles'),
        fetch('/api/admin/staff'),
      ]);
      const rolesData = await rolesRes.json();
      const staffData = await staffRes.json();

      if (rolesRes.ok) setRoles(rolesData.roles ?? []);
      if (staffRes.ok) setStaff(staffData.staff ?? []);
    } catch {
      showMessage('Failed to load staff and roles.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleSection = (set: Set<SectionKey>, setFn: (s: Set<SectionKey>) => void, key: SectionKey) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setFn(next);
  };

  // Wraps fetch + res.json() so a bad response (empty body, non-JSON,
  // network failure) never throws an unhandled exception that silently
  // kills a click handler. Every handler below goes through this, so a
  // failure always ends up in the error banner via showMessage instead
  // of vanishing into the console.
  const safeFetchJson = async (
    input: string,
    init?: RequestInit
  ): Promise<{ ok: boolean; data: any }> => {
    try {
      const res = await fetch(input, init);
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        // Response had no valid JSON body — happens if the server threw
        // before returning a response at all.
        data = { message: 'Server returned an unexpected response.' };
      }
      return { ok: res.ok, data };
    } catch {
      // fetch itself failed — offline, network error, etc.
      return { ok: false, data: { message: 'Could not reach the server. Check your connection.' } };
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setCreatingRole(true);
    try {
      const { ok, data } = await safeFetchJson('/api/admin/staff-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoleName,
          description: newRoleDescription || null,
          sections: Array.from(newRoleSections),
        }),
      });
      if (!ok) {
        showMessage(data.message || 'Failed to create role.', 'error');
        return;
      }
      setNewRoleName('');
      setNewRoleDescription('');
      setNewRoleSections(new Set());
      showMessage('Role created.', 'success');
      loadData();
    } finally {
      setCreatingRole(false);
    }
  };

  const startEditingRole = (role: Role) => {
    setEditingRoleId(role.id);
    setEditingSections(new Set(role.sections as SectionKey[]));
  };

  const handleSaveRoleSections = async (roleId: string) => {
    setSavingRole(true);
    try {
      const { ok, data } = await safeFetchJson(`/api/admin/staff-roles/${roleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: Array.from(editingSections) }),
      });
      if (!ok) {
        showMessage(data.message || 'Failed to update role.', 'error');
        return;
      }
      setEditingRoleId(null);
      showMessage('Role permissions updated.', 'success');
      loadData();
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!confirm(`Delete role "${roleName}"? Staff assigned to it will lose access until reassigned.`)) return;
    const { ok, data } = await safeFetchJson(`/api/admin/staff-roles/${roleId}`, { method: 'DELETE' });
    if (!ok) {
      showMessage(data.message || 'Failed to delete role.', 'error');
      return;
    }
    showMessage('Role deleted.', 'success');
    loadData();
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffContact.trim() || !newStaffPassword) return;
    setCreatingStaff(true);
    try {
      const { ok, data } = await safeFetchJson('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStaffName,
          emailOrPhone: newStaffContact,
          password: newStaffPassword,
          roleId: newStaffRoleId || null,
        }),
      });
      if (!ok) {
        showMessage(data.message || 'Failed to create staff account.', 'error');
        return;
      }
      setNewStaffName('');
      setNewStaffContact('');
      setNewStaffPassword('');
      setNewStaffRoleId('');
      showMessage('Staff account created.', 'success');
      loadData();
    } finally {
      setCreatingStaff(false);
    }
  };

  const handleUpdateStaffRole = async (staffId: string, roleId: string) => {
    const { ok, data } = await safeFetchJson(`/api/admin/staff/${staffId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleId: roleId || null }),
    });
    if (!ok) {
      showMessage(data.message || 'Failed to update role.', 'error');
      return;
    }
    showMessage('Role updated.', 'success');
    loadData();
  };

  const handleToggleStaffStatus = async (member: StaffMember) => {
    const nextStatus = member.status === 'active' ? 'disabled' : 'active';
    const { ok, data } = await safeFetchJson(`/api/admin/staff/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!ok) {
      showMessage(data.message || 'Failed to update status.', 'error');
      return;
    }
    loadData();
  };

  const handleDeleteStaff = async (staffId: string, name: string) => {
    if (!confirm(`Delete staff account for "${name}"? This cannot be undone.`)) return;
    const { ok, data } = await safeFetchJson(`/api/admin/staff/${staffId}`, { method: 'DELETE' });
    if (!ok) {
      showMessage(data.message || 'Failed to delete staff account.', 'error');
      return;
    }
    showMessage('Staff account deleted.', 'success');
    loadData();
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p style={{ color: '#6b7280', fontSize: 14 }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>Staff &amp; Roles</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Create roles that bundle access to sections, then assign staff accounts to them.
        </p>
      </div>

      {message && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 13,
            background: message.kind === 'error' ? '#fee2e2' : '#ecfdf5',
            color: message.kind === 'error' ? '#991b1b' : '#065f46',
          }}
        >
          {message.text}
        </div>
      )}

      {/* ---------------- Roles ---------------- */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>Roles</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {roles.length === 0 && (
            <p style={{ fontSize: 13, color: '#9ca3af' }}>No roles yet — create one below.</p>
          )}

          {roles.map(role => (
            <div key={role.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{role.name}</div>
                  {role.description && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{role.description}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {editingRoleId === role.id ? (
                    <>
                      <button
                        style={buttonStyle}
                        disabled={savingRole}
                        onClick={() => handleSaveRoleSections(role.id)}
                      >
                        {savingRole ? 'Saving…' : 'Save'}
                      </button>
                      <button style={secondaryButtonStyle} onClick={() => setEditingRoleId(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button style={secondaryButtonStyle} onClick={() => startEditingRole(role)}>
                        Edit access
                      </button>
                      <button
                        style={{ ...secondaryButtonStyle, color: '#991b1b' }}
                        onClick={() => handleDeleteRole(role.id, role.name)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: 8,
                }}
              >
                {SECTION_KEYS.map(key => {
                  const isEditing = editingRoleId === role.id;
                  const checked = isEditing ? editingSections.has(key) : role.sections.includes(key);
                  return (
                    <label
                      key={key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 12,
                        color: isEditing ? '#111827' : checked ? '#111827' : '#9ca3af',
                        padding: '6px 10px',
                        borderRadius: 8,
                        background: checked ? '#ecfdf5' : '#f9fafb',
                        cursor: isEditing ? 'pointer' : 'default',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!isEditing}
                        onChange={() => toggleSection(editingSections, setEditingSections, key)}
                      />
                      {SECTION_LABELS[key]}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleCreateRole} style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 14 }}>Create a role</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Role name</label>
              <input
                style={inputStyle}
                value={newRoleName}
                onChange={e => setNewRoleName(e.target.value)}
                placeholder="e.g. Cargo Manager"
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Description (optional)</label>
              <input
                style={inputStyle}
                value={newRoleDescription}
                onChange={e => setNewRoleDescription(e.target.value)}
                placeholder="What this role is for"
              />
            </div>
          </div>

          <label style={labelStyle}>Sections this role can access</label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 8,
              marginBottom: 16,
            }}
          >
            {SECTION_KEYS.map(key => (
              <label
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: '#111827',
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: newRoleSections.has(key) ? '#ecfdf5' : '#f9fafb',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={newRoleSections.has(key)}
                  onChange={() => toggleSection(newRoleSections, setNewRoleSections, key)}
                />
                {SECTION_LABELS[key]}
              </label>
            ))}
          </div>

          <button type="submit" style={buttonStyle} disabled={creatingRole}>
            {creatingRole ? 'Creating…' : 'Create role'}
          </button>
        </form>
      </section>

      {/* ---------------- Staff ---------------- */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>Staff accounts</h2>

        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: '#374151' }}>Name</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: '#374151' }}>Email / Phone</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: '#374151' }}>Role</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: '#374151' }}>Status</th>
                <th style={{ padding: '10px 16px', fontWeight: 600, color: '#374151' }}></th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '16px', color: '#9ca3af' }}>
                    No staff accounts yet — add one below.
                  </td>
                </tr>
              )}
              {staff.map(member => (
                <tr key={member.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 16px', color: '#111827' }}>{member.name}</td>
                  <td style={{ padding: '10px 16px', color: '#6b7280' }}>{member.email_or_phone}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <select
                      value={member.staff_roles?.id ?? ''}
                      onChange={e => handleUpdateStaffRole(member.id, e.target.value)}
                      style={{ ...inputStyle, padding: '6px 8px', width: 'auto' }}
                    >
                      <option value="">No role</option>
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <button
                      onClick={() => handleToggleStaffStatus(member)}
                      style={{
                        ...secondaryButtonStyle,
                        padding: '4px 10px',
                        fontSize: 11,
                        color: member.status === 'active' ? '#065f46' : '#991b1b',
                        background: member.status === 'active' ? '#ecfdf5' : '#fee2e2',
                        border: 'none',
                      }}
                    >
                      {member.status === 'active' ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDeleteStaff(member.id, member.name)}
                      style={{ background: 'none', border: 'none', color: '#991b1b', fontSize: 12, cursor: 'pointer' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form onSubmit={handleCreateStaff} style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 14 }}>Add a staff account</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input style={inputStyle} value={newStaffName} onChange={e => setNewStaffName(e.target.value)} required />
            </div>
            <div>
              <label style={labelStyle}>Email or Phone</label>
              <input
                style={inputStyle}
                value={newStaffContact}
                onChange={e => setNewStaffContact(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Temporary password</label>
              <input
                type="password"
                style={inputStyle}
                value={newStaffPassword}
                onChange={e => setNewStaffPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <select
                style={inputStyle}
                value={newStaffRoleId}
                onChange={e => setNewStaffRoleId(e.target.value)}
              >
                <option value="">No role (no section access)</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" style={buttonStyle} disabled={creatingStaff}>
            {creatingStaff ? 'Creating…' : 'Create staff account'}
          </button>
        </form>
      </section>
    </div>
  );
}