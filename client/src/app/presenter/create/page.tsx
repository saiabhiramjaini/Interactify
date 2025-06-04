"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Presentation, Mic, Users } from "lucide-react";
import { toast } from "sonner";
import { useWebSocket } from "@/context/WebSocketContext";
import { motion } from "framer-motion";

export default function CreateSession() {
  const router = useRouter();
  const [sessionName, setSessionName] = useState("");
  const [presenterName, setPresenterName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { sendMessage, lastMessage } = useWebSocket();

  useEffect(() => {
    if (lastMessage?.type === "sessionCreated") {
      const { session } = lastMessage.payload;
      toast.success("Session created successfully!");
      router.push(
        `/presenter/session/${session.roomId}?name=${encodeURIComponent(
          session.sessionName
        )}&presenter=${encodeURIComponent(session.owner)}`
      );
    } else if (lastMessage?.type === "error") {
      toast.error(lastMessage.payload.message);
      setIsCreating(false);
    }
  }, [lastMessage, router]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    sendMessage({
      type: "create",
      payload: {
        sessionName,
        owner: presenterName,
      },
    });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center ">
      {/* Decorative background elements */}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="relative overflow-hidden border border-gray-200/50 bg-white/80 shadow-xl backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-900/80">
          {/* Card accent */}
          <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-blue-500 to-purple-500" />

          <CardHeader>
            <div className="flex items-start">
              <Link href="/">
                <Button variant="ghost" size="icon" className="mr-3">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <Presentation className="h-6 w-6 text-blue-500" />
                  <CardTitle className="text-2xl font-bold">
                    Create New Session
                  </CardTitle>
                </div>
                <CardDescription className="mt-1 text-base">
                  Set up your interactive Q&A presentation
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <form onSubmit={handleCreateSession}>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label
                  htmlFor="session-name"
                  className="flex items-center gap-2 text-sm font-medium"
                >
                  <Mic className="h-4 w-4 text-blue-500" />
                  Session Name
                </Label>
                <Input
                  id="session-name"
                  placeholder="e.g., Product Launch Q&A"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="border-gray-300 bg-white/50 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800/50"
                  required
                />
              </div>

              <div className="space-y-3">
                <Label
                  htmlFor="presenter-name"
                  className="flex items-center gap-2 text-sm font-medium"
                >
                  <Users className="h-4 w-4 text-purple-500" />
                  Your Name
                </Label>
                <Input
                  id="presenter-name"
                  placeholder="e.g., John Smith"
                  value={presenterName}
                  onChange={(e) => setPresenterName(e.target.value)}
                  className="border-gray-300 bg-white/50 focus:border-purple-500 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800/50"
                  required
                />
              </div>

              <div className="rounded-lg bg-blue-50/50 p-4 dark:bg-blue-900/20">
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  <span className="font-semibold">Tip:</span> Choose a
                  descriptive session name that attendees will recognize.
                </p>
              </div>
            </CardContent>

            <CardFooter>
              <Button
                type="submit"
                className="w-full gap-2 bg-gradient-to-r from-blue-500 to-purple-500 text-lg font-medium hover:from-blue-600 hover:to-purple-600"
                disabled={!sessionName || !presenterName || isCreating}
              >
                {isCreating ? (
                  <>
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  "Create Session"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
