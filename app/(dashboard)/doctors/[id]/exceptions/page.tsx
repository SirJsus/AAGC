import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, Calendar, Clock, AlertCircle } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getDoctorExceptions } from "@/lib/actions/doctor-schedules";

export const dynamic = "force-dynamic";

export default async function DoctorExceptionsPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  // Get doctor information
  const doctor = await prisma.doctor.findUnique({
    where: { id: params.id },
    include: {
      user: true,
      clinic: true,
    },
  });

  if (!doctor) {
    redirect("/doctors");
  }

  // Get all exceptions for this doctor
  const exceptions = await getDoctorExceptions(params.id);

  const today = new Date().toISOString().split("T")[0];

  // Separate upcoming and past exceptions
  const upcomingExceptions = exceptions.filter((e) => e.date >= today);
  const pastExceptions = exceptions.filter((e) => e.date < today);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Header
          title={`Dr. ${doctor.user.firstName} ${doctor.user.lastName} - Exceptions`}
          description="Manage blocked time and schedule overrides"
        />
        <Link href={`/doctors/${params.id}/exceptions/new`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Exception
          </Button>
        </Link>
      </div>

      {/* Upcoming Exceptions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Upcoming Exceptions ({upcomingExceptions.length})
          </CardTitle>
          <CardDescription>
            Blocked time and schedule changes for future dates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingExceptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No upcoming exceptions</p>
              <p className="text-sm">
                Add exceptions to block time or override schedules
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingExceptions.map((exception) => (
                <div
                  key={exception.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[100px]">
                      <div className="text-sm font-medium text-blue-600">
                        {new Date(exception.date).toLocaleDateString("es-MX", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(exception.date).toLocaleDateString("es-MX", {
                          weekday: "long",
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm min-w-[150px]">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">
                        {exception.startTime && exception.endTime
                          ? `${exception.startTime} - ${exception.endTime}`
                          : "All Day"}
                      </span>
                    </div>

                    {exception.reason && (
                      <div className="text-sm text-muted-foreground max-w-md">
                        {exception.reason}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        !exception.startTime && !exception.endTime
                          ? "bg-red-100 text-red-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {!exception.startTime && !exception.endTime
                        ? "Full Day Block"
                        : "Partial Block"}
                    </span>
                    <Link
                      href={`/doctors/${params.id}/exceptions/${exception.id}/edit`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Exceptions */}
      {pastExceptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              Past Exceptions ({pastExceptions.length})
            </CardTitle>
            <CardDescription>
              Historical blocked time and schedule overrides
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {pastExceptions.map((exception) => (
                <div
                  key={exception.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-muted-foreground min-w-[100px]">
                      {new Date(exception.date).toLocaleDateString("es-MX", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>

                    <div className="text-sm text-muted-foreground">
                      {exception.startTime && exception.endTime
                        ? `${exception.startTime} - ${exception.endTime}`
                        : "All Day"}
                    </div>

                    {exception.reason && (
                      <div className="text-sm text-muted-foreground">
                        {exception.reason}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Link href={`/doctors/${params.id}/schedule`}>
          <Button variant="outline">View Schedule</Button>
        </Link>
        <Link href="/doctors">
          <Button variant="outline">Back to Doctors</Button>
        </Link>
      </div>
    </div>
  );
}
