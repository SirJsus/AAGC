"use client";

import { Doctor, Clinic, User, Room, DoctorSchedule } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Stethoscope, Calendar } from "lucide-react";

interface DoctorWithRelations extends Doctor {
  clinic?: Clinic | null;
  user?: User | null;
  defaultRoom?: Room | null;
  schedules?: DoctorSchedule[];
}

interface DoctorsTableProps {
  doctors: DoctorWithRelations[];
  canManage?: boolean;
}

export function DoctorsTable({ doctors, canManage = true }: DoctorsTableProps) {
  const getScheduleSummary = (schedules?: DoctorSchedule[]) => {
    if (!schedules || schedules.length === 0) {
      return "No schedule";
    }

    const activeDays = schedules.filter((s) => s.isActive).length;
    return `${activeDays} day(s) scheduled`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            Doctors ({doctors?.length || 0})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>License</TableHead>
              <TableHead>Specialty</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Status</TableHead>
              {canManage && (
                <TableHead className="text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {doctors?.map((doctor) => (
              <TableRow key={doctor?.id}>
                <TableCell className="font-medium">
                  Dr. {doctor?.user?.firstName} {doctor?.user?.lastName}
                </TableCell>
                <TableCell>{doctor?.user?.licenseNumber}</TableCell>
                <TableCell>{doctor?.user?.specialty || "—"}</TableCell>
                <TableCell>{doctor?.user?.phone || "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {getScheduleSummary(doctor?.schedules)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={doctor?.isActive ? "default" : "secondary"}>
                    {doctor?.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Botones de acción si es necesario implementar */}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {(!doctors || doctors.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            No doctors found. Add your first doctor to get started.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
