import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { WebSocketProvider } from "@/context/WebSocketContext";

export const metadata: Metadata = {
  title: "Interactify",
  description: "“Igniting real-time audience interaction",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <WebSocketProvider>{children}</WebSocketProvider>
        <Toaster />
      </body>
    </html>
  );
}
