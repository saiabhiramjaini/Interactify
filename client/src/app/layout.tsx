import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { WebSocketProvider } from "@/context/WebSocketContext";
import GridBackgroundDemo from "@/components/ui/grid-background-demo";

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
        <WebSocketProvider>
          <div className="relative">
            <GridBackgroundDemo />
            <div className="relative z-10">
              {children}
            </div>
          </div>
        </WebSocketProvider>
        <Toaster />
      </body>
    </html>
  );
}
