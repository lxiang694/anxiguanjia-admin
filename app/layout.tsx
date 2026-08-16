import type { Metadata, Viewport } from 'next';

import './globals.css';
import { BRAND } from '@/lib/labels';

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} · 业务后台`,
    template: `%s · ${BRAND.name}`,
  },
  description: `${BRAND.tagline}。${BRAND.name}三端业务管理系统。`,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#1F4D3A',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
