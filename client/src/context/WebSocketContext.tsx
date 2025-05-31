"use client"
import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react'

interface WebSocketMessage {
  type: string
  payload: any
}

interface WebSocketContextType {
  sendMessage: (message: WebSocketMessage) => void
  lastMessage: WebSocketMessage | null
  isConnected: boolean
  reconnect: () => void
}

const WebSocketContext = createContext<WebSocketContextType | null>(null)

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const ws = useRef<WebSocket | null>(null)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const reconnectAttempts = useRef(0)
  const messageQueue = useRef<WebSocketMessage[]>([])
  const shouldReconnect = useRef(true)
  const isMounted = useRef(false)

  const cleanup = useCallback(() => {
    if (ws.current) {
      ws.current.onopen = null
      ws.current.onclose = null
      ws.current.onerror = null
      ws.current.onmessage = null
      if (ws.current.readyState === WebSocket.OPEN) {
        ws.current.close()
      }
      ws.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (!isMounted.current || !shouldReconnect.current) return

    cleanup()

    try {
      ws.current = new WebSocket('ws://localhost:8080')

      ws.current.onopen = () => {
        if (!isMounted.current) return
        console.log('Connected to WebSocket server')
        setIsConnected(true)
        reconnectAttempts.current = 0
        // Process queued messages
        while (messageQueue.current.length > 0 && ws.current?.readyState === WebSocket.OPEN) {
          const message = messageQueue.current.shift()
          if (message) ws.current.send(JSON.stringify(message))
        }
      }

      ws.current.onmessage = (event) => {
        if (!isMounted.current) return
        try {
          const message = JSON.parse(event.data)
          setLastMessage(message)
        } catch (error) {
          console.error('Error parsing message:', error)
        }
      }

      ws.current.onclose = () => {
        if (!isMounted.current) return
        setIsConnected(false)
        if (shouldReconnect.current) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
          reconnectAttempts.current++
          setTimeout(connect, delay)
        }
      }

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
    } catch (error) {
      console.error('WebSocket initialization error:', error)
      setIsConnected(false)
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
      reconnectAttempts.current++
      setTimeout(connect, delay)
    }
  }, [cleanup])

  const reconnect = useCallback(() => {
    shouldReconnect.current = true
    reconnectAttempts.current = 0
    connect()
  }, [connect])

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message))
    } else {
      messageQueue.current.push(message)
      if (!isConnected && reconnectAttempts.current === 0) {
        connect()
      }
    }
  }, [isConnected, connect])

  useEffect(() => {
    isMounted.current = true
    connect()

    return () => {
      isMounted.current = false
      shouldReconnect.current = false
      cleanup()
    }
  }, [connect, cleanup])

  return (
    <WebSocketContext.Provider value={{ sendMessage, lastMessage, isConnected, reconnect }}>
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