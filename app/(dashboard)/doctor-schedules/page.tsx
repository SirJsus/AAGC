
import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { DoctorSchedulesManager } from "@/components/doctors/doctor-schedules-manager"

export const metadata = {
  title: "Gestión de Horarios de Doctores",
  description: "Configure horarios y excepciones para los doctores de la clínica",
}

export default function DoctorSchedulesPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Horarios de Doctores</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuración de Horarios</CardTitle>
          <CardDescription>
            Gestione los horarios regulares y excepciones (vacaciones, días libres) de cada doctor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LoadingState />}>
            <DoctorSchedulesManager />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
