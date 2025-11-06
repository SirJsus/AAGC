import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { Permissions } from "@/lib/permissions";
import { Header } from "@/components/layout/header";
import { authOptions } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar, Clock, UserPlus } from "lucide-react";

export default async function NewAppointmentPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || !Permissions.canCreateAppointments(session.user)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <Header
        title="New Appointment"
        description="Schedule a new patient appointment"
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Appointment Scheduling
            </CardTitle>
            <CardDescription>
              Advanced appointment scheduling with slot picker will be available
              in the next iteration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">Coming Soon</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Interactive slot picker with doctor availability</li>
                <li>• Real-time conflict detection</li>
                <li>• Patient selection with search</li>
                <li>• Appointment type selection with pricing</li>
                <li>• Room assignment and validation</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-green-600" />
              Current Features
            </CardTitle>
            <CardDescription>Available in this iteration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-green-700">
                  Patient Management
                </span>
              </div>
              <div className="flex items-center p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-green-700">Doctor Schedules</span>
              </div>
              <div className="flex items-center p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-green-700">
                  Appointment Types
                </span>
              </div>
              <div className="flex items-center p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-green-700">Room Management</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-600" />
            Temporary Workaround
          </CardTitle>
          <CardDescription>
            For this iteration, appointments can be managed through the
            appointments list
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              The comprehensive appointment scheduling interface will be
              available in Iteration 2.
            </p>
            <a
              href="/appointments"
              className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <Calendar className="mr-2 h-4 w-4" />
              View Existing Appointments
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
