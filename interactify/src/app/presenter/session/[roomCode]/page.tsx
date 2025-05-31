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

interface Question {
  questionText: string;
  upVotes: number;
  downVotes: number;
  author: string;
  createdAt: string;
  answered: boolean;
  highlighted: boolean;
}

export default function PresenterSession() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { sendMessage, lastMessage } = useWebSocket();

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

  // Use refs to track if we've already initialized
  const hasInitialized = useRef(false);
  const lastProcessedMessage = useRef<any>(null);

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
        // Use functional updates to avoid stale closures
        setQuestions((prev) => {
          const newQuestions = message.payload.questions || [];
          // Only update if the data actually changed
          if (JSON.stringify(prev) !== JSON.stringify(newQuestions)) {
            return newQuestions;
          }
          return prev;
        });

        setAttendees((prev) => {
          const newAttendees = message.payload.attendees || [];
          if (JSON.stringify(prev) !== JSON.stringify(newAttendees)) {
            return newAttendees;
          }
          return prev;
        });
        break;

      case "attendeeJoined":
        setAttendees((prev) => {
          const attendee = message.payload.attendee;
          if (!prev.includes(attendee)) {
            toast(`${attendee} joined the session`);
            return [...prev, attendee];
          }
          return prev;
        });
        break;

      case "attendeeLeft":
        setAttendees((prev) => {
          const attendee = message.payload.attendee;
          const newAttendees = prev.filter((a) => a !== attendee);
          if (newAttendees.length !== prev.length) {
            toast(`${attendee} left the session`);
            return newAttendees;
          }
          return prev;
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
            toast(`New question from ${newQuestion.author}`);
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
        setTimeout(() => router.push("/"), 3000);
        break;

      case "error":
        toast.error(message.payload.message);
        break;

      default:
        console.log("Unhandled message type:", message.type);
    }
  }, []); // Empty dependency array since we're using functional updates

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
          attendee: presenterName,
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

  const copyRoomCode = useCallback(() => {
    navigator.clipboard.writeText(roomCode);
    toast("Room code copied!");
  }, [roomCode]);

  const toggleAnswered = useCallback(
    (questionText: string) => {
      setQuestions((prev) => {
        const question = prev.find((q) => q.questionText === questionText);
        if (!question) return prev;

        sendMessage({
          type: "markQuestion",
          payload: {
            roomId: roomCode,
            questionText,
            action: question.answered ? "unanswered" : "answered",
          },
        });

        return prev;
      });
    },
    [roomCode, sendMessage]
  );

  const toggleHighlighted = useCallback(
    (questionText: string) => {
      setQuestions((prev) => {
        const question = prev.find((q) => q.questionText === questionText);
        if (!question) return prev;

        sendMessage({
          type: "markQuestion",
          payload: {
            roomId: roomCode,
            questionText,
            action: question.highlighted ? "unhighlighted" : "highlighted",
          },
        });

        return prev;
      });
    },
    [roomCode, sendMessage]
  );

  // Update the filteredQuestions calculation in PresenterSession component
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
      const aScore = a.upVotes - a.downVotes;
      const bScore = b.upVotes - b.downVotes;

      // If scores are equal, newer questions come first
      if (bScore === aScore) {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }

      return bScore - aScore;
    });

  const totalVotes = questions.reduce(
    (acc, q) => acc + q.upVotes - q.downVotes,
    0
  );

  const handleEndSession = useCallback(() => {
    sendMessage({
      type: "close",
      payload: {
        roomId: roomCode,
        owner: presenterName,
      },
    });
    toast.success("Session ended successfully");
    router.push("/");
  }, [roomCode, presenterName, sendMessage, router]);

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
    </div>
  );
}

function QuestionsList({
  questions,
  onToggleAnswered,
  onToggleHighlighted,
}: {
  questions: Question[];
  onToggleAnswered: (questionText: string) => void;
  onToggleHighlighted: (questionText: string) => void;
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
          key={`${question.questionText}-${question.author}`}
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
                  {question.upVotes - question.downVotes}
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
                      onClick={() => onToggleHighlighted(question.questionText)}
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
                      onClick={() => onToggleAnswered(question.questionText)}
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
