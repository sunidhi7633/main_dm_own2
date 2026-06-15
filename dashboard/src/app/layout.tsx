import type { Metadata } from "next";
import "./globals.css";
import NavBar from "./components/NavBar";
import { ToastProvider } from "./components/ToastProvider";

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
          <main>{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
