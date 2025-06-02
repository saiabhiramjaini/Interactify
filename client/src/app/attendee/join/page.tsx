"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { useWebSocket } from "@/context/WebSocketContext"
import { generateAttendeeId } from "@/utils/generateAttendeeId"
import { randomName } from "@/utils/generateAttendeeName"

export default function JoinSession() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [roomCode, setRoomCode] = useState("")
  const [attendeeName, setAttendeeName] = useState("")
  const [isJoining, setIsJoining] = useState(false)
  const [attendeeId, setAttendeeId] = useState("")
  const { sendMessage, lastMessage } = useWebSocket()

  useEffect(() => {
    const codeFromUrl = searchParams.get("code")
    if (codeFromUrl) {
      setRoomCode(codeFromUrl)
    }
    setAttendeeName(randomName)
    setAttendeeId(generateAttendeeId())
  }, [searchParams])

  useEffect(() => {
    if (!lastMessage) return

    switch (lastMessage.type) {
      case "sessionJoined":
        // Successfully joined the session
        toast.success("Successfully joined the session!")
        router.push(`/attendee/session/${roomCode}?name=${encodeURIComponent(attendeeName)}&id=${attendeeId}`)
        break
        
      case "error":
        // Handle errors from the server
        toast.error(lastMessage.payload.message)
        setIsJoining(false)
        break
    }
  }, [lastMessage, router, roomCode, attendeeName, attendeeId])

  const handleJoinSession = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate inputs
    if (!roomCode || !attendeeName) {
      toast.error("Please enter both room code and your name")
      return
    }

    setIsJoining(true)

    // Send join message to WebSocket server
    sendMessage({
      type: "join",
      payload: {
        roomId: roomCode,
        attendee: {
          id: attendeeId,
          name: attendeeName || randomName
        }
      }
    })
  }

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
              <CardTitle>Join a Session</CardTitle>
              <CardDescription>Enter the room code provided by the presenter</CardDescription>
            </div>
          </div>
        </CardHeader>
        <form onSubmit={handleJoinSession}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="room-code">Room Code</Label>
              <Input
                id="room-code"
                placeholder="e.g., ABC123"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="text-center text-lg font-bold tracking-wider"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendee-name">Your Name</Label>
              <Input
                id="attendee-name"
                placeholder="e.g., Jane Smith"
                value={attendeeName}
                onChange={(e) => setAttendeeName(e.target.value)}
                required
              />
              <p className="text-xs text-gray-500">This will be displayed with your questions</p>
            </div>
          </CardContent>
          <CardFooter className="mt-5">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={!roomCode || !attendeeName || isJoining}
            >
              {isJoining ? "Joining..." : "Join Session"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}