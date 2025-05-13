"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"

export default function CreateSession() {
  const router = useRouter()
  const [sessionName, setSessionName] = useState("")
  const [presenterName, setPresenterName] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)

    try {
      // Connect to WebSocket
      const ws = new WebSocket('ws://localhost:8080')

      ws.onopen = () => {
        console.log('Connected to WebSocket server')
        ws.send(JSON.stringify({
          type: "create",
          payload: {
            sessionName,
            owner: presenterName
          }
        }))
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        console.log('Received message:', data)

        if (data.type === "sessionCreated") {
          const roomCode = data.payload.roomId
          toast.success("Session created successfully!")
          router.push(
            `/presenter/session/${roomCode}?name=${encodeURIComponent(sessionName)}&presenter=${encodeURIComponent(presenterName)}`
          )
          ws.close()
        } else if (data.type === "error") {
          toast.error(data.payload.message)
          setIsCreating(false)
          ws.close()
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        toast.error("Failed to connect to server")
        setIsCreating(false)
      }

      ws.onclose = () => {
        console.log('WebSocket connection closed')
      }

    } catch (error) {
      console.error('Error creating session:', error)
      toast.error("Failed to create session")
      setIsCreating(false)
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
              <CardTitle>Create a New Session</CardTitle>
              <CardDescription>Set up a Q&A session for your presentation</CardDescription>
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
  )
}