"use client"

import type { LucideIcon } from "lucide-react"

interface FeatureTabProps {
  active: boolean
  onClick: () => void
  icon: LucideIcon
  label: string
}

export function FeatureTab({ active, onClick, icon: Icon, label }: FeatureTabProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all ${
        active ? "bg-primary text-primary-foreground shadow-md" : "bg-muted/50 text-muted-foreground hover:bg-muted"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}