import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CircuitSathi — AI-Powered STEM Tutor",
  description: "An advanced STEM learning platform that transforms circuit schematics into an interactive AI-guided city simulation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
