
import { notFound } from "next/navigation"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getPatient } from "@/lib/actions/patients"
import { Header } from "@/components/layout/header"
import { ConsentDialog } from "@/components/patients/consent-dialog"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default async function PatientConsentsPage({
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
          title={`Consents - ${patient.firstName} ${patient.lastName}`}
          description="Manage patient consents and authorizations"
        />
        
        <ConsentDialog patientId={patient.id}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Consent
          </Button>
        </ConsentDialog>
      </div>
    )
  } catch (error) {
    return notFound()
  }
}
