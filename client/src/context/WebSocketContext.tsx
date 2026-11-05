"use client"
import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react'

export interface WebSocketMessage {
  type: string
  payload: any
}

type MessageListener = (message: WebSocketMessage) => void

interface WebSocketContextType {
  sendMessage: (message: WebSocketMessage) => void
  // Every incoming message is delivered to every subscriber, in order
  subscribe: (listener: MessageListener) => () => void
  // Sends the join now if connected, and again first on every reconnect so the
  // new socket is bound to the session again. Pass null when leaving.
  setJoinMessage: (message: WebSocketMessage | null) => void
  isConnected: boolean
  reconnect: () => void
}

const WebSocketContext = createContext<WebSocketContextType | null>(null)

const MAX_RECONNECT_DELAY = 30000

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const ws = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const listeners = useRef(new Set<MessageListener>())
  const messageQueue = useRef<WebSocketMessage[]>([])
  const joinMessage = useRef<WebSocketMessage | null>(null)
  const reconnectAttempts = useRef(0)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const active = useRef(false)

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (!active.current) return

    // Never open a second socket while one is open or still connecting
    const existing = ws.current
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) return

    clearReconnectTimer()

    const scheduleReconnect = () => {
      if (!active.current) return
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), MAX_RECONNECT_DELAY)
      reconnectAttempts.current++
      reconnectTimer.current = setTimeout(connect, delay)
    }

    let socket: WebSocket
    try {
      socket = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080')
    } catch (error) {
      console.error('WebSocket initialization error:', error)
      scheduleReconnect()
      return
    }
    ws.current = socket

    socket.onopen = () => {
      if (ws.current !== socket) return
      setIsConnected(true)
      reconnectAttempts.current = 0
      if (joinMessage.current) socket.send(JSON.stringify(joinMessage.current))
      while (messageQueue.current.length > 0) {
        socket.send(JSON.stringify(messageQueue.current.shift()))
      }
    }

    socket.onmessage = (event) => {
      if (ws.current !== socket) return
      let message: WebSocketMessage
      try {
        message = JSON.parse(event.data)
      } catch (error) {
        console.error('Error parsing message:', error)
        return
      }
      listeners.current.forEach((listener) => listener(message))
    }

    socket.onclose = () => {
      if (ws.current !== socket) return
      ws.current = null
      setIsConnected(false)
      scheduleReconnect()
    }

    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }, [clearReconnectTimer])

  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0
    connect()
  }, [connect])

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message))
    } else {
      messageQueue.current.push(message)
      if (!ws.current) connect()
    }
  }, [connect])

  const subscribe = useCallback((listener: MessageListener) => {
    listeners.current.add(listener)
    return () => {
      listeners.current.delete(listener)
    }
  }, [])

  const setJoinMessage = useCallback((message: WebSocketMessage | null) => {
    joinMessage.current = message
    if (!message) return
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message))
    } else if (!ws.current) {
      connect()
    }
  }, [connect])

  useEffect(() => {
    // Reset on every mount: React StrictMode unmounts and remounts once in development
    active.current = true
    connect()

    return () => {
      active.current = false
      clearReconnectTimer()
      const socket = ws.current
      ws.current = null
      socket?.close()
    }
  }, [connect, clearReconnectTimer])

  return (
    <WebSocketContext.Provider value={{ sendMessage, subscribe, setJoinMessage, isConnected, reconnect }}>
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

// Calls `handler` for every incoming message while the component is mounted.
// The latest handler is always used, so it can read current state without resubscribing.
export const useWebSocketMessages = (handler: MessageListener) => {
  const { subscribe } = useWebSocket()
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => subscribe((message) => handlerRef.current(message)), [subscribe])
}
