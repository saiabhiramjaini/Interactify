"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
import { ArrowLeft, LogIn, Hash, User } from "lucide-react";
import { toast } from "sonner";
import { useWebSocket } from "@/context/WebSocketContext";
import { generateAttendeeId } from "@/utils/generateAttendeeId";
import { randomName } from "@/utils/generateAttendeeName";
import { motion } from "framer-motion";

function JoinSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [roomCode, setRoomCode] = useState("");
  const [attendeeName, setAttendeeName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [attendeeId, setAttendeeId] = useState("");
  const { sendMessage, lastMessage } = useWebSocket();

  useEffect(() => {
    const codeFromUrl = searchParams.get("code");
    if (codeFromUrl) {
      setRoomCode(codeFromUrl);
    }
    setAttendeeName(randomName);
    setAttendeeId(generateAttendeeId());
  }, [searchParams]);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case "sessionJoined":
        router.push(
          `/attendee/session/${roomCode}?name=${encodeURIComponent(
            attendeeName
          )}&id=${attendeeId}`
        );
        break;

      case "error":
        toast.error(lastMessage.payload.message);
        setIsJoining(false);
        break;
    }
  }, [lastMessage, router, roomCode, attendeeName, attendeeId]);

  const handleJoinSession = (e: React.FormEvent) => {
    e.preventDefault();

    if (!roomCode || !attendeeName) {
      toast.error("Please enter both room code and your name");
      return;
    }

    setIsJoining(true);

    sendMessage({
      type: "join",
      payload: {
        roomId: roomCode,
        attendee: {
          id: attendeeId,
          name: attendeeName || randomName,
        },
      },
    });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center ">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="relative overflow-hidden border border-gray-200/50 bg-white/80 shadow-xl backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-900/80">
          {/* Card accent */}
          <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-purple-500 to-blue-500" />

          <CardHeader>
            <div className="flex items-start">
              <Link href="/">
                <Button variant="ghost" size="icon" className="mr-3">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <LogIn className="h-6 w-6 text-purple-500" />
                  <CardTitle className="text-2xl font-bold">
                    Join Session
                  </CardTitle>
                </div>
                <CardDescription className="mt-1 text-base">
                  Enter the code provided by the presenter
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <form onSubmit={handleJoinSession}>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label
                  htmlFor="room-code"
                  className="flex items-center gap-2 text-sm font-medium"
                >
                  <Hash className="h-4 w-4 text-purple-500" />
                  Room Code
                </Label>
                <Input
                  id="room-code"
                  placeholder="e.g., ABC123"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="text-center text-lg font-bold tracking-wider border-gray-300 bg-white/50 focus:border-purple-500 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800/50"
                  required
                />
              </div>

              <div className="space-y-3">
                <Label
                  htmlFor="attendee-name"
                  className="flex items-center gap-2 text-sm font-medium"
                >
                  <User className="h-4 w-4 text-blue-500" />
                  Your Name
                </Label>
                <Input
                  id="attendee-name"
                  placeholder="e.g., Jane Smith"
                  value={attendeeName}
                  onChange={(e) => setAttendeeName(e.target.value)}
                  className="border-gray-300 bg-white/50 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800/50"
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  This will be displayed with your questions
                </p>
              </div>

              <div className="rounded-lg bg-purple-50/50 p-4 dark:bg-purple-900/20">
                <p className="text-sm text-purple-600 dark:text-purple-400">
                  <span className="font-semibold">Note:</span> The room code is
                  case-insensitive and usually 6 characters long.
                </p>
              </div>
            </CardContent>

            <CardFooter>
              <Button
                type="submit"
                className="w-full gap-2 bg-gradient-to-r from-purple-500 to-blue-500 text-lg font-medium hover:from-purple-600 hover:to-blue-600"
                disabled={!roomCode || !attendeeName || isJoining}
              >
                {isJoining ? (
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
                    Joining...
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5" />
                    Join Session
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}

export default function JoinSession() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg border border-gray-200/50 bg-white/80 p-8 shadow-lg backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-900/80"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-pulse rounded-full bg-purple-200 dark:bg-purple-800/50"></div>
              <div className="space-y-2 text-center">
                <h2 className="text-xl font-semibold">Loading Session</h2>
                <p className="text-gray-500 dark:text-gray-400">
                  Please wait while we prepare your experience
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      }
    >
      <JoinSessionContent />
    </Suspense>
  );
}
