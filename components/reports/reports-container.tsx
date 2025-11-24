"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportsFilters } from "./reports-filters";
import { ReportsCharts } from "./reports-charts";
import { ReportsSummary } from "./reports-summary";
import { ReportsTable } from "./reports-table";
import { Loader2 } from "lucide-react";

interface User {
  id: string;
  role: string;
  clinicId?: string | null;
}

interface ReportsContainerProps {
  user: User;
}

export interface ReportFilters {
  period: "day" | "week" | "month" | "year" | "custom";
  doctorId: string;
  appointmentTypeId: string;
  clinicId?: string;
  startDate?: string;
  endDate?: string;
}

export interface ReportData {
  period: string;
  dateRange: {
    from: string;
    to: string;
  };
  summary: {
    totalAppointments: number;
    totalRevenue: number;
    projectedRevenue: number;
    cancellationRate: string;
    appointmentChange: string;
  };
  appointmentsByStatus: Record<string, number>;
  appointmentsByDoctor: Record<string, any>;
  appointmentsByType: Record<string, any>;
  appointmentsByWeekday: Record<string, number>;
  appointmentsByHour: Record<string, number>;
  revenueByPaymentMethod: Record<string, number>;
}

export function ReportsContainer({ user }: ReportsContainerProps) {
  const [filters, setFilters] = useState<ReportFilters>({
    period: "month",
    doctorId: "all",
    appointmentTypeId: "all",
  });
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReportData();
  }, [filters]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("period", filters.period);
      if (filters.doctorId) params.append("doctorId", filters.doctorId);
      if (filters.appointmentTypeId)
        params.append("appointmentTypeId", filters.appointmentTypeId);
      if (filters.clinicId) params.append("clinicId", filters.clinicId);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);

      const response = await fetch(`/api/reports?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Error al cargar los reportes");
      }
      const data = await response.json();
      setReportData(data);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <ReportsFilters
        filters={filters}
        onFiltersChange={setFilters}
        clinicId={user.clinicId}
        userRole={user.role}
      />

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : reportData ? (
        <>
          <ReportsSummary data={reportData} />
          <ReportsCharts data={reportData} />
          <ReportsTable data={reportData} />
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay datos disponibles para el período seleccionado
          </CardContent>
        </Card>
      )}
    </div>
  );
}
