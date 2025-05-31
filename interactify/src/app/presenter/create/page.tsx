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
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useWebSocket } from "@/context/WebSocketContext";

export default function CreateSession() {
  const router = useRouter();
  const [sessionName, setSessionName] = useState("");
  const [presenterName, setPresenterName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { sendMessage, lastMessage } = useWebSocket();

  useEffect(() => {
    if (lastMessage?.type === "sessionCreated") {
      const { roomId, sessionName, owner } = lastMessage.payload;
      toast.success("Session created successfully!");
      // Redirect to the session page or do something with the roomId
      router.push(
            `/presenter/session/${roomId}?name=${encodeURIComponent(sessionName)}&presenter=${encodeURIComponent(presenterName)}`
          )
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
    <div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center">
            <Link href="/" className="mr-4">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <CardTitle>Create a New Session</CardTitle>
              <CardDescription>
                Set up a Q&A session for your presentation
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <form onSubmit={handleCreateSession}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="session-name">Session Name</Label>
              <Input
                id="session-name"
                placeholder="e.g., Product Launch Q&A"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="presenter-name">Your Name</Label>
              <Input
                id="presenter-name"
                placeholder="e.g., John Smith"
                value={presenterName}
                onChange={(e) => setPresenterName(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="mt-5">
            <Button
              type="submit"
              className="w-full"
              disabled={!sessionName || !presenterName || isCreating}
            >
              {isCreating ? "Creating..." : "Create Session"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}