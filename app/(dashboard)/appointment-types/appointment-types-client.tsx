"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { AppointmentTypesTable } from "@/components/appointments/appointment-types-table"
import { AppointmentTypeCreateDialog } from "@/components/appointments/appointment-type-create-dialog"
import { useRouter } from "next/navigation"

interface SerializedClinic {
  id: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
  timezone: string
  locale: string
  defaultSlotMinutes: number
  patientAcronym: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

interface SerializedAppointmentType {
  id: string
  name: string
  clinicId: string
  durationMin: number
  price: number
  preInstructions: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  clinic: SerializedClinic | null
}

interface AppointmentTypesClientProps {
  appointmentTypes: SerializedAppointmentType[]
  clinics: SerializedClinic[]
  userRole: string
  userClinicId?: string
  canManage: boolean
}

export function AppointmentTypesClient({
  appointmentTypes,
  clinics,
  userRole,
  userClinicId,
  canManage,
}: AppointmentTypesClientProps) {
  const router = useRouter()

  const handleUpdate = () => {
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Header 
          title="Tipos de Citas" 
          description={canManage ? "Gestiona los tipos de citas y precios" : "Consulta los tipos de citas y precios"}
        />
        {canManage && (
          <AppointmentTypeCreateDialog
            clinics={clinics as any}
            userClinicId={userClinicId}
            userRole={userRole}
            onSuccess={handleUpdate}
          />
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <AppointmentTypesTable
            appointmentTypes={appointmentTypes as any}
            clinics={clinics as any}
            userRole={userRole}
            onUpdate={handleUpdate}
          />
        </CardContent>
      </Card>
    </div>
  )
}
