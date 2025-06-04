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
  Clock,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useWebSocket } from "@/context/WebSocketContext";
import { motion, AnimatePresence } from "framer-motion";
import React from "react";

interface Question {
  _id: string;
  questionText: string;
  upVotes: number;
  downVotes: number;
  authorId: string;
  authorName: string;
  createdAt: string;
  answered: boolean;
  highlighted: boolean;
  upVotedBy: string[];
}

type SessionDataPayload = {
  questions?: Question[];
  attendees?: { id: string; name: string }[];
  sessionName?: string;
  owner?: string;
};

const MotionCard = motion(Card);
const MotionButton = motion(Button);

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

const questionVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: {
      duration: 0.2,
    },
  },
};

const statVariants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
};

const popUpVariants = {
  initial: { scale: 1 },
  pop: { 
    scale: [1, 1.2, 1],
    transition: {
      duration: 0.3,
      ease: "easeOut"
    }
  }
};

export default function AttendeeSession() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { sendMessage, lastMessage, isConnected, reconnect} = useWebSocket();
  const router = useRouter();

  const roomCode = params.roomCode as string;
  const attendeeId = searchParams.get("id");
  const attendeeName = searchParams.get("name") || "Anonymous";

  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [sessionName, setSessionName] = useState("Loading session...");
  const [presenterName, setPresenterName] = useState("Presenter");
  const [votedQuestions, setVotedQuestions] = useState<Set<string>>(new Set());
  const [sessionClosed, setSessionClosed] = useState(false);
