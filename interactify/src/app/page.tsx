import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, MessageSquare, Users } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <header className="mb-16 text-center">
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight lg:text-5xl">Interactify</h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-500 dark:text-gray-400">
            Igniting real-time audience interaction during presentations and seminars
          </p>
        </header>

        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-2xl font-bold">Choose your role</h2>
            <p className="mx-auto max-w-2xl text-gray-500 dark:text-gray-400">
              Are you presenting or joining as an audience member?
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <Card className="overflow-hidden transition-all hover:shadow-lg">
              <CardHeader className="bg-gray-100 dark:bg-gray-800 py-3 px-5">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Presenter
                </CardTitle>
                <CardDescription>Create a new session and manage audience questions</CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-8">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800">
                      1
                    </div>
                    <div>
                      <h3 className="font-medium">Create a session</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Set up a new Q&A room for your presentation
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800">
                      2
                    </div>
                    <div>
                      <h3 className="font-medium">Share the room code</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Invite your audience to join using a unique code
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800">
                      3
                    </div>
                    <div>
                      <h3 className="font-medium">Manage questions</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        View, answer, and prioritize audience questions
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-gray-50 px-6 py-4 dark:bg-gray-800/50">
                <Link href="/presenter/create" className="w-full">
                  <Button className="w-full">
                    Create Session
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            <Card className="overflow-hidden transition-all hover:shadow-lg">
              <CardHeader className="bg-gray-100 dark:bg-gray-800 py-3 px-5">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Attendee
                </CardTitle>
                <CardDescription>Join a session and interact with the presenter</CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-8">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800">
                      1
                    </div>
                    <div>
                      <h3 className="font-medium">Join a session</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Enter the room code provided by the presenter
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800">
                      2
                    </div>
                    <div>
                      <h3 className="font-medium">Ask questions</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Submit your questions to the presenter</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800">
                      3
                    </div>
                    <div>
                      <h3 className="font-medium">Vote on questions</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Upvote questions you'd like answered</p>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-gray-50 px-6 py-4 dark:bg-gray-800/50">
                <Link href="/attendee/join" className="w-full">
                  <Button className="w-full" variant="outline">
                    Join Session
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}