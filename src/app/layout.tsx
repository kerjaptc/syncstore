import type { Metadata } from "next";
import { Geist, Geist_Mono, Parkinsans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/theme-provider";
import { CriticalErrorBoundary } from "@/lib/error-handling";
import { setupGlobalErrorHandling } from "@/lib/error-handling/global-handler";
import "./globals.css";

// Initialize global error handling
if (typeof window !== 'undefined') {
  setupGlobalErrorHandling();
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const parkinsans = Parkinsans({
  variable: "--font-parkinsans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  fallback: ["system-ui", "sans-serif"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: {
    default: 'SyncStore - Cross-Platform E-Commerce Management',
    template: '%s | SyncStore',
  },
  description:
    'Unified e-commerce management system for multi-platform selling operations. Synchronize inventory, manage orders, and grow your business across Shopee, TikTok Shop, and custom websites.',
  keywords: [
    'e-commerce',
    'multi-platform',
    'inventory management',
    'order management',
    'shopee',
    'tiktok shop',
    'synchronization',
  ],
  authors: [{ name: 'SyncStore Team' }],
  creator: 'SyncStore Team',
  publisher: 'SyncStore',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.className} ${geistMono.className} ${parkinsans.className} antialiased`}
        >
          <CriticalErrorBoundary>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              {children}
            </ThemeProvider>
          </CriticalErrorBoundary>
        </body>
      </html>
    </ClerkProvider>
  );
}
