import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { signOut } from "next-auth/react";

export default async function AccountDisabledPage() {
  const session = await getServerSession(authOptions);

  // If not logged in, redirect to login
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Cuenta Deshabilitada</CardTitle>
          <CardDescription className="text-base mt-2">
            Tu cuenta ha sido deshabilitada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-4">
              Tu cuenta de usuario ha sido deshabilitada por un administrador.
              No tienes acceso al sistema en este momento.
            </p>
            <p className="mb-4">
              Si crees que esto es un error, por favor contacta con el
              administrador del sistema o con el equipo de soporte técnico.
            </p>
          </div>

          <form action="/api/auth/signout" method="POST" className="w-full">
            <Button type="submit" className="w-full" variant="outline">
              Cerrar Sesión
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
