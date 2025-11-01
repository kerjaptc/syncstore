import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";

export const metadata: Metadata = {
  title: {
    default: 'Store - StoreSync',
    template: '%s | Store - StoreSync',
  },
  description: 'Shop our products online with secure checkout and fast delivery.',
};

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <StorefrontHeader />
      <main className="flex-1">
        {children}
      </main>
      <StorefrontFooter />
    </div>
  );
}