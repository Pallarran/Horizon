import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Horizon",
  description: "Personal finance & retirement planning",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
