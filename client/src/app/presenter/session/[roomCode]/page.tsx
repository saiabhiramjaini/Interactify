"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
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
  Copy,
  CheckCircle,
  MessageSquare,
  ThumbsUp,
  Users,
  Star,
  Circle,
} from "lucide-react";
import { toast } from "sonner";
import { useWebSocket } from "@/context/WebSocketContext";
import React from "react";

interface Question {
  _id: string;
  questionText: string;
  upVotes: number;
  downVotes: number;
  author: string;
  authorName?: string;
  createdAt: string;
  answered: boolean;
  highlighted: boolean;
}

type SessionDataPayload = {
  questions?: Question[];
  attendees?: { id: string; name: string }[];
  sessionName?: string;
  owner?: string;
};

export default function PresenterSession() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { sendMessage, lastMessage, isConnected, reconnect } = useWebSocket();
  const router = useRouter();

  const roomCode = params.roomCode as string;
  const sessionName = searchParams.get("name") || "Untitled Session";
  const presenterName = searchParams.get("presenter") || "Presenter";

  const [shareLink, setShareLink] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attendees, setAttendees] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [showEndSessionDialog, setShowEndSessionDialog] = useState(false);
  const [sessionClosed, setSessionClosed] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // Refs must be declared with other hooks
  const hasInitialized = useRef(false);
  const lastProcessedMessage = useRef<any>(null);
  const shownQuestionToasts = useRef<Set<string>>(new Set());

  // Memoize the message handler to prevent recreating it on each render
  const handleMessage = useCallback((message: any) => {
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
        const session = message.payload.session;
        setQuestions(session.questions || []);
        setAttendees((session.attendees || []).map((a: any) => a.name));
        break;

      case "attendeeJoined":
        setAttendees((prev) => {
          const attendee = message.payload.attendee;
          const attendeeName = attendee.name;
          const newAttendees = message.payload.attendees.map((a: any) => a.name);
          // Show toast only if attendeeName is in newAttendees but not in prev
          if (!prev.includes(attendeeName) && newAttendees.includes(attendeeName)) {
            toast(`${attendeeName} joined the session`);
          }
          return newAttendees;
        });
        break;

      case "attendeeLeft":
        setAttendees((prev) => {
          const attendee = message.payload.attendee;
          const attendeeName = attendee.name;
          const newAttendees = message.payload.attendees.map((a: any) => a.name);
          // Show toast only if attendeeName is in prev but not in newAttendees
          if (prev.includes(attendeeName) && !newAttendees.includes(attendeeName)) {
            toast(`${attendeeName} left the session`);
          }
          return newAttendees;
        });
        break;

      case "question":
      case "questionAdded":
        setQuestions((prev) => {
          const newQuestion = message.payload.question || message.payload;
          const uniqueKey = `${newQuestion.questionText}|${newQuestion.author || newQuestion.authorName || "Anonymous"}`;
          if (!shownQuestionToasts.current.has(uniqueKey)) {
            shownQuestionToasts.current.add(uniqueKey);
            const author = newQuestion.author || newQuestion.authorName || "Anonymous";
            toast(`New question from ${author}`);
          }
          const exists = prev.some(
            (q) =>
              q.questionText === newQuestion.questionText &&
              (q.author === newQuestion.author || q.authorName === newQuestion.authorName)
          );
          if (!exists) {
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
            if (q._id === message.payload.questionId) {
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
                    q[key as keyof Question] !== updates[key as keyof Question]
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
        break;

      case "error":
        toast.error(message.payload.message);
        break;

      case "questionUpdated":
        setQuestions((prev) =>
          prev.map((q) =>
            q.questionText === (message.payload.question.questionText)
              ? { ...q, ...message.payload.question }
              : q
          )
        );
        break;

      default:
        console.log("Unhandled message type:", message.type);
    }
  }, []); // Empty dependency array since we're using functional updates

  const copyRoomCode = useCallback(() => {
    navigator.clipboard.writeText(roomCode);
    toast("Room code copied!");
  }, [roomCode]);

  const toggleAnswered = useCallback(
    (questionId: string) => {
      setQuestions((prev) => {
        const question = prev.find((q) => q._id === questionId);
        if (!question) return prev;
        sendMessage({
          type: "markQuestion",
          payload: {
            roomId: roomCode,
            questionId: questionId,
            action: question.answered ? "unanswered" : "answered",
            userId: presenterName,
          },
        });
        return prev;
      });
    },
    [roomCode, presenterName, sendMessage]
  );

  const toggleHighlighted = useCallback(
    (questionId: string) => {
      setQuestions((prev) => {
        const question = prev.find((q) => q._id === questionId);
        if (!question) return prev;
        sendMessage({
          type: "markQuestion",
          payload: {
            roomId: roomCode,
            questionId: questionId,
            action: question.highlighted ? "unhighlighted" : "highlighted",
            userId: presenterName,
          },
        });
        return prev;
      });
    },
    [roomCode, presenterName, sendMessage]
  );

  const handleEndSession = useCallback(() => {
    sendMessage({
      type: "close",
      payload: {
        roomId: roomCode,
        ownerId: presenterName,
      },
    });
    toast.success("Session ended successfully");
    router.push("/");
  }, [roomCode, presenterName, sendMessage, router]);

  useEffect(() => {
    if (isConnected && initialized) {
      // When reconnected, request the latest session data
      sendMessage({
        type: "getSession",
        payload: { roomId: roomCode },
      });
    }
  }, [isConnected, initialized, roomCode, sendMessage]);

  // Modify your initialization effect
  useEffect(() => {
    if (roomCode && presenterName) {
      const link = `${window.location.origin}/attendee/join?code=${roomCode}`;
      setShareLink(link);
      sendMessage({
        type: "getSession",
        payload: { roomId: roomCode }
      });
    }
  }, [roomCode, presenterName, sendMessage]);

  // Initialize session only once
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;

      const link = `${window.location.origin}/attendee/join?code=${roomCode}`;
      setShareLink(link);

      // Join the session as presenter
      sendMessage({
        type: "join",
        payload: {
          roomId: roomCode,
          attendee: {
            id: presenterName,
            name: presenterName
          }
        },
      });

      // Get initial session data
      sendMessage({
        type: "getSession",
        payload: { roomId: roomCode },
      });
    }
  }, [roomCode, presenterName, sendMessage]);

  // Handle incoming messages
  useEffect(() => {
    if (lastMessage) {
      handleMessage(lastMessage);
    }
  }, [lastMessage, handleMessage]);

  // Calculate filtered questions
  const filteredQuestions = questions
    .filter((q) => {
      if (activeTab === "all") return true;
      if (activeTab === "answered") return q.answered;
      if (activeTab === "unanswered") return !q.answered;
      if (activeTab === "highlighted") return q.highlighted;
      return true;
    })
    .sort((a, b) => {
      // First sort by highlighted status (highlighted first)
      if (a.highlighted !== b.highlighted) {
        return a.highlighted ? -1 : 1;
      }

      // Then sort by vote score (upVotes - downVotes)
      const aScore = (a.upVotes || 0) - (a.downVotes || 0);
      const bScore = (b.upVotes || 0) - (b.downVotes || 0);

      // If scores are equal, newer questions come first
      if (bScore === aScore) {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }

      return bScore - aScore;
    });

  const totalVotes = questions.reduce(
    (acc, q) => acc + ((q.upVotes || 0) - (q.downVotes || 0)),
    0
  );

  // Always fetch session data on page load/refresh for presenter
  useEffect(() => {
    if (roomCode) {
      sendMessage({
        type: "getSession",
        payload: { roomId: roomCode }
      });
    }
  }, [roomCode, sendMessage]);

  // MOVE ALL CONDITIONAL RENDERING TO THE END, AFTER ALL HOOKS
  if (!isConnected) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/80 z-50">
        <div className="text-center p-6 bg-white rounded-lg shadow-lg dark:bg-gray-800">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium mb-2">Connecting to session...</h3>
          <Button variant="outline" className="mt-4" onClick={reconnect}>
            Reconnect Now
          </Button>
        </div>
      </div>
    );
  }

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
            <ThumbsUp className="h-3 w-3" />
            {totalVotes} Votes
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {attendees.length} Attendees
          </Badge>
          <div className="flex items-center gap-2 rounded-md border px-3 py-1">
            <span className="text-sm font-medium">Room: {roomCode}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={copyRoomCode}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>

          <Button
            variant="destructive"
            onClick={() => setShowEndSessionDialog(true)}
            className="ml-2"
          >
            End Session
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Session Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Room Code</h3>
              <div className="mt-1 flex items-center gap-2">
                <code className="rounded bg-gray-100 px-2 py-1 text-sm font-bold dark:bg-gray-800">
                  {roomCode}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={copyRoomCode}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500">Share Link</h3>
              <div className="mt-1 flex items-center gap-2">
                <Input value={shareLink} readOnly className="h-8 text-xs" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    navigator.clipboard.writeText(shareLink);
                    toast("Link copied!");
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500">
                Session Stats
              </h3>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-lg border p-2 text-center">
                  <div className="text-2xl font-bold">{attendees.length}</div>
                  <div className="text-xs text-gray-500">Attendees</div>
                </div>
                <div className="rounded-lg border p-2 text-center">
                  <div className="text-2xl font-bold">{questions.length}</div>
                  <div className="text-xs text-gray-500">Questions</div>
                </div>
                <div className="rounded-lg border p-2 text-center">
                  <div className="text-2xl font-bold">
                    {questions.filter((q) => q.answered).length}
                  </div>
                  <div className="text-xs text-gray-500">Answered</div>
                </div>
                <div className="rounded-lg border p-2 text-center">
                  <div className="text-2xl font-bold">{totalVotes}</div>
                  <div className="text-xs text-gray-500">Total Votes</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Tabs defaultValue="all" onValueChange={setActiveTab}>
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unanswered">Unanswered</TabsTrigger>
                <TabsTrigger value="answered">Answered</TabsTrigger>
                <TabsTrigger value="highlighted">Highlighted</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="all" className="mt-4">
              <QuestionsList
                questions={filteredQuestions}
                onToggleAnswered={toggleAnswered}
                onToggleHighlighted={toggleHighlighted}
              />
            </TabsContent>

            <TabsContent value="unanswered" className="mt-4">
              <QuestionsList
                questions={filteredQuestions}
                onToggleAnswered={toggleAnswered}
                onToggleHighlighted={toggleHighlighted}
              />
            </TabsContent>

            <TabsContent value="answered" className="mt-4">
              <QuestionsList
                questions={filteredQuestions}
                onToggleAnswered={toggleAnswered}
                onToggleHighlighted={toggleHighlighted}
              />
            </TabsContent>

            <TabsContent value="highlighted" className="mt-4">
              <QuestionsList
                questions={filteredQuestions}
                onToggleAnswered={toggleAnswered}
                onToggleHighlighted={toggleHighlighted}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <AlertDialog
        open={showEndSessionDialog}
        onOpenChange={setShowEndSessionDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently close the session for all attendees. You
              won't be able to reopen it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndSession}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              End Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Session?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave this session?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowLeaveDialog(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowLeaveDialog(false);
              // Send leave message and redirect
              sendMessage({
                type: "leave",
                payload: {
                  roomId: roomCode,
                  attendeeId: presenterName,
                },
              });
              router.push("/");
            }}>Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={sessionClosed}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Session Ended</AlertDialogTitle>
            <AlertDialogDescription>
              The presenter has ended this session. You will be redirected to the home page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => router.push("/")}>Go Home</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function QuestionsList({
  questions,
  onToggleAnswered,
  onToggleHighlighted,
}: {
  questions: Question[];
  onToggleAnswered: (questionId: string) => void;
  onToggleHighlighted: (questionId: string) => void;
}) {
  if (questions.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
        <div className="text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium">No questions yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Questions will appear here as they come in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {questions.map((question) => (
        <Card
          key={question._id}
          className={`transition-all ${
            question.highlighted ? "border-2 border-yellow-400" : ""
          } ${question.answered ? "bg-gray-50 dark:bg-gray-800/50" : ""}`}
        >
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <Badge
                  variant="outline"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                >
                  {(question.upVotes || 0) - (question.downVotes || 0)}
                </Badge>
                <span className="mt-1 text-xs text-gray-500">votes</span>
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <p
                    className={`text-lg ${
                      question.answered ? "text-gray-500" : ""
                    }`}
                  >
                    {question.questionText}
                  </p>
                  <div className="ml-4 flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${
                        question.highlighted ? "text-yellow-500" : ""
                      }`}
                      onClick={() => onToggleHighlighted(question._id)}
                      title={
                        question.highlighted
                          ? "Remove highlight"
                          : "Highlight question"
                      }
                    >
                      <Star
                        className="h-4 w-4"
                        fill={question.highlighted ? "currentColor" : "none"}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${
                        question.answered ? "text-green-500" : ""
                      }`}
                      onClick={() => onToggleAnswered(question._id)}
                      title={
                        question.answered
                          ? "Mark as unanswered"
                          : "Mark as answered"
                      }
                    >
                      {question.answered ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span>Asked by {question.author}</span>
                  <span>
                    {new Date(question.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
