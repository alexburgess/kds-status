import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
