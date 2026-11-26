import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = (searchParams.get('title') || 'CMSN-HR — Multi-Tenant HR, Payroll & Attendance')
    .slice(0, 96);
  const eyebrow = (searchParams.get('eyebrow') || 'Country-Configurable SaaS Platform').slice(
    0,
    48,
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          background: 'linear-gradient(135deg, #0f253c 0%, #1e4976 60%, #163759 100%)',
          color: '#ffffff',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                color: '#1e4976',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '22px',
              }}
            >
              HR
            </div>
            <span style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em' }}>
              CMSN-HR
            </span>
          </div>

          <div
            style={{
              padding: '8px 18px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(255, 255, 255, 0.14)',
              border: '1px solid rgba(255, 255, 255, 0.28)',
              fontSize: '18px',
              fontWeight: 600,
            }}
          >
            {eyebrow}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '960px' }}>
          <div
            style={{
              fontSize: '54px',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: '24px', color: 'rgba(226, 236, 248, 0.9)', lineHeight: 1.4 }}>
            Deterministic country payroll rules, offline-first mobile attendance, and strict tenant isolation.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '28px',
            fontSize: '18px',
            color: 'rgba(203, 218, 236, 0.85)',
          }}
        >
          <span>Payroll & Tax Engine</span>
          <span>•</span>
          <span>Offline Mobile Sync</span>
          <span>•</span>
          <span>Audit-Ready Compliance</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
