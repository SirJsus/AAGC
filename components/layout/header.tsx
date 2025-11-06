
"use client"

import { useSession } from "next-auth/react"
import { Card, CardContent } from "@/components/ui/card"

interface HeaderProps {
  title: string
  description?: string
}

export function Header({ title, description }: HeaderProps) {
  const { data: session } = useSession() || {}

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {description && (
              <p className="text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          {session?.user && (
            <div className="text-right">
              <p className="text-sm font-medium">
                {session.user.firstName} {session.user.lastName}
              </p>
              <p className="text-xs text-muted-foreground">
                {session.user.role}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