const [initialized, setInitialized] = useState(false);

  // Use refs to track if we've already initialized
  const hasInitialized = useRef(false);
  const lastProcessedMessage = useRef<any>(null);
  const hasJoined = useRef(false);


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
          if (!hasJoined.current) {
            toast.success("Successfully joined the session!");
            hasJoined.current = true;
          }
          break;

        case "sessionData":
          const session = message.payload.session;
          setSessionName(session.sessionName || "Session");
          setPresenterName(session.owner || "Presenter");
          setAttendeeCount(session.attendees?.length || 0);
          setQuestions(session.questions || []);
          break;

        case "attendeeJoined":
          setAttendeeCount((prev) => {
            const attendee = message.payload.attendee;
            const attendeeName = attendee.name || attendee.id || attendee;
            const newCount = message.payload.attendees?.length || prev + 1;
            if (attendeeName !== attendeeName) {
              toast(`${attendeeName} joined the session`);
            }
            return newCount;
          });
          break;

        case "attendeeLeft":
          setAttendeeCount((prev) => {
            const attendee = message.payload.attendee;
            const attendeeName = attendee.name || attendee.id || attendee;
            const newCount =
              message.payload.attendees?.length || Math.max(0, prev - 1);
            if (attendeeName !== attendeeName) {
              toast(`${attendeeName} left the session`);
            }
            return newCount;
          });
          break;

        case "question":
        case "questionAdded":
          setQuestions((prev) => {
            const newQuestion = message.payload.question || message.payload;
            // Check if question already exists
            const exists = prev.some(
              (q) =>
                q.questionText === newQuestion.questionText &&
                q.authorId === newQuestion.authorId
            );

            if (!exists) {
              if (newQuestion.authorId !== attendeeId) {
                toast(`New question from ${newQuestion.authorName}`);
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
    },
    [attendeeName]
  ); // Include attendeeName in dependencies


    useEffect(() => {
    if (isConnected && initialized) {
      // When reconnected, request the latest session data
      sendMessage({
        type: "getSession",
        payload: { roomId: roomCode },
      });
    }
  }, [isConnected, initialized, roomCode, sendMessage]);
  // Initialize session only once
  useEffect(() => {
    if (!hasInitialized.current && roomCode && attendeeName) {
      hasInitialized.current = true;

      const attendeeId = searchParams.get("id");
      if (!attendeeId) {
        toast.error("Invalid session ID");
        router.push("/");
        return;
      }

      // Join the session as attendee
      sendMessage({
        type: "join",
        payload: {
          roomId: roomCode,
          attendee: {
            id: attendeeId,
            name: attendeeName
          }
        }
      });

      // Get initial session data
      sendMessage({
        type: "getSession",
        payload: { roomId: roomCode }
      });
    }
  }, [roomCode, attendeeName, sendMessage, searchParams, router]);

  // Handle incoming messages
  useEffect(() => {
    if (lastMessage) {
      handleMessage(lastMessage);
    }
  }, [lastMessage, handleMessage]);

  const sortedQuestions = [...questions].sort((a, b) => {
    if (a.answered !== b.answered) return a.answered ? 1 : -1;
    if (a.highlighted !== b.highlighted) return a.highlighted ? -1 : 1;
    return ((b.upVotes || 0) - (b.downVotes || 0)) - ((a.upVotes || 0) - (a.downVotes || 0));
  });

  const handleSubmitQuestion = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newQuestion.trim() || !attendeeId) return;

      sendMessage({
        type: "question",
        payload: {
          roomId: roomCode,
          questionText: newQuestion.trim(),
          authorId: attendeeId,
          authorName: attendeeName,
        },
      });

      setNewQuestion("");
      toast("Question submitted!");
    },
    [newQuestion, roomCode, attendeeId, attendeeName, sendMessage]
  );

  const handleVote = useCallback(
    (questionId: string) => {
      const attendeeId = searchParams.get("id");

      if (!attendeeId) {
        toast.error("Invalid session ID");
        router.push("/");
        return;
      }

      sendMessage({
        type: "vote",
        payload: {
          roomId: roomCode,
          questionId: questionId,
          voterId: attendeeId,
        },
      });
    },
    [roomCode, sendMessage, searchParams, router]
  );

  const handleLeaveSession = useCallback(() => {
    const attendeeId = searchParams.get("id");
    if (!attendeeId) {
      toast.error("Invalid session ID");
      router.push("/");
      return;
    }

    sendMessage({
      type: "leave",
      payload: {
        roomId: roomCode,
        attendeeId: attendeeId,
      },
    });
    router.push("/");
  }, [roomCode, sendMessage, router, searchParams]);

  useEffect(() => {
    if (lastMessage?.type === "sessionJoined") {
      sendMessage({
        type: "getSession",
        payload: { roomId: roomCode },
      });
    }
  }, [lastMessage, roomCode, sendMessage]);

  if (!isConnected) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 flex items-center justify-center bg-background/80 z-50"
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center p-8 bg-white rounded-xl shadow-lg dark:bg-gray-800"
        >
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"
          />
          <h3 className="text-lg font-medium mb-2">Connecting to session...</h3>
          <MotionButton 
            variant="outline" 
            className="mt-4"
            onClick={reconnect}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Reconnect Now
          </MotionButton>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50"
    >
      <div className="container mx-auto px-4 py-8">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* Header Section */}
          <motion.div 
            variants={cardVariants}
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <Link href="/">
                <MotionButton 
                  variant="ghost" 
                  size="icon"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <ArrowLeft className="h-4 w-4" />
                </MotionButton>
              </Link>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {sessionName}
                </h1>
                <p className="text-sm text-gray-500">Hosted by {presenterName}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <motion.div 
                variants={statVariants}
                className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5"
              >
                <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium">{questions.length}</span>
              </motion.div>
              <motion.div 
                variants={statVariants}
                className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 px-3 py-1.5"
              >
                <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium">{attendeeCount}</span>
              </motion.div>
              <motion.div 
                variants={statVariants}
                className="flex items-center gap-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5"
              >
                <span className="text-sm font-medium">Room: {roomCode}</span>
              </motion.div>

              <MotionButton
                variant="outline"
                onClick={handleLeaveSession}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Leave Session
              </MotionButton>
            </div>
          </motion.div>

          <div className="grid gap-6">
            {/* Ask Question Card */}
            <motion.div variants={cardVariants}>
              <Card className="bg-white dark:bg-gray-800 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Ask a Question</CardTitle>
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
                      className="min-h-[100px] resize-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-gray-500">
                        Posting as <span className="font-medium text-blue-600 dark:text-blue-400">{attendeeName}</span>
                      </p>
                      <MotionButton 
                        type="submit" 
                        disabled={!newQuestion.trim()}
                        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Submit Question
                      </MotionButton>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>

            {/* Questions List */}
            <motion.div variants={cardVariants} className="space-y-4">
              <h2 className="text-xl font-bold">Questions</h2>

              {sortedQuestions.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex h-40 items-center justify-center rounded-xl border border-dashed"
                >
                  <div className="text-center">
                    <MessageSquare className="mx-auto h-8 w-8 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium">No questions yet</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Be the first to ask a question!
                    </p>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence>
                    {sortedQuestions.map((question) => (
                      <motion.div
                        key={question._id}
                        variants={questionVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        layout
                      >
                        <Card
                          className={`group transition-all ${
                            question.highlighted
                              ? "border-2 border-yellow-400 shadow-lg"
                              : ""
                          } ${
                            question.answered ? "bg-gray-50 dark:bg-gray-800/50" : ""
                          }`}
                        >
                          <CardContent className="p-6">
                            <div className="flex gap-6">
                              <motion.div 
                                className="flex flex-col items-center"
                                whileHover={{ scale: 1.05 }}
                              >
                                <MotionButton
                                  variant={question.upVotedBy.includes(attendeeId || '') ? "default" : "outline"}
                                  size="icon"
                                  className={`h-12 w-12 rounded-full ${
                                    question.upVotedBy.includes(attendeeId || '') 
                                      ? "bg-blue-500 text-white hover:bg-blue-600" 
                                      : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                                  }`}
                                  onClick={() => {
                                    handleVote(question._id);
                                    // Trigger pop animation
                                    const button = document.getElementById(`vote-${question._id}`);
                                    if (button) {
                                      button.style.animation = 'none';
                                      button.offsetHeight; // Trigger reflow
                                      button.style.animation = '';
                                    }
                                  }}
                                  disabled={question.answered}
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  id={`vote-${question._id}`}
                                  animate={question.upVotedBy.includes(attendeeId || '') ? "pop" : "initial"}
                                  variants={popUpVariants}
                                >
                                  <ThumbsUp className="h-5 w-5" />
                                </MotionButton>
                                <span className="mt-2 text-sm font-medium">
                                  {(question.upVotes || 0) - (question.downVotes || 0)}
                                </span>
                              </motion.div>

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
                                    <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                                      <div className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        <span>{question.authorName}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        <span>
                                          {new Date(question.createdAt).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {question.answered && (
                                  <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-4 rounded-lg bg-green-50 dark:bg-green-900/30 p-3 text-sm text-green-800 dark:text-green-200"
                                  >
                                    <div className="flex items-center gap-2">
                                      <CheckCircle className="h-4 w-4" />
                                      <span>This question has been answered</span>
                                    </div>
                                  </motion.div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </div>
        </motion.div>
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
    </motion.div>
  );
}
