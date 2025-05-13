"use client"

import { useState, useEffect } from "react"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, MessageSquare, ThumbsUp, Send, Users, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import { useWebSocket } from "@/context/WebSocketContext"

interface Question {
  id: string
  text: string
  author: string
  votes: number
  answered: boolean
  highlighted: boolean
  timestamp: string
  voted: boolean
}

export default function AttendeeSession() {
  const params = useParams()
  const searchParams = useSearchParams()
  const { sendMessage } = useWebSocket()

  const roomCode = params.roomCode as string
  const attendeeName = searchParams.get("name") || "Anonymous"

  const [questions, setQuestions] = useState<Question[]>([])
  const [newQuestion, setNewQuestion] = useState("")
  const [attendeeCount, setAttendeeCount] = useState(0)
  const [sessionName, setSessionName] = useState("Loading session...")
  const [presenterName, setPresenterName] = useState("Presenter")

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080')
    
    // Join the session
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "join",
        payload: {
          roomId: roomCode,
          attendee: attendeeName
        }
      }))
    }

    // Listen for updates
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === "sessionData") {
        setSessionName(data.payload.sessionName)
        setPresenterName(data.payload.owner)
        setAttendeeCount(data.payload.attendees.length)
        
        const formattedQuestions = data.payload.questions.map((q: any) => ({
          id: `q${Date.now()}`,
          text: q.questionText,
          author: q.author,
          votes: q.upVotes - q.downVotes,
          answered: false,
          highlighted: false,
          timestamp: new Date(q.createdAt).toISOString(),
          voted: false
        }))
        
        setQuestions(formattedQuestions)
      } else if (data.type === "questionAdded") {
        const newQuestion = {
          id: `q${Date.now()}`,
          text: data.payload.question.questionText,
          author: data.payload.question.author,
          votes: 0,
          answered: false,
          highlighted: false,
          timestamp: new Date().toISOString(),
          voted: false
        }
        setQuestions(prev => [...prev, newQuestion])
      } else if (data.type === "voteUpdated") {
        setQuestions(prev => prev.map(q => 
          q.text === data.payload.question.questionText ? {
            ...q,
            votes: data.payload.question.upVotes - data.payload.question.downVotes
          } : q
        ))
      }
    }

    return () => {
      ws.close()
    }
  }, [roomCode, attendeeName])

  const sortedQuestions = [...questions].sort((a, b) => {
    if (a.answered !== b.answered) return a.answered ? 1 : -1
    if (a.highlighted !== b.highlighted) return a.highlighted ? -1 : 1
    return b.votes - a.votes
  })

  const handleSubmitQuestion = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newQuestion.trim()) return

    sendMessage({
      type: "question",
      payload: {
        roomId: roomCode,
        questionText: newQuestion,
        author: attendeeName
      }
    })

    setNewQuestion("")
    toast("Question submitted!")
  }

  const handleVote = (questionId: string, questionText: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === questionId) {
        const newVotedState = !q.voted
        const voteType = newVotedState ? "upVote" : "downVote"
        
        sendMessage({
          type: "vote",
          payload: {
            roomId: roomCode,
            questionText,
            voteType
          }
        })

        return {
          ...q,
          voted: newVotedState,
          votes: newVotedState ? q.votes + 1 : q.votes - 1
        }
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
            <Users className="h-3 w-3" />
            {attendeeCount} Attendees
          </Badge>
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            Room: {roomCode}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ask a Question</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitQuestion} className="flex flex-col gap-4">
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
              {sortedQuestions.map((question) => (
                <Card
                  key={question.id}
                  className={`transition-all ${
                    question.highlighted ? "border-2 border-yellow-400" : ""
                  } ${
                    question.answered ? "bg-gray-50 dark:bg-gray-800/50" : ""
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <Button
                          variant={question.voted ? "default" : "outline"}
                          size="icon"
                          className={`h-10 w-10 rounded-full ${
                            question.voted
                              ? "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
                              : ""
                          }`}
                          onClick={() => handleVote(question.id, question.text)}
                          disabled={question.answered}
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </Button>
                        <span className="mt-1 text-sm font-medium">
                          {question.votes}
                        </span>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <p
                              className={`text-lg ${
                                question.answered ? "text-gray-500" : ""
                              }`}
                            >
                              {question.text}
                            </p>
                            <div className="mt-1 flex items-center text-xs text-gray-500">
                              <span className="font-medium">
                                {question.author}
                              </span>
                              <span className="mx-1">•</span>
                              <span>
                                {new Date(
                                  question.timestamp
                                ).toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {question.answered && (
                      <div className="mt-2 rounded-md bg-green-50 p-2 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-200">
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" />
                          <span>This question has been answered</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}