"use client"

import React, { useState, useEffect } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Switch } from "@/components/ui/switch"

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 0)
        return () => clearTimeout(timer)
    }, [])

    if (!mounted) {
        // Return a placeholder of the exact same size to prevent layout shift
        return <div className="h-[24px] w-[68px]" />
    }

    const isDark = resolvedTheme === "dark"

    return (
        <div className="flex items-center space-x-3">
            <Sun
                className="size-4 text-muted-foreground transition-colors data-[active=true]:text-foreground"
                data-active={!isDark}
                aria-hidden="true"
            />

            <Switch
                checked={isDark}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                aria-label="Toggle theme"
            />

            <Moon
                className="size-4 text-muted-foreground transition-colors data-[active=true]:text-foreground"
                data-active={isDark}
                aria-hidden="true"
            />
        </div>
    )
}