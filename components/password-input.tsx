"use client"

import * as React from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type PasswordInputProps = React.InputHTMLAttributes<HTMLInputElement>

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
    ({ className, ...props }, ref) => {
        const [showPassword, setShowPassword] = React.useState(false)

        return (
            <div className="relative w-full">
                <Input
                    className={cn(
                        "pr-10",
                        "[&::-ms-reveal]:hidden",
                        className
                    )}
                    ref={ref}
                    {...props}
                    type={showPassword ? "text" : "password"}
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={props.disabled}
                    className={cn(
                        "absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none",
                        "disabled:cursor-not-allowed disabled:opacity-50"
                    )}
                >
                    {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span className="sr-only">
                        {showPassword ? "Hide password" : "Show password"}
                    </span>
                </button>
            </div>
        )
    }
)
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }