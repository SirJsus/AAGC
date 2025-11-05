
import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { Permissions } from "@/lib/permissions"
import { Header } from "@/components/layout/header"
import { getPatients } from "@/lib/actions/patients"
import { PatientsTable } from "@/components/patients/patients-table"

export const dynamic = "force-dynamic"

export default async function PatientsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user || !Permissions.canViewPatients(session.user)) {
    redirect("/dashboard")
  }

  const patients = await getPatients()
  const canEdit = Permissions.canEditPatients(session.user)

  return (
    <div className="space-y-6">
      <Header 
        title="Patients" 
        description={canEdit ? "Manage patient records and information" : "View patient records and information"}
      />
      <PatientsTable patients={patients} canEdit={canEdit} />
    </div>
  )
}
