import { Session, Question } from '../types'

class SessionService {
  private sessions: Session[] = []

  createSession(sessionName: string, owner: string, roomId: string): Session {
    const newSession: Session = {
      sessionName,
      roomId,
      owner,
      attendees: [],
      questions: [],
      createdAt: new Date(),
    }

    this.sessions.push(newSession)
    return newSession
  }

  findSession(roomId: string): Session | undefined {
    return this.sessions.find((s) => s.roomId === roomId)
  }

  joinSession(roomId: string, attendee: string): Session | null {
    const session = this.findSession(roomId)
    if (!session) return null

    if (!session.attendees.includes(attendee)) {
      session.attendees.push(attendee)
    }
    return session
  }

  leaveSession(roomId: string, attendee: string): Session | null {
    const session = this.findSession(roomId)
    if (!session) return null

    session.attendees = session.attendees.filter((a) => a !== attendee)
    return session
  }

  addQuestion(roomId: string, questionText: string, author: string): Question | null {
    const session = this.findSession(roomId)
    if (!session || !session.attendees.includes(author)) return null

    const newQuestion: Question = {
      questionText,
      upVotes: 0,
      downVotes: 0,
      author,
      createdAt: new Date(),
      answered: false,
      highlighted: false,
    }

    session.questions.push(newQuestion)
    return newQuestion
  }

  voteQuestion(roomId: string, questionText: string, voteType: 'upVote' | 'downVote'): Question | null {
    const session = this.findSession(roomId)
    if (!session) return null

    const question = session.questions.find((q) => q.questionText === questionText)
    if (!question) return null

    if (voteType === 'upVote') {
      question.upVotes += 1
    } else {
      question.downVotes += 1
    }

    return question
  }

  markQuestion(roomId: string, questionText: string, action: string): Question | null {
    const session = this.findSession(roomId)
    if (!session) return null

    const question = session.questions.find((q) => q.questionText === questionText)
    if (!question) return null

    switch (action) {
      case 'answered':
        question.answered = true
        break
      case 'unanswered':
        question.answered = false
        break
      case 'highlighted':
        question.highlighted = true
        break
      case 'unhighlighted':
        question.highlighted = false
        break
      default:
        return null
    }

    return question
  }

  closeSession(roomId: string, owner: string): boolean {
    const sessionIndex = this.sessions.findIndex((s) => s.roomId === roomId)
    if (sessionIndex === -1) return false

    const session = this.sessions[sessionIndex]
    if (session.owner !== owner) return false

    this.sessions.splice(sessionIndex, 1)
    return true
  }

  getAllSessions(): Session[] {
    return this.sessions
  }
}

export const sessionService = new SessionService()