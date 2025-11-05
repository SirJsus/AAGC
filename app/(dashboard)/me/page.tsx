
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Mail, Shield, Building2 } from "lucide-react"

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return null
  }

  const user = session.user

  return (
    <div className="space-y-6">
      <Header 
        title="My Profile" 
        description="View and manage your account information"
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              Personal Information
            </CardTitle>
            <CardDescription>
              Your basic account details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Full Name</label>
              <p className="text-sm">{user.firstName} {user.lastName}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="text-sm flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {user.email}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Role</label>
              <p className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {user.role}
              </p>
            </div>
            {user.clinicName && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Clinic</label>
                <p className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {user.clinicName}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Status</CardTitle>
            <CardDescription>
              Your account permissions and access level
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Access Level</label>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-sm">Active</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Permissions</label>
              <div className="text-sm space-y-1">
                {user.role === "ADMIN" && (
                  <>
                    <p>• Manage all clinics and users</p>
                    <p>• Full system access</p>
                  </>
                )}
                {user.role === "CLINIC_ADMIN" && (
                  <>
                    <p>• Manage clinic users and settings</p>
                    <p>• Manage appointments and patients</p>
                  </>
                )}
                {user.role === "RECEPTION" && (
                  <>
                    <p>• Manage appointments</p>
                    <p>• Manage patients</p>
                  </>
                )}
                {user.role === "DOCTOR" && (
                  <>
                    <p>• View appointments</p>
                    <p>• Manage patients</p>
                  </>
                )}
                {user.role === "NURSE" && (
                  <>
                    <p>• View appointments</p>
                    <p>• Manage patients</p>
                  </>
                )}
                {user.role === "PATIENT" && (
                  <p>• View personal appointments</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
