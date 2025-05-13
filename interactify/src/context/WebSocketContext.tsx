"use client"

import { createContext, useContext, useEffect, useRef, ReactNode } from 'react'

interface WebSocketMessage {
  type: string
  payload: any
}

interface WebSocketContextType {
  sendMessage: (message: WebSocketMessage) => void
}

const WebSocketContext = createContext<WebSocketContextType | null>(null)

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const ws = useRef<WebSocket | null>(null)

  useEffect(() => {
    // Connect to WebSocket server
    ws.current = new WebSocket('ws://localhost:8080')

    ws.current.onopen = () => {
      console.log('Connected to WebSocket server')
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
      ws.current.send(JSON.stringify(message))
    } else {
      console.error('WebSocket is not connected')
    }
  }

  return (
    <WebSocketContext.Provider value={{ sendMessage }}>
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