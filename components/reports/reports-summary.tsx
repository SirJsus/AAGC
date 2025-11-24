"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  AlertCircle,
  Activity,
} from "lucide-react";
import type { ReportData } from "./reports-container";

interface ReportsSummaryProps {
  data: ReportData;
}

export function ReportsSummary({ data }: ReportsSummaryProps) {
  const { summary } = data;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const appointmentChange = parseFloat(summary.appointmentChange);
  const isPositiveChange = appointmentChange >= 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total de Citas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Citas</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalAppointments}</div>
          <p className="text-xs text-muted-foreground flex items-center mt-1">
            {isPositiveChange ? (
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
            ) : (
              <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
            )}
            <span
              className={isPositiveChange ? "text-green-500" : "text-red-500"}
            >
              {Math.abs(appointmentChange).toFixed(1)}%
            </span>
            <span className="ml-1">vs período anterior</span>
          </p>
        </CardContent>
      </Card>

      {/* Ingresos Confirmados */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Ingresos Confirmados
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(summary.totalRevenue)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Citas completadas y pagadas
          </p>
        </CardContent>
      </Card>

      {/* Ingresos Proyectados */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Ingresos Proyectados
          </CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(summary.projectedRevenue)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Citas pendientes y confirmadas
          </p>
        </CardContent>
      </Card>

      {/* Tasa de Cancelación */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Tasa de Cancelación
          </CardTitle>
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.cancellationRate}%</div>
          <p className="text-xs text-muted-foreground mt-1">
            Cancelaciones + No-show
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
