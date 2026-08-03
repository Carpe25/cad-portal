"use client"

import dynamic from "next/dynamic"

const TaskCometChatPanelInner = dynamic(
  () => import("./task-cometchat-panel").then((mod) => mod.TaskCometChatPanel),
  {
    ssr: false,
    loading: () => (
      <div className="h-[550px] border border-border bg-card rounded-xl flex items-center justify-center p-6 text-muted-foreground text-sm">
        Loading discussion panel...
      </div>
    ),
  }
)

export function TaskCometChatPanel(props: {
  taskId: string
  taskTitle: string
  currentUser: {
    id: string
    name: string
    email: string
  }
}) {
  return <TaskCometChatPanelInner {...props} />
}
