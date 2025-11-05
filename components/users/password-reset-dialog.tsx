
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { resetUserPassword } from "@/lib/actions/users"
import { toast } from "sonner"
import { KeyRound, Copy, Check } from "lucide-react"

interface PasswordResetDialogProps {
  userId: string
  userEmail: string
}

export function PasswordResetDialog({ userId, userEmail }: PasswordResetDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showTempPassword, setShowTempPassword] = useState(false)

  const handleReset = async () => {
    setLoading(true)

    try {
      const result = await resetUserPassword(userId)
      
      if (result.success && result.tempPassword) {
        setTempPassword(result.tempPassword)
        setShowTempPassword(true)
        toast.success("Contraseña temporal generada")
        router.refresh()
      }
    } catch (error: any) {
      toast.error(error.message || "Error al resetear contraseña")
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (tempPassword) {
      await navigator.clipboard.writeText(tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success("Contraseña copiada al portapapeles")
    }
  }

  const handleClose = () => {
    setShowTempPassword(false)
    setTempPassword(null)
    setCopied(false)
  }

  return (
    <>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <KeyRound className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Resetear Contraseña?</AlertDialogTitle>
            <AlertDialogDescription>
              Se generará una contraseña temporal para el usuario:{" "}
              <span className="font-medium text-foreground">{userEmail}</span>
              <br />
              <br />
              La contraseña actual será reemplazada y el usuario deberá usar la
              nueva contraseña temporal para iniciar sesión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} disabled={loading}>
              {loading ? "Generando..." : "Generar Contraseña"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showTempPassword} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Contraseña Temporal Generada</DialogTitle>
            <DialogDescription>
              Guarde esta contraseña y compártala con el usuario de forma segura.
              Esta contraseña solo se muestra una vez.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Usuario</Label>
              <Input value={userEmail} readOnly className="font-mono" />
            </div>

            <div className="space-y-2">
              <Label>Contraseña Temporal</Label>
              <div className="flex gap-2">
                <Input
                  value={tempPassword || ""}
                  readOnly
                  className="font-mono font-bold text-lg"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <p className="text-sm text-amber-800">
                <strong>Importante:</strong> El usuario debe cambiar esta
                contraseña después de iniciar sesión por primera vez.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleClose}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
