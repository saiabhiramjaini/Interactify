"use client"

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'

interface WebSocketMessage {
  type: string
  payload: any
}

interface WebSocketContextType {
  sendMessage: (message: WebSocketMessage) => void
  lastMessage: WebSocketMessage | null
}

const WebSocketContext = createContext<WebSocketContextType | null>(null)

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const ws = useRef<WebSocket | null>(null)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)

  useEffect(() => {
    // Connect to WebSocket server
    ws.current = new WebSocket('ws://localhost:8080')

    ws.current.onopen = () => {
      console.log('Connected to WebSocket server')
    }

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data)
      console.log('Message received:', message)
      setLastMessage(message)
    }

    ws.current.onclose = () => {
      console.log('Disconnected from WebSocket server')
    }

    return () => {
      if (ws.current) {
        ws.current.close()
      }
    }
  }, [])

  const sendMessage = (message: WebSocketMessage) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log('Sending message:', message)
      ws.current.send(JSON.stringify(message))
    } else {
      console.error('WebSocket is not connected')
    }
  }

  return (
    <WebSocketContext.Provider value={{ sendMessage, lastMessage }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export const useWebSocket = () => {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}