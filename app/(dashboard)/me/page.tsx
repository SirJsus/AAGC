import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EditProfileDialog } from "@/components/profile/edit-profile-dialog";
import { ChangePasswordDialog } from "@/components/profile/change-password-dialog";
import { User, Mail, Shield, Building2, Phone, MapPin } from "lucide-react";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  // Obtener datos completos del usuario desde la base de datos
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { clinic: true },
  });

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Header
        title="Mi Perfil"
        description="Visualiza y administra la información de tu cuenta"
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Información Personal
                </CardTitle>
                <CardDescription>Tus datos básicos de cuenta</CardDescription>
              </div>
              <EditProfileDialog user={user} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Nombre Completo
              </label>
              <p className="text-sm">
                {user.firstName} {user.lastName}
                {user.secondLastName && ` ${user.secondLastName}`}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Email
              </label>
              <p className="text-sm flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {user.email}
              </p>
            </div>
            {user.phone && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Teléfono
                </label>
                <p className="text-sm flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {user.phone}
                </p>
              </div>
            )}
            {user.address && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Dirección
                </label>
                <p className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {user.address}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Rol
              </label>
              <p className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {user.role}
              </p>
            </div>
            {user.clinic && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Clínica
                </label>
                <p className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {user.clinic.name}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Seguridad</CardTitle>
              <CardDescription>
                Administra la seguridad de tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Contraseña
                </label>
                <p className="text-sm text-muted-foreground">••••••••••••</p>
              </div>
              <ChangePasswordDialog userId={user.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estado de la Cuenta</CardTitle>
              <CardDescription>
                Permisos y nivel de acceso de tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Nivel de Acceso
                </label>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-sm">Activo</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Permisos
                </label>
                <div className="text-sm space-y-1">
                  {user.role === "ADMIN" && (
                    <>
                      <p>• Administrar todas las clínicas y usuarios</p>
                      <p>• Acceso completo al sistema</p>
                    </>
                  )}
                  {user.role === "CLINIC_ADMIN" && (
                    <>
                      <p>• Administrar usuarios y configuración de clínica</p>
                      <p>• Administrar citas y pacientes</p>
                    </>
                  )}
                  {user.role === "RECEPTION" && (
                    <>
                      <p>• Administrar citas</p>
                      <p>• Administrar pacientes</p>
                    </>
                  )}
                  {user.role === "DOCTOR" && (
                    <>
                      <p>• Ver citas</p>
                      <p>• Administrar pacientes</p>
                    </>
                  )}
                  {user.role === "NURSE" && (
                    <>
                      <p>• Ver citas</p>
                      <p>• Administrar pacientes</p>
                    </>
                  )}
                  {user.role === "PATIENT" && <p>• Ver citas personales</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
