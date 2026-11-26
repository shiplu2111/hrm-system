import { ImageResponse } from 'next/og';
import { createTranslator, DEFAULT_LOCALE, getDictionary } from '../i18n';

export const alt = 'CMSN-HR — Global HR, Multi-Country Payroll & Attendance Platform';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  const dict = getDictionary(DEFAULT_LOCALE);
  const t = createTranslator(dict);

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #0b1c36 0%, #102a52 55%, #1e4976 100%)',
          padding: '64px',
          color: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '10px 20px',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              fontSize: '20px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#93c5fd',
            }}
          >
            <span>{t('brand.fullName')}</span>
          </div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 500,
              color: '#cbd5e1',
            }}
          >
            Multi-Country HR & Payroll
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            maxWidth: '980px',
          }}
        >
          <div
            style={{
              fontSize: '58px',
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: '-0.025em',
              color: '#ffffff',
            }}
          >
            {t('meta.ogTitle')}
          </div>
          <div
            style={{
              fontSize: '26px',
              lineHeight: 1.4,
              color: '#cbd5e1',
            }}
          >
            {t('meta.ogDescription')}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(255, 255, 255, 0.16)',
            paddingTop: '24px',
            fontSize: '20px',
            color: '#e2e8f0',
          }}
        >
          <span>Deterministic Payroll • Offline Attendance • Country Rules</span>
          <span style={{ color: '#60a5fa', fontWeight: 600 }}>cmsn-hr.com</span>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
