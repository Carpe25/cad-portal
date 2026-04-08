"use client"

import { useState, useTransition } from "react"
import { loginAction } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, SplinePointer } from "lucide-react"

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await loginAction(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 md:flex md:w-2/5 lg:w-1/3">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(oklch(1 0 0 / 15%) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 15%) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 shadow-sm transition-transform hover:scale-105">
            <SplinePointer strokeWidth={1.5} className="text-white" size={20} />
          </div>
          <h1 className="mt-6 font-heading text-2xl font-bold text-white">
            CAD Portal
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Carpe Diam internal tools for managing CAD tasks, QC workflows, and
            team productivity.
          </p>
        </div>

        <div className="relative space-y-3">
          {[
            "Track tasks from assignment to delivery",
            "Auto-escalating priority queue",
            "Integrated QC review workflow",
          ].map((line) => (
            <div key={line} className="flex items-center gap-2.5">
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/50" />
              <p className="text-xs text-white/60">{line}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-in duration-500 fade-in slide-in-from-bottom-4">
          {/* Mobile-only brand */}
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <SplinePointer
                strokeWidth={1.5}
                className="text-primary-foreground"
                size={18}
              />
            </div>
            <div>
              <p className="font-heading text-base leading-none font-semibold">
                CAD Portal
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Carpe Diam</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              Welcome back
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in to your account to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@carpediam.in"
                disabled={isPending}
                className="bg-muted/40 transition-all focus-visible:bg-transparent focus-visible:ring-primary/30"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                disabled={isPending}
                className="bg-muted/40 transition-all focus-visible:bg-transparent focus-visible:ring-primary/30"
              />
            </div>

            {error && (
              <div className="animate-in rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 fade-in slide-in-from-top-1">
                <p className="text-sm font-medium text-destructive">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isPending}
              className="mt-1 h-10 w-full font-medium transition-all active:scale-[0.98]"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Don&apos;t have access?{" "}
            <span className="font-medium text-foreground hover:underline">
              Contact your manager.
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}
