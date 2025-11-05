
import { notFound } from "next/navigation"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getPatient } from "@/lib/actions/patients"
import { Header } from "@/components/layout/header"
import { InsuranceDialog } from "@/components/patients/insurance-dialog"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default async function PatientInsurancesPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return notFound()
  }

  try {
    const patient = await getPatient(params.id)
    
    return (
      <div className="space-y-6">
        <Header 
          title={`Insurance - ${patient.firstName} ${patient.lastName}`}
          description="Manage patient insurance information"
        />
        
        <InsuranceDialog patientId={patient.id}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Insurance
          </Button>
        </InsuranceDialog>
      </div>
    )
  } catch (error) {
    return notFound()
  }
}
