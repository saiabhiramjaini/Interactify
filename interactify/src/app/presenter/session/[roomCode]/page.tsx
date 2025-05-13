"use client"

import { useState, useEffect } from "react"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Copy, CheckCircle, MessageSquare, ThumbsUp, Users, Star, Circle } from "lucide-react"
import { toast } from "sonner"
import { useWebSocket } from "@/context/WebSocketContext"

interface Question {
  id: string
  text: string
  votes: number
  answered: boolean
  highlighted: boolean
  timestamp: string
}

export default function PresenterSession() {
  const params = useParams()
  const searchParams = useSearchParams()
  const { sendMessage } = useWebSocket()

  const roomCode = params.roomCode as string
  const sessionName = searchParams.get("name") || "Untitled Session"
  const presenterName = searchParams.get("presenter") || "Presenter"

  const [shareLink, setShareLink] = useState("")
  const [questions, setQuestions] = useState<Question[]>([])
  const [activeTab, setActiveTab] = useState("all")
  const [attendeeCount, setAttendeeCount] = useState(0)

  useEffect(() => {
    setShareLink(`${window.location.origin}/attendee/join?code=${roomCode}`)
    
    const ws = new WebSocket('ws://localhost:8080')
    
    // Get session data
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "getSession",
        payload: { roomId: roomCode }
      }))
    }

    // Listen for updates
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === "sessionData") {
        setAttendeeCount(data.payload.attendees.length)
        
        const formattedQuestions = data.payload.questions.map((q: any) => ({
          id: `q${Date.now()}`,
          text: q.questionText,
          votes: q.upVotes - q.downVotes,
          answered: false,
          highlighted: false,
          timestamp: new Date(q.createdAt).toISOString()
        }))
        
        setQuestions(formattedQuestions)
      } else if (data.type === "questionAdded") {
        const newQuestion = {
          id: `q${Date.now()}`,
          text: data.payload.question.questionText,
          votes: 0,
          answered: false,
          highlighted: false,
          timestamp: new Date().toISOString()
        }
        setQuestions(prev => [...prev, newQuestion])
      } else if (data.type === "attendeeJoined") {
        setAttendeeCount(prev => prev + 1)
      } else if (data.type === "attendeeLeft") {
        setAttendeeCount(prev => prev - 1)
      }
    }

    return () => {
      ws.close()
    }
  }, [roomCode])

  const sortedQuestions = [...questions].sort((a, b) => b.votes - a.votes)
  const filteredQuestions = sortedQuestions.filter((q) => {
    if (activeTab === "all") return true
    if (activeTab === "answered") return q.answered
    if (activeTab === "unanswered") return !q.answered
    if (activeTab === "highlighted") return q.highlighted
    return true
  })

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode)
    toast("Room code copied!")
  }

  const toggleAnswered = (id: string, questionText: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === id) {
        const newAnsweredState = !q.answered
        sendMessage({
          type: "markQuestion",
          payload: {
            roomId: roomCode,
            questionText,
            action: newAnsweredState ? "answered" : "unanswered"
          }
        })
        return { ...q, answered: newAnsweredState }
      }
      return q
    }))
  }

  const toggleHighlighted = (id: string, questionText: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === id) {
        const newHighlightedState = !q.highlighted
        sendMessage({
          type: "markQuestion",
          payload: {
            roomId: roomCode,
            questionText,
            action: newHighlightedState ? "highlighted" : "unhighlighted"
          }
        })
        return { ...q, highlighted: newHighlightedState }
      }
      return q
    }))
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
            {questions.reduce((acc, q) => acc + q.votes, 0)} Votes
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {attendeeCount} Attendees
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
                    navigator.clipboard.writeText(shareLink)
                    toast("Link copied!")
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
                  <div className="text-2xl font-bold">{attendeeCount}</div>
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
                  <div className="text-2xl font-bold">
                    {questions.reduce((acc, q) => acc + q.votes, 0)}
                  </div>
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
                toggleAnswered={toggleAnswered}
                toggleHighlighted={toggleHighlighted}
              />
            </TabsContent>

            <TabsContent value="unanswered" className="mt-4">
              <QuestionsList
                questions={filteredQuestions}
                toggleAnswered={toggleAnswered}
                toggleHighlighted={toggleHighlighted}
              />
            </TabsContent>

            <TabsContent value="answered" className="mt-4">
              <QuestionsList
                questions={filteredQuestions}
                toggleAnswered={toggleAnswered}
                toggleHighlighted={toggleHighlighted}
              />
            </TabsContent>

            <TabsContent value="highlighted" className="mt-4">
              <QuestionsList
                questions={filteredQuestions}
                toggleAnswered={toggleAnswered}
                toggleHighlighted={toggleHighlighted}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

function QuestionsList({
  questions,
  toggleAnswered,
  toggleHighlighted,
}: {
  questions: Question[]
  toggleAnswered: (id: string, questionText: string) => void
  toggleHighlighted: (id: string, questionText: string) => void
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
    )
  }

  return (
    <div className="space-y-4">
      {questions.map((question) => (
        <Card
          key={question.id}
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
                  {question.votes}
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
                    {question.text}
                  </p>
                  <div className="ml-4 flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${
                        question.highlighted ? "text-yellow-500" : ""
                      }`}
                      onClick={() => toggleHighlighted(question.id, question.text)}
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
                      onClick={() => toggleAnswered(question.id, question.text)}
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
                <div className="mt-2 flex items-center text-xs text-gray-500">
                  <span>
                    {new Date(question.timestamp).toLocaleTimeString([], {
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
  )
}