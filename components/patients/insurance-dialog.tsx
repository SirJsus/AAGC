
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { createInsurance, updateInsurance, deleteInsurance } from '@/lib/actions/insurances'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

interface InsuranceDialogProps {
  children: React.ReactNode
  patientId: string
  insurance?: any
}

export function InsuranceDialog({ children, patientId, insurance }: InsuranceDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const [formData, setFormData] = useState({
    provider: insurance?.provider || '',
    policyNumber: insurance?.policyNumber || '',
    groupNumber: insurance?.groupNumber || '',
    expiryDate: insurance?.expiryDate ? new Date(insurance.expiryDate).toISOString().split('T')[0] : '',
    isActive: insurance?.isActive ?? true
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (insurance) {
        await updateInsurance({
          id: insurance.id,
          provider: formData.provider,
          policyNumber: formData.policyNumber,
          groupNumber: formData.groupNumber || undefined,
          expiryDate: formData.expiryDate ? new Date(formData.expiryDate) : undefined,
          isActive: formData.isActive
        })
        toast.success('Seguro actualizado')
      } else {
        await createInsurance({
          patientId,
          provider: formData.provider,
          policyNumber: formData.policyNumber,
          groupNumber: formData.groupNumber || undefined,
          expiryDate: formData.expiryDate ? new Date(formData.expiryDate) : undefined
        })
        toast.success('Seguro creado')
      }
      setOpen(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar seguro')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      await deleteInsurance(insurance.id)
      toast.success('Seguro eliminado')
      setOpen(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Error al eliminar seguro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {insurance ? 'Editar Seguro' : 'Nuevo Seguro'}
          </DialogTitle>
          <DialogDescription>
            {insurance
              ? 'Actualiza la información del seguro médico'
              : 'Agrega un nuevo seguro médico al paciente'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider">Aseguradora *</Label>
            <Input
              id="provider"
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              placeholder="Ej: IMSS, ISSSTE, MetLife"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="policyNumber">Número de Póliza *</Label>
            <Input
              id="policyNumber"
              value={formData.policyNumber}
              onChange={(e) => setFormData({ ...formData, policyNumber: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupNumber">Número de Grupo</Label>
            <Input
              id="groupNumber"
              value={formData.groupNumber}
              onChange={(e) => setFormData({ ...formData, groupNumber: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiryDate">Fecha de Vencimiento</Label>
            <Input
              id="expiryDate"
              type="date"
              value={formData.expiryDate}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
            />
          </div>

          {insurance && (
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">Seguro activo</Label>
            </div>
          )}

          <DialogFooter className="gap-2">
            {insurance && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" className="mr-auto">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. El seguro será eliminado permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {insurance ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
