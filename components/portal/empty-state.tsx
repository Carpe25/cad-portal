import { InboxIcon, type LucideIcon } from "lucide-react"

// Adjust this import path based on where empty.tsx is located in your project
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export function EmptyState({
  icon: Icon = InboxIcon,
  title = "All clear",
  description,
}: {
  icon?: LucideIcon
  title?: string
  description: string
}) {
  return (
    <Empty className="border border-border/60 bg-muted/20 py-14">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="rounded-full">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}