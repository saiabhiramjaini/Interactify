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

export default function JoinSession() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [roomCode, setRoomCode] = useState("")
  const [attendeeName, setAttendeeName] = useState("")
  const [isJoining, setIsJoining] = useState(false)

  useEffect(() => {
    const codeFromUrl = searchParams.get("code")
    if (codeFromUrl) {
      setRoomCode(codeFromUrl)
    }
  }, [searchParams])

  const handleJoinSession = (e: React.FormEvent) => {
    e.preventDefault()
    setIsJoining(true)

    const ws = new WebSocket('ws://localhost:8080')

    ws.onopen = () => {
      console.log('WebSocket connection opened')
      ws.send(JSON.stringify({
        type: "join",
        payload: {
          roomId: roomCode,
          attendee: attendeeName
        }
      }))
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      console.log('Received message:', data)

      if (data.type === "sessionJoined") {
        toast.success("Successfully joined the session!")
        router.push(`/attendee/session/${roomCode}?name=${encodeURIComponent(attendeeName)}`)
        ws.close()
      } else if (data.type === "error") {
        toast.error(data.payload.message)
        setIsJoining(false)
        ws.close()
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      toast.error("Failed to connect to the session")
      setIsJoining(false)
    }

    ws.onclose = () => {
      console.log('WebSocket connection closed')
    }
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