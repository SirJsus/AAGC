"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import type { ReportData } from "./reports-container";

interface ReportsChartsProps {
  data: ReportData;
}

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884D8",
  "#82CA9D",
  "#FFC658",
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#FFA500",
  CONFIRMED: "#00C49F",
  IN_CONSULTATION: "#0088FE",
  COMPLETED: "#22C55E",
  PAID: "#10B981",
  CANCELLED: "#EF4444",
  NO_SHOW: "#DC2626",
  TRANSFER_PENDING: "#FFBB28",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  IN_CONSULTATION: "En Consulta",
  COMPLETED: "Completada",
  PAID: "Pagada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No Asistió",
  TRANSFER_PENDING: "Pago Pendiente",
  REQUIRES_RESCHEDULE: "Requiere Reagendar",
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  DEBIT_CARD: "Tarjeta Débito",
  CREDIT_CARD: "Tarjeta Crédito",
  TRANSFER: "Transferencia",
};

export function ReportsCharts({ data }: ReportsChartsProps) {
  // Preparar datos para gráficas
  const statusData = Object.entries(data.appointmentsByStatus).map(
    ([status, count]) => ({
      name: STATUS_LABELS[status] || status,
      value: count,
      color: STATUS_COLORS[status] || COLORS[0],
    })
  );

  const doctorData = Object.entries(data.appointmentsByDoctor).map(
    ([name, stats]) => ({
      name: name.length > 20 ? name.substring(0, 20) + "..." : name,
      total: stats.count,
      completadas: stats.completed,
      canceladas: stats.cancelled,
      noShow: stats.noShow,
      ingresos: stats.revenue,
    })
  );

  const typeData = Object.entries(data.appointmentsByType).map(
    ([name, stats]) => ({
      name: name.length > 15 ? name.substring(0, 15) + "..." : name,
      citas: stats.count,
      ingresos: stats.revenue,
    })
  );

  const weekdayData = Object.entries(data.appointmentsByWeekday).map(
    ([day, count]) => ({
      name: day,
      citas: count,
    })
  );

  const hourData = Object.entries(data.appointmentsByHour)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([hour, count]) => ({
      name: hour,
      citas: count,
    }));

  const paymentData = Object.entries(data.revenueByPaymentMethod).map(
    ([method, amount]) => ({
      name: PAYMENT_LABELS[method] || method,
      value: amount,
    })
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
        <TabsTrigger value="overview">Resumen</TabsTrigger>
        <TabsTrigger value="doctors">Por Doctor</TabsTrigger>
        <TabsTrigger value="distribution">Distribución</TabsTrigger>
        <TabsTrigger value="revenue">Ingresos</TabsTrigger>
      </TabsList>

      {/* Tab: Resumen General */}
      <TabsContent value="overview" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Citas por Estado */}
          <Card>
            <CardHeader>
              <CardTitle>Citas por Estado</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Citas por Tipo */}
          <Card>
            <CardHeader>
              <CardTitle>Citas por Tipo</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={typeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="citas" fill="#0088FE" name="Citas" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Tab: Por Doctor */}
      <TabsContent value="doctors" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Rendimiento por Doctor</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={doctorData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="completadas" fill="#22C55E" name="Completadas" />
                <Bar dataKey="canceladas" fill="#EF4444" name="Canceladas" />
                <Bar dataKey="noShow" fill="#DC2626" name="No Asistió" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ingresos por Doctor</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={doctorData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={formatCurrency} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="ingresos" fill="#10B981" name="Ingresos (MXN)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab: Distribución */}
      <TabsContent value="distribution" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Citas por Día de la Semana */}
          <Card>
            <CardHeader>
              <CardTitle>Citas por Día de la Semana</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weekdayData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="citas" fill="#00C49F" name="Citas" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Citas por Hora del Día */}
          <Card>
            <CardHeader>
              <CardTitle>Citas por Hora del Día</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={hourData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="citas"
                    stroke="#8884D8"
                    strokeWidth={2}
                    name="Citas"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Tab: Ingresos */}
      <TabsContent value="revenue" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Ingresos por Método de Pago */}
          {paymentData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ingresos por Método de Pago</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={paymentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) =>
                        `${name}: ${formatCurrency(value)}`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {paymentData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Ingresos por Tipo de Cita */}
          <Card>
            <CardHeader>
              <CardTitle>Ingresos por Tipo de Cita</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={typeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                  />
                  <Bar
                    dataKey="ingresos"
                    fill="#FFBB28"
                    name="Ingresos (MXN)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}
