
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getAuditLogs } from '@/lib/actions/audit'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileText, User, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default async function AuditLogsPage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/login')
  }

  // Solo ADMIN y CLINIC_ADMIN pueden ver los audit logs
  if (session.user.role !== 'ADMIN' && session.user.role !== 'CLINIC_ADMIN') {
    redirect('/dashboard')
  }

  const { logs } = await getAuditLogs({
    clinicId: session.user.role === 'CLINIC_ADMIN' ? (session.user.clinicId || undefined) : undefined,
    limit: 100
  })

  const actionColors: Record<string, string> = {
    CREATE: 'bg-green-500',
    UPDATE: 'bg-blue-500',
    DELETE: 'bg-red-500',
    LOGIN: 'bg-purple-500',
    LOGOUT: 'bg-gray-500',
    VIEW: 'bg-cyan-500',
    EXPORT: 'bg-orange-500',
    IMPORT: 'bg-yellow-500'
  }

  const actionLabels: Record<string, string> = {
    CREATE: 'Creación',
    UPDATE: 'Actualización',
    DELETE: 'Eliminación',
    LOGIN: 'Inicio de sesión',
    LOGOUT: 'Cierre de sesión',
    VIEW: 'Visualización',
    EXPORT: 'Exportación',
    IMPORT: 'Importación'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Registro de Auditoría</h1>
        <p className="text-muted-foreground">
          Historial de acciones realizadas en el sistema
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actividad Reciente</CardTitle>
          <CardDescription>
            Últimas 100 acciones registradas en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <Badge className={actionColors[log.action] || 'bg-gray-500'}>
                      {actionLabels[log.action] || log.action}
                    </Badge>
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>{log.entityType}</span>
                      {log.entityId && (
                        <span className="text-muted-foreground">
                          #{log.entityId.substring(0, 8)}
                        </span>
                      )}
                    </div>
                    
                    {log.userId && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>Usuario: {log.userId.substring(0, 8)}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>
                        {format(new Date(log.createdAt), "dd/MM/yyyy 'a las' HH:mm:ss", {
                          locale: es
                        })}
                      </span>
                    </div>

                    {log.ipAddress && (
                      <div className="text-xs text-muted-foreground">
                        IP: {log.ipAddress}
                      </div>
                    )}

                    {/* Mostrar cambios si existen */}
                    {log.oldValues && log.newValues && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          Ver cambios
                        </summary>
                        <div className="mt-2 space-y-2 text-xs">
                          <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded">
                            <div className="font-medium text-red-700 dark:text-red-400 mb-1">
                              Antes:
                            </div>
                            <pre className="overflow-x-auto text-xs">
                              {JSON.stringify(log.oldValues, null, 2)}
                            </pre>
                          </div>
                          <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded">
                            <div className="font-medium text-green-700 dark:text-green-400 mb-1">
                              Después:
                            </div>
                            <pre className="overflow-x-auto text-xs">
                              {JSON.stringify(log.newValues, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </details>
                    )}

                    {log.newValues && !log.oldValues && log.action === 'CREATE' && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          Ver datos creados
                        </summary>
                        <div className="mt-2 bg-green-50 dark:bg-green-900/20 p-2 rounded">
                          <pre className="overflow-x-auto text-xs">
                            {JSON.stringify(log.newValues, null, 2)}
                          </pre>
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              ))}

              {logs.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay registros de auditoría</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
