import type { Metadata } from "next";
import "./globals.css";
import NavBar from "./components/NavBar";
import { ToastProvider } from "./components/ToastProvider";
import ErrorBoundary from "./components/ErrorBoundary";

export const metadata: Metadata = {
  title: "Harshwal Automation",
  description: "Internal marketing automation and competitive intelligence platform for Harshwal & Company LLP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <NavBar />
          <main><ErrorBoundary>{children}</ErrorBoundary></main>
        </ToastProvider>
      </body>
    </html>
  );
}
