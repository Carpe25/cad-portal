'use client'

import React, { useState, useEffect, useRef } from 'react'
import usePartySocket from 'partysocket/react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageSquare, Send, Users, Circle } from 'lucide-react'
import { getTaskMessages, saveTaskMessage, TaskChatMessage } from '@/app/(portal)/tasks/[id]/chat-actions'

interface TaskPartyKitPanelProps {
  taskId: string
  taskTitle?: string
  currentUser: {
    id: string
    name: string
    email?: string
  }
}

export function TaskPartyKitPanel({ taskId, taskTitle, currentUser }: TaskPartyKitPanelProps) {
  const [messages, setMessages] = useState<TaskChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [activeCount, setActiveCount] = useState<number>(1)
  const [isSending, setIsSending] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 1. Initial load of chat history from Neon DB
  useEffect(() => {
    let isMounted = true
    async function loadHistory() {
      setIsLoadingHistory(true)
      const history = await getTaskMessages(taskId)
      if (isMounted) {
        setMessages(history)
        setIsLoadingHistory(false)
      }
    }
    loadHistory()
    return () => {
      isMounted = false
    }
  }, [taskId])

  // Auto-scroll to bottom whenever messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoadingHistory])

  // 2. Connect to PartyKit room (Dynamic room per task)
  const partyHost = process.env.NEXT_PUBLIC_PARTYKIT_HOST || '127.0.0.1:1999'

  const socket = usePartySocket({
    host: partyHost,
    room: `task-${taskId}`,
    onMessage(event) {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'presence' && typeof data.activeCount === 'number') {
          setActiveCount(data.activeCount)
        } else if (data.type === 'chat_message' && data.message) {
          const incomingMsg: TaskChatMessage = data.message

          setMessages((prev) => {
            // Check if message is already in state (prevent duplicates from optimistic updates)
            if (prev.some((m) => m.id === incomingMsg.id)) {
              return prev
            }
            return [...prev, incomingMsg]
          })
        }
      } catch (err) {
        console.error('Error parsing PartyKit WebSocket event:', err)
      }
    },
  })

  // 3. Handle sending a message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const content = inputText.trim()
    if (!content || isSending) return

    setInputText('')
    setIsSending(true)

    // Generate optimistic ID
    const tempId = `temp-${Date.now()}`
    const optimisticMessage: TaskChatMessage = {
      id: tempId,
      task_id: taskId,
      user_id: currentUser.id,
      user_name: currentUser.name || 'Anonymous',
      user_email: currentUser.email || null,
      content: content,
      created_at: new Date().toISOString(),
    }

    // Immediately display locally (0ms UI feedback)
    setMessages((prev) => [...prev, optimisticMessage])

    // Save to Neon DB
    const savedMessage = await saveTaskMessage(
      taskId,
      currentUser.id,
      currentUser.name || 'Anonymous',
      currentUser.email || null,
      content
    )

    const finalMessage = savedMessage || optimisticMessage

    // Broadcast over PartyKit WebSockets to all connected team members (< 50ms)
    socket.send(
      JSON.stringify({
        type: 'chat_message',
        message: finalMessage,
      })
    )

    // Replace optimistic message with actual DB persisted message
    if (savedMessage) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? savedMessage : m)))
    }

    setIsSending(false)
  }

  // Utility to get user initials for Avatars
  const getInitials = (name: string) => {
    if (!name) return 'U'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.substring(0, 2).toUpperCase()
  }

  return (
    <Card className="w-full shadow-md border border-border/80 flex flex-col h-[520px]">
      {/* Header */}
      <CardHeader className="py-3 px-4 border-b bg-muted/30 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <div>
            <CardTitle className="text-base font-semibold">Task Discussion</CardTitle>
            {taskTitle && <p className="text-xs text-muted-foreground line-clamp-1">{taskTitle}</p>}
          </div>
        </div>

        {/* Live Active Status Badge */}
        <Badge variant="secondary" className="flex items-center gap-1.5 px-2.5 py-1 text-xs">
          <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500 animate-pulse" />
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <span>{activeCount} Online</span>
        </Badge>
      </CardHeader>

      {/* Message List Feed */}
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
        {isLoadingHistory ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-3/4 rounded-lg" />
              </div>
            </div>
            <div className="flex items-start gap-3 justify-end">
              <div className="space-y-1 flex-1 flex flex-col items-end">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-1/2 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-6">
            <MessageSquare className="w-10 h-10 mb-2 stroke-1 opacity-50" />
            <p className="text-sm font-medium">No discussion messages yet.</p>
            <p className="text-xs text-muted-foreground">Start the conversation below!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === currentUser.id
            const timeFormatted = new Date(msg.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <Avatar className="w-8 h-8 text-xs border">
                  <AvatarFallback className={isMe ? 'bg-primary text-primary-foreground font-semibold' : 'bg-muted font-medium'}>
                    {getInitials(msg.user_name)}
                  </AvatarFallback>
                </Avatar>

                <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-xs font-semibold text-foreground/90">{msg.user_name}</span>
                    <span className="text-[10px] text-muted-foreground">{timeFormatted}</span>
                  </div>

                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                      isMe
                        ? 'bg-primary text-primary-foreground rounded-tr-none'
                        : 'bg-muted/80 text-foreground border rounded-tl-none'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </CardContent>

      {/* Message Input Footer */}
      <CardFooter className="p-3 border-t bg-muted/20">
        <form onSubmit={handleSendMessage} className="flex w-full items-center gap-2">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            placeholder="Type a message..."
            className="flex-1 text-sm bg-background"
          />
          <Button
            type="submit"
            disabled={!inputText.trim() || isSending}
            size="icon"
            className="shrink-0 h-9 w-9"
          >
            <Send className="w-4 h-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}
