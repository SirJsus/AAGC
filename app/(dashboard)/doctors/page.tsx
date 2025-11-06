
import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { Permissions } from "@/lib/permissions"
import { Header } from "@/components/layout/header"
import { getDoctors } from "@/lib/actions/doctors"
import { DoctorsTable } from "@/components/doctors/doctors-table"

export const dynamic = "force-dynamic"

export default async function DoctorsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user || !Permissions.canViewDoctors(session.user)) {
    redirect("/dashboard")
  }

  const doctors = await getDoctors()
  const canManage = Permissions.canManageDoctors(session.user)

  return (
    <div className="space-y-6">
      <Header 
        title="Doctors" 
        description={canManage ? "Manage doctors and their schedules" : "View active doctors"}
      />
      <DoctorsTable doctors={doctors} canManage={canManage} />
    </div>
  )
}
