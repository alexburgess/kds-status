import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "KDS Status",
  description: "Fleet diagnostics for Square KDS tablets"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Script src="https://kit.fontawesome.com/2c3f50892e.js" crossOrigin="anonymous" strategy="afterInteractive" />
        {children}
      </body>
    </html>
  );
}
