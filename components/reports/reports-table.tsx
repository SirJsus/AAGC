"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReportData } from "./reports-container";

interface ReportsTableProps {
  data: ReportData;
}

export function ReportsTable({ data }: ReportsTableProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const doctorRows = Object.entries(data.appointmentsByDoctor).map(
    ([name, stats]) => ({
      name,
      total: stats.count,
      completadas: stats.completed,
      canceladas: stats.cancelled,
      noShow: stats.noShow,
      ingresos: stats.revenue,
      tasa_completadas:
        stats.count > 0
          ? ((stats.completed / stats.count) * 100).toFixed(1)
          : "0",
    })
  );

  const typeRows = Object.entries(data.appointmentsByType).map(
    ([name, stats]) => ({
      name,
      citas: stats.count,
      ingresos: stats.revenue,
      promedio: stats.count > 0 ? stats.revenue / stats.count : 0,
    })
  );

  return (
    <div className="space-y-4">
      {/* Tabla de Doctores */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle por Doctor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doctor</TableHead>
                  <TableHead className="text-right">Total Citas</TableHead>
                  <TableHead className="text-right">Completadas</TableHead>
                  <TableHead className="text-right">Canceladas</TableHead>
                  <TableHead className="text-right">No Asistió</TableHead>
                  <TableHead className="text-right">Tasa Éxito</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doctorRows.length > 0 ? (
                  doctorRows.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right">{row.total}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {row.completadas}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {row.canceladas}
                      </TableCell>
                      <TableCell className="text-right text-red-700">
                        {row.noShow}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.tasa_completadas}%
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(row.ingresos)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground"
                    >
                      No hay datos disponibles
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Tipos de Cita */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle por Tipo de Cita</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo de Cita</TableHead>
                  <TableHead className="text-right">Total Citas</TableHead>
                  <TableHead className="text-right">Ingresos Totales</TableHead>
                  <TableHead className="text-right">Ingreso Promedio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {typeRows.length > 0 ? (
                  typeRows.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right">{row.citas}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(row.ingresos)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.promedio)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      No hay datos disponibles
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
