
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { createConsent, updateConsent, grantConsent, revokeConsent } from '@/lib/actions/consents'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { ConsentType } from '@prisma/client'
import { Loader2 } from 'lucide-react'

interface ConsentDialogProps {
  children: React.ReactNode
  patientId: string
  consent?: any
}

export function ConsentDialog({ children, patientId, consent }: ConsentDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const [formData, setFormData] = useState({
    type: consent?.type || 'TREATMENT',
    title: consent?.title || '',
    content: consent?.content || '',
    granted: consent?.granted || false,
    version: consent?.version || '1.0'
  })

  const consentTypes = [
    { value: 'TREATMENT', label: 'Tratamiento' },
    { value: 'PRIVACY', label: 'Privacidad' },
    { value: 'DATA_SHARING', label: 'Compartir Datos' },
    { value: 'MARKETING', label: 'Marketing' },
    { value: 'RESEARCH', label: 'Investigación' }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (consent) {
        await updateConsent({
          id: consent.id,
          granted: formData.granted,
          revokedAt: formData.granted ? null : new Date()
        })
        toast.success('Consentimiento actualizado')
      } else {
        await createConsent({
          patientId,
          type: formData.type as ConsentType,
          title: formData.title,
          content: formData.content,
          granted: formData.granted,
          version: formData.version
        })
        toast.success('Consentimiento creado')
      }
      setOpen(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar consentimiento')
    } finally {
      setLoading(false)
    }
  }

  const handleGrant = async () => {
    setLoading(true)
    try {
      await grantConsent(consent.id)
      toast.success('Consentimiento otorgado')
      setOpen(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Error al otorgar consentimiento')
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async () => {
    setLoading(true)
    try {
      await revokeConsent(consent.id)
      toast.success('Consentimiento revocado')
      setOpen(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Error al revocar consentimiento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {consent ? 'Detalles del Consentimiento' : 'Nuevo Consentimiento'}
          </DialogTitle>
          <DialogDescription>
            {consent
              ? 'Ver y gestionar el consentimiento del paciente'
              : 'Crear un nuevo consentimiento para el paciente'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Tipo de Consentimiento</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value })}
              disabled={!!consent}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un tipo" />
              </SelectTrigger>
              <SelectContent>
                {consentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              disabled={!!consent}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Contenido</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              required
              rows={6}
              disabled={!!consent}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="version">Versión</Label>
            <Input
              id="version"
              value={formData.version}
              onChange={(e) => setFormData({ ...formData, version: e.target.value })}
              disabled={!!consent}
            />
          </div>

          {!consent && (
            <div className="flex items-center space-x-2">
              <Switch
                id="granted"
                checked={formData.granted}
                onCheckedChange={(checked) => setFormData({ ...formData, granted: checked })}
              />
              <Label htmlFor="granted">Consentimiento otorgado</Label>
            </div>
          )}

          {consent && (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Estado actual</p>
                  <p className="text-sm text-muted-foreground">
                    {consent.granted ? 'Consentimiento otorgado' : 'No otorgado'}
                  </p>
                  {consent.grantedAt && (
                    <p className="text-xs text-muted-foreground">
                      Otorgado: {new Date(consent.grantedAt).toLocaleDateString('es-MX')}
                    </p>
                  )}
                  {consent.revokedAt && (
                    <p className="text-xs text-muted-foreground">
                      Revocado: {new Date(consent.revokedAt).toLocaleDateString('es-MX')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {!consent.granted && (
                    <Button
                      type="button"
                      onClick={handleGrant}
                      disabled={loading}
                      variant="default"
                    >
                      {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Otorgar
                    </Button>
                  )}
                  {consent.granted && !consent.revokedAt && (
                    <Button
                      type="button"
                      onClick={handleRevoke}
                      disabled={loading}
                      variant="destructive"
                    >
                      {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Revocar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {!consent && (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Crear Consentimiento
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
