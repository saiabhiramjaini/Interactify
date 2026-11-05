"use client";

import { useState, useEffect, useCallback } from "react";
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
import { useWebSocket, useWebSocketMessages } from "@/context/WebSocketContext";
import { motion, AnimatePresence } from "framer-motion";
import React from "react";

interface Question {
  _id: string;
  questionText: string;
  upVotes: number;
  authorId: string;
  authorName: string;
  createdAt: string;
  answered: boolean;
  highlighted: boolean;
  upVotedBy: string[];
}

type SessionPayload = {
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
  const { sendMessage, setJoinMessage, isConnected, reconnect } = useWebSocket();
  const router = useRouter();

  const roomCode = (params.roomCode as string).toUpperCase();
  const attendeeId = searchParams.get("id");
  const attendeeName = searchParams.get("name") || "Anonymous";

  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [sessionName, setSessionName] = useState("Loading session...");
  const [presenterName, setPresenterName] = useState("Presenter");
  const [sessionClosed, setSessionClosed] = useState(false);

  const applySession = useCallback((session: SessionPayload) => {
    setSessionName(session.sessionName || "Session");
    setPresenterName(session.owner || "Presenter");
    setAttendeeCount(session.attendees?.length || 0);
    setQuestions(session.questions || []);
  }, []);

  const endSession = useCallback(() => {
    setJoinMessage(null);
    setSessionClosed(true);
    setTimeout(() => router.push("/"), 3000);
  }, [router, setJoinMessage]);

  useWebSocketMessages((message) => {
    switch (message.type) {
      case "sessionJoined":
      case "sessionData":
        applySession(message.payload.session);
        break;

      case "attendeeJoined":
      case "attendeeLeft": {
        const { attendee, attendees } = message.payload;
        setAttendeeCount(attendees.length);
        if (attendee.id !== attendeeId) {
          toast(
            `${attendee.name} ${
              message.type === "attendeeJoined" ? "joined" : "left"
            } the session`
          );
        }
        break;
      }

      case "questionAdded": {
        const question: Question = message.payload.question;
        setQuestions((prev) =>
          prev.some((q) => q._id === question._id) ? prev : [...prev, question]
        );
        if (question.authorId === attendeeId) {
          // Keep whatever the user typed since submitting
          setNewQuestion((prev) =>
            prev.trim() === question.questionText ? "" : prev
          );
          toast.success("Question submitted!");
        } else {
          toast(`New question from ${question.authorName}`);
        }
        break;
      }

      case "questionUpdated": {
        const question: Question = message.payload.question;
        setQuestions((prev) =>
          prev.map((q) => (q._id === question._id ? question : q))
        );
        break;
      }

      case "sessionClosed":
        toast.error("The session has been ended by the presenter");
        endSession();
        break;

      case "error":
        if (message.payload.code === "SESSION_CLOSED") {
          endSession();
        } else if (message.payload.code === "NOT_FOUND") {
          toast.error("Session not found");
          setJoinMessage(null);
          router.push("/");
        } else {
          toast.error(message.payload.message);
        }
        break;
    }
  });

  // Join once; the provider re-sends the join after every reconnect
  useEffect(() => {
    if (!attendeeId) {
      toast.error("Invalid session link");
      router.push("/");
      return;
    }

    setJoinMessage({
      type: "join",
      payload: {
        roomId: roomCode,
        attendee: { id: attendeeId, name: attendeeName },
      },
    });

    return () => setJoinMessage(null);
  }, [roomCode, attendeeId, attendeeName, setJoinMessage, router]);

  const sortedQuestions = [...questions].sort((a, b) => {
    if (a.answered !== b.answered) return a.answered ? 1 : -1;
    if (a.highlighted !== b.highlighted) return a.highlighted ? -1 : 1;
    if (b.upVotes !== a.upVotes) return (b.upVotes || 0) - (a.upVotes || 0);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const handleSubmitQuestion = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newQuestion.trim()) return;

      // The input is cleared once the server confirms the question
      sendMessage({
        type: "question",
        payload: {
          roomId: roomCode,
          questionText: newQuestion.trim(),
        },
      });
    },
    [newQuestion, roomCode, sendMessage]
  );

  const handleVote = useCallback(
    (questionId: string) => {
      sendMessage({
        type: "vote",
        payload: { roomId: roomCode, questionId },
      });
    },
    [roomCode, sendMessage]
  );

  const handleLeaveSession = useCallback(() => {
    setJoinMessage(null);
    sendMessage({
      type: "leave",
      payload: { roomId: roomCode },
    });
    router.push("/");
  }, [roomCode, sendMessage, setJoinMessage, router]);

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
                                  {question.upVotes || 0}
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
