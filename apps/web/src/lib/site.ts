const trimSlash = (url: string) => url.replace(/\/$/, '');

export const site = {
  name: 'CMSN-HR',
  tagline: 'People, payroll and time — in one HR platform.',
  description:
    'CMSN-HR is a cloud HRM and payroll platform for growing companies: employee records, attendance, leave, rosters, payroll, recruitment and employee self-service on web and mobile.',
  url: trimSlash(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:5173'),
  appUrl: trimSlash(process.env.NEXT_PUBLIC_ADMIN_APP_URL ?? 'http://localhost:5174'),
  contact: {
    salesEmail: 'sales@cmsnbd.com',
    supportEmail: 'support@cmsnbd.com',
    phone: '+880 1700-000000',
    hours: 'Sun–Thu, 9:00 AM – 6:00 PM (GMT+6)',
    address: ['House 12, Road 7, Gulshan 1', 'Dhaka 1212, Bangladesh'],
  },
} as const;

export const mainNav = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;
