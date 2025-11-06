
"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { createAppointmentType } from "@/lib/actions/appointment-types"
import { Clinic } from "@prisma/client"

interface AppointmentTypeCreateDialogProps {
  clinics: Clinic[]
  userClinicId?: string
  userRole?: string
  onSuccess?: () => void
}

export function AppointmentTypeCreateDialog({ 
  clinics, 
  userClinicId, 
  userRole,
  onSuccess 
}: AppointmentTypeCreateDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    name: "",
    clinicId: userClinicId || "",
    durationMin: "30",
    price: "",
    preInstructions: "",
  })

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setFormData({
          name: "",
          clinicId: userClinicId || "",
          durationMin: "30",
          price: "",
          preInstructions: "",
        })
      }, 200)
    }
  }, [open, userClinicId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast.error("El nombre es requerido")
      return
    }

    if (!formData.clinicId) {
      toast.error("La clínica es requerida")
      return
    }

    setIsLoading(true)
    try {
      await createAppointmentType({
        name: formData.name.trim(),
        clinicId: formData.clinicId,
        durationMin: parseInt(formData.durationMin) || 30,
        price: formData.price ? parseFloat(formData.price) : 0,
        preInstructions: formData.preInstructions.trim() || undefined,
      })

      toast.success("Tipo de cita creado exitosamente")
      setOpen(false)
      onSuccess?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear tipo de cita")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Tipo de Cita
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Crear Tipo de Cita</DialogTitle>
            <DialogDescription>
              Define un nuevo tipo de cita con duración y precio estándar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Nombre <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Consulta General, Seguimiento, Revisión..."
                required
              />
            </div>

            {userRole === "ADMIN" && (
              <div className="space-y-2">
                <Label htmlFor="clinic">
                  Clínica <span className="text-red-500">*</span>
                </Label>
                <Select 
                  value={formData.clinicId} 
                  onValueChange={(value) => setFormData({ ...formData, clinicId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una clínica" />
                  </SelectTrigger>
                  <SelectContent>
                    {clinics.map((clinic) => (
                      <SelectItem key={clinic.id} value={clinic.id}>
                        {clinic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">
                  Duración (minutos) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="duration"
                  type="number"
                  min="5"
                  max="480"
                  value={formData.durationMin}
                  onChange={(e) => setFormData({ ...formData, durationMin: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Precio</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Instrucciones Previas</Label>
              <Textarea
                id="instructions"
                value={formData.preInstructions}
                onChange={(e) => setFormData({ ...formData, preInstructions: e.target.value })}
                placeholder="Instrucciones o recomendaciones antes de la cita..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creando..." : "Crear Tipo de Cita"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
