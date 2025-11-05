"use client";

import { useState } from "react";
import { Clinic } from "@prisma/client";
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
import { Plus, Edit, Trash2, Building2, Clock } from "lucide-react";
import { ClinicCreateDialog } from "@/components/clinics/clinic-create-dialog";
import ClinicEditDialog from "@/components/clinics/clinic-edit-dialog";
import { ClinicSchedulesManager } from "@/components/clinics/clinic-schedules-manager";

interface ClinicsTableProps {
  clinics: Clinic[];
}

export function ClinicsTable({ clinics }: ClinicsTableProps) {
  const handleDeleteClinic = (clinicId: string) => {
    alert(
      "Delete clinic functionality will be implemented in the next iteration"
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Clinics ({clinics?.length || 0})
          </CardTitle>
          <ClinicCreateDialog
            onSuccess={() => {
              // simple feedback; page should revalidate via server action
              // you can extend to refresh list if needed
            }}
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Clinic
              </Button>
            }
          />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Timezone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clinics?.map((clinic) => (
              <TableRow key={clinic?.id}>
                <TableCell className="font-medium">{clinic?.name}</TableCell>
                <TableCell>{clinic?.address || "—"}</TableCell>
                <TableCell>{clinic?.phone || "—"}</TableCell>
                <TableCell>{clinic?.timezone}</TableCell>
                <TableCell>
                  <Badge variant={clinic?.isActive ? "default" : "secondary"}>
                    {clinic?.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <ClinicSchedulesManager
                      clinic={clinic}
                      trigger={
                        <Button variant="outline" size="sm">
                          <Clock className="h-4 w-4" />
                        </Button>
                      }
                      onSuccess={() => {
                        // page should revalidate if needed
                      }}
                    />
                    <ClinicEditDialog
                      clinic={clinic}
                      trigger={
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      }
                      onSuccess={() => {
                        // page should revalidate server-side; add client-side handling if needed
                      }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {(!clinics || clinics.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            No clinics found. Create your first clinic to get started.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
