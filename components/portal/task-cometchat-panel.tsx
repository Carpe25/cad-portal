"use client"

import { useEffect, useState } from "react"
import { MessageSquare, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type TaskCometChatPanelProps = {
  taskId: string
  taskTitle: string
  currentUser: {
    id: string
    name: string
    email: string
  }
}

export function TaskCometChatPanel({
  taskId,
  taskTitle,
  currentUser,
}: TaskCometChatPanelProps) {
  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chatComps, setChatComps] = useState<{
    CometChatMessageList: any
    CometChatMessageComposer: any
    CometChatMessageHeader: any
    CometChatProvider: any
  } | null>(null)
  const [cometchatGroup, setCometchatGroup] = useState<any>(null)

  const appId = process.env.NEXT_PUBLIC_COMETCHAT_APP_ID
  const region = process.env.NEXT_PUBLIC_COMETCHAT_REGION
  const authKey = process.env.NEXT_PUBLIC_COMETCHAT_AUTH_KEY

  const groupId = `task_${taskId.replace(/[^a-zA-Z0-9_-]/g, "_")}`

  const initCometChat = async () => {
    setIsInitializing(true)
    setError(null)

    if (!appId || !region || !authKey) {
      setError("CometChat API keys are missing in .env.local")
      setIsInitializing(false)
      return
    }

    try {
      // Dynamic imports for client-side execution
      const {
        CometChatUIKit,
        UIKitSettingsBuilder,
        CometChatMessageList,
        CometChatMessageComposer,
        CometChatMessageHeader,
        CometChatProvider,
      } = await import("@cometchat/chat-uikit-react")
      const { CometChat } = await import("@cometchat/chat-sdk-javascript")

      setChatComps({
        CometChatMessageList,
        CometChatMessageComposer,
        CometChatMessageHeader,
        CometChatProvider,
      })

      // Initialize CometChat UIKit
      const UIKitSettings = new UIKitSettingsBuilder()
        .setAppId(appId)
        .setRegion(region)
        .setAuthKey(authKey)
        .subscribePresenceForFriends()
        .build()

      await CometChatUIKit.init(UIKitSettings)

      // Sanitize user ID
      const sanitizedUserId = currentUser.id
        ? currentUser.id.replace(/[^a-zA-Z0-9_-]/g, "_")
        : `user_${Date.now()}`

      // Check if user is logged in
      let loggedInUser = CometChatUIKit.getLoggedInUser()

      if (!loggedInUser) {
        try {
          loggedInUser = await CometChatUIKit.login(sanitizedUserId)
        } catch (loginError: any) {
          // If user doesn't exist, create user first via Core SDK
          if (
            loginError?.code === "ERR_UID_NOT_FOUND" ||
            loginError?.code === "ERR_ENTITY_DOES_NOT_EXISTS" ||
            loginError?.message?.includes("not exist")
          ) {
            const newUser = new CometChat.User(sanitizedUserId)
            newUser.setName(currentUser.name || currentUser.email || "Team Member")
            await CometChat.createUser(newUser, authKey)
            loggedInUser = await CometChatUIKit.login(sanitizedUserId)
          } else {
            throw loginError
          }
        }
      }

      // Check or Create Group for this Task
      try {
        const group = await CometChat.getGroup(groupId)
        setCometchatGroup(group)
      } catch (groupError: any) {
        // Group doesn't exist yet, create a new Public Group
        const groupType = CometChat.GROUP_TYPE.PUBLIC
        const newGroup = new CometChat.Group(
          groupId,
          `Task: ${taskTitle.substring(0, 50)}`,
          groupType
        )
        try {
          const createdGroup = await CometChat.createGroup(newGroup)
          setCometchatGroup(createdGroup)
        } catch (createErr) {
          // Fallback if group was created concurrently
          const fetchedGroup = await CometChat.getGroup(groupId)
          setCometchatGroup(fetchedGroup)
        }
      }

      setIsInitializing(false)
    } catch (err: any) {
      console.error("CometChat Init Error:", err)
      setError(err?.message || "Failed to connect to discussion server")
      setIsInitializing(false)
    }
  }

  useEffect(() => {
    initCometChat()
  }, [taskId, currentUser.id])

  return (
    <Card className="flex flex-col border border-border bg-card shadow-xs h-[550px]">
      <CardHeader className="py-3 px-4 border-b border-border flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold">
            Task Discussion
          </CardTitle>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-mono">
          Task ID: #{taskId.slice(0, 8)}
        </span>
      </CardHeader>

      <CardContent className="p-0 flex-1 relative overflow-hidden bg-background">
        {isInitializing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs z-10 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">
              Connecting to live discussion...
            </p>
          </div>
        )}

        {error && (
          <div className="p-6 flex flex-col items-center justify-center text-center space-y-3 h-full">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-sm text-muted-foreground max-w-md">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={initCometChat}
              className="mt-2"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Connection
            </Button>
          </div>
        )}

        {!isInitializing && !error && chatComps && cometchatGroup && (
          <chatComps.CometChatProvider>
            <div className="w-full h-full flex flex-col cometchat-task-container">
              <chatComps.CometChatMessageList group={cometchatGroup} />
              <chatComps.CometChatMessageComposer group={cometchatGroup} />
            </div>
          </chatComps.CometChatProvider>
        )}
      </CardContent>
    </Card>
  )
}
