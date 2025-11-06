
"use client"

import { Navigation } from "@/components/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { useSession } from "next-auth/react"

export function Sidebar() {
  const { data: session } = useSession() || {}

  if (!session?.user) {
    return null
  }

  return (
    <Card className="h-full">
      <CardContent className="p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold">AAGC</h2>
          <p className="text-sm text-muted-foreground">Medical Clinic Management</p>
          {session.user.clinicName && (
            <p className="text-xs text-muted-foreground mt-1">
              {session.user.clinicName}
            </p>
          )}
        </div>
        <Navigation />
      </CardContent>
    </Card>
  )
}
