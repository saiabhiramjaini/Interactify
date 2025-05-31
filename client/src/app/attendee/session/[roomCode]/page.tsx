"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  MessageSquare,
  ThumbsUp,
  Send,
  Users,
  CheckCircle,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { useWebSocket } from "@/context/WebSocketContext";

interface Question {
  questionText: string;
  upVotes: number;
  downVotes: number;
  author: string;
  createdAt: string;
  answered: boolean;
  highlighted: boolean;
}

export default function AttendeeSession() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { sendMessage, lastMessage } = useWebSocket();
  const router = useRouter();

  const roomCode = params.roomCode as string;
  const attendeeName = searchParams.get("name") || "Anonymous";

  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [sessionName, setSessionName] = useState("Loading session...");
  const [presenterName, setPresenterName] = useState("Presenter");
  const [votedQuestions, setVotedQuestions] = useState<Set<string>>(new Set());
  const [sessionClosed, setSessionClosed] = useState(false);

  // Use refs to track if we've already initialized
  const hasInitialized = useRef(false);
  const lastProcessedMessage = useRef<any>(null);

  // Memoize the message handler to prevent recreating it on each render
  const handleMessage = useCallback(
    (message: any) => {
      // Prevent processing the same message twice
      if (!message || message === lastProcessedMessage.current) {
        return;
      }
      lastProcessedMessage.current = message;

      switch (message.type) {
        case "sessionJoined":
          toast.success("Successfully joined the session!");
          break;

        case "sessionData":
          // Use functional updates to avoid stale closures
          setSessionName(message.payload.sessionName || "Session");
          setPresenterName(message.payload.owner || "Presenter");
          setAttendeeCount(message.payload.attendees?.length || 0);

          setQuestions((prev) => {
            const newQuestions = message.payload.questions || [];
            // Only update if the data actually changed
            if (JSON.stringify(prev) !== JSON.stringify(newQuestions)) {
              return newQuestions;
            }
            return prev;
          });
          break;

        case "attendeeJoined":
          setAttendeeCount((prev) => {
            const newCount = message.payload.attendees?.length || prev + 1;
            if (message.payload.attendee !== attendeeName) {
              toast(`${message.payload.attendee} joined the session`);
            }
            return newCount;
          });
          break;

        case "attendeeLeft":
          setAttendeeCount((prev) => {
            const newCount =
              message.payload.attendees?.length || Math.max(0, prev - 1);
            if (message.payload.attendee !== attendeeName) {
              toast(`${message.payload.attendee} left the session`);
            }
            return newCount;
          });
          break;

        case "question":
          setQuestions((prev) => {
            const newQuestion = message.payload;
            // Check if question already exists
            const exists = prev.some(
              (q) =>
                q.questionText === newQuestion.questionText &&
                q.author === newQuestion.author
            );

            if (!exists) {
              if (newQuestion.author !== attendeeName) {
                toast(`New question from ${newQuestion.author}`);
              }
              return [...prev, newQuestion];
            }
            return prev;
          });
          break;

        case "vote":
          setQuestions((prev) =>
            prev.map((q) => {
              if (q.questionText === message.payload.questionText) {
                // Only update if votes actually changed
                if (
                  q.upVotes !== message.payload.upVotes ||
                  q.downVotes !== message.payload.downVotes
                ) {
                  return {
                    ...q,
                    upVotes: message.payload.upVotes,
                    downVotes: message.payload.downVotes,
                  };
                }
              }
              return q;
            })
          );
          break;

        case "markQuestion":
          setQuestions((prev) =>
            prev.map((q) => {
              if (q.questionText === message.payload.questionText) {
                const updates: Partial<Question> = {};

                if (message.payload.answered !== undefined) {
                  updates.answered = message.payload.answered;
                }
                if (message.payload.highlighted !== undefined) {
                  updates.highlighted = message.payload.highlighted;
                }

                // Only update if something actually changed
                if (
                  Object.keys(updates).some(
                    (key) =>
                      q[key as keyof Question] !==
                      updates[key as keyof Question]
                  )
                ) {
                  return { ...q, ...updates };
                }
              }
              return q;
            })
          );
          break;

        case "sessionClosed":
          setSessionClosed(true);
          toast.error("The session has been ended by the presenter");
          setTimeout(() => router.push("/"), 3000);
          break;

        case "error":
          toast.error(message.payload.message);
          break;

        default:
          console.log("Unhandled message type:", message.type);
      }
    },
    [attendeeName]
  ); // Include attendeeName in dependencies

  // Initialize session only once
  useEffect(() => {
    if (!hasInitialized.current && roomCode && attendeeName) {
      hasInitialized.current = true;

      // Join the session as attendee
      sendMessage({
        type: "join",
        payload: {
          roomId: roomCode,
          attendee: attendeeName,
        },
      });

      // Get initial session data
      sendMessage({
        type: "getSession",
        payload: { roomId: roomCode },
      });
    }
  }, [roomCode, attendeeName, sendMessage]);

  // Handle incoming messages
  useEffect(() => {
    if (lastMessage) {
      handleMessage(lastMessage);
    }
  }, [lastMessage, handleMessage]);

  const sortedQuestions = [...questions].sort((a, b) => {
    if (a.answered !== b.answered) return a.answered ? 1 : -1;
    if (a.highlighted !== b.highlighted) return a.highlighted ? -1 : 1;
    return b.upVotes - b.downVotes - (a.upVotes - a.downVotes);
  });

  const handleSubmitQuestion = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newQuestion.trim()) return;

      sendMessage({
        type: "question",
        payload: {
          roomId: roomCode,
          questionText: newQuestion.trim(),
          author: attendeeName,
        },
      });

      setNewQuestion("");
      toast("Question submitted!");
    },
    [newQuestion, roomCode, attendeeName, sendMessage]
  );

  const handleVote = useCallback(
    (questionText: string) => {
      const isAlreadyVoted = votedQuestions.has(questionText);

      if (isAlreadyVoted) {
        toast("You have already voted on this question");
        return;
      }

      sendMessage({
        type: "vote",
        payload: {
          roomId: roomCode,
          questionText,
          voteType: "upVote",
        },
      });

      setVotedQuestions((prev) => new Set([...prev, questionText]));
      toast("Vote recorded!");
    },
    [roomCode, sendMessage, votedQuestions]
  );

  const handleLeaveSession = useCallback(() => {
    sendMessage({
      type: "leave",
      payload: {
        roomId: roomCode,
        attendee: attendeeName,
      },
    });
    router.push("/");
  }, [roomCode, attendeeName, sendMessage, router]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{sessionName}</h1>
            <p className="text-sm text-gray-500">Hosted by {presenterName}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {questions.length} Questions
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {attendeeCount} Attendees
          </Badge>
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            Room: {roomCode}
          </Badge>

          <Button variant="outline" onClick={handleLeaveSession}>
            Leave Session
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ask a Question</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmitQuestion}
              className="flex flex-col gap-4"
            >
              <Textarea
                placeholder="Type your question here..."
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                className="min-h-[100px]"
              />
              <div className="flex justify-between">
                <p className="text-xs text-gray-500">
                  Posting as <span className="font-medium">{attendeeName}</span>
                </p>
                <Button type="submit" disabled={!newQuestion.trim()}>
                  <Send className="mr-2 h-4 w-4" />
                  Submit Question
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-bold">Questions</h2>

          {sortedQuestions.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
              <div className="text-center">
                <MessageSquare className="mx-auto h-8 w-8 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium">No questions yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Be the first to ask a question!
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedQuestions.map((question, index) => (
                <Card
                  key={`${question.questionText}-${question.author}-${index}`}
                  className={`transition-all ${
                    question.highlighted
                      ? "border-2 border-yellow-400 shadow-lg"
                      : ""
                  } ${
                    question.answered ? "bg-gray-50 dark:bg-gray-800/50" : ""
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <Button
                          variant={
                            votedQuestions.has(question.questionText)
                              ? "default"
                              : "outline"
                          }
                          size="icon"
                          className={`h-10 w-10 rounded-full ${
                            votedQuestions.has(question.questionText)
                              ? "bg-blue-500 text-white hover:bg-blue-600"
                              : ""
                          }`}
                          onClick={() => handleVote(question.questionText)}
                          disabled={
                            question.answered ||
                            votedQuestions.has(question.questionText)
                          }
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </Button>
                        <span className="mt-1 text-sm font-medium">
                          {question.upVotes - question.downVotes}
                        </span>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {question.highlighted && (
                                <Star className="h-4 w-4 text-yellow-500 fill-current" />
                              )}
                              <p
                                className={`text-lg ${
                                  question.answered
                                    ? "text-gray-500 line-through"
                                    : ""
                                }`}
                              >
                                {question.questionText}
                              </p>
                            </div>
                            <div className="mt-1 flex items-center text-xs text-gray-500">
                              <span className="font-medium">
                                {question.author}
                              </span>
                              <span className="mx-1">•</span>
                              <span>
                                {new Date(
                                  question.createdAt
                                ).toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {question.answered && (
                          <div className="mt-3 rounded-md bg-green-50 p-2 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-200">
                            <div className="flex items-center gap-1">
                              <CheckCircle className="h-4 w-4" />
                              <span>This question has been answered</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={sessionClosed}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Session Ended</AlertDialogTitle>
            <AlertDialogDescription>
              The presenter has ended this session. You will be redirected to
              the home page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => router.push("/")}>
              Go Home
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
