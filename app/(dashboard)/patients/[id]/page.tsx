import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getPatient } from "@/lib/actions/patients";
import { Header } from "@/components/layout/header";

export default async function PatientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return notFound();
  }

  try {
    const patient = await getPatient(params.id);

    return (
      <div className="space-y-6">
        <Header
          title={`${patient.firstName} ${patient.lastName}`}
          description={`Patient ID: ${patient.customId}`}
        />
        <div className="grid gap-6">
          <div className="rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-4">Patient Information</h3>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-muted-foreground">Full Name</dt>
                <dd className="font-medium">
                  {patient.firstName} {patient.lastName}{" "}
                  {patient.secondLastName}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">
                  Medical Record Number
                </dt>
                <dd className="font-medium">{patient.customId}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Phone</dt>
                <dd className="font-medium">{patient.phone}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Email</dt>
                <dd className="font-medium">{patient.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Birth Date</dt>
                <dd className="font-medium">
                  {patient.birthDate
                    ? new Date(patient.birthDate).toLocaleDateString()
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Gender</dt>
                <dd className="font-medium">{patient.gender || "—"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    return notFound();
  }
}
