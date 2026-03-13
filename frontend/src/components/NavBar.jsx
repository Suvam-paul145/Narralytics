import React from 'react';
import { LogOut, User, Zap } from 'lucide-react';

export default function NavBar({ user, onLogout }) {
  return (
    <nav style={{ 
      height: 70, background: "var(--bg-primary)", 
      borderBottom: "1px solid var(--border)", display: "flex",
      alignItems: "center", justifyContent: "space-between",
      padding: "0 32px", position: 'relative', zIndex: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: 32, height: 32, background: 'var(--accent)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px var(--accent-glow)' }}>
          <Zap size={18} color="white" fill="white" />
        </div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Narralytics
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingRight: '24px', borderRight: '1px solid var(--border)' }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{user.name || 'User'}</p>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Senior BI Analyst</p>
            </div>
            {user.picture ? (
              <img src={user.picture} alt="Avatar" style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--border)' }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--border)' }}>
                <User size={18} color="var(--text-muted)" />
              </div>
            )}
          </div>
        )}
        
        <button 
          onClick={onLogout}
          style={{ 
            background: 'transparent', border: 'none', color: 'var(--text-muted)', 
            display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600,
            transition: 'color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
          onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </nav>
  );
}
