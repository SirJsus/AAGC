"use client";

import { Room, Clinic } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Edit, Trash2, Building2 } from "lucide-react";
import { RoomCreateDialog } from "./room-create-dialog";
import { RoomEditDialog } from "./room-edit-dialog";
import { deleteRoom } from "@/lib/actions/rooms";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";

interface RoomWithRelations extends Room {
  clinic?: Clinic | null;
}

interface RoomsTableProps {
  rooms: RoomWithRelations[];
  clinics?: Clinic[];
  canManage?: boolean;
}

export function RoomsTable({
  rooms,
  clinics,
  canManage = true,
}: RoomsTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedClinicId, setSelectedClinicId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<
    "active" | "inactive" | "all"
  >("active");

  const handleRoomUpdated = () => {
    router.refresh();
  };

  const sortedRooms = useMemo(() => {
    if (!rooms) return [];
    // Order: active (true) first, then inactive (false)
    return [...rooms].sort(
      (a, b) => Number(b?.isActive ? 1 : 0) - Number(a?.isActive ? 1 : 0)
    );
  }, [rooms]);

  const isAdminView = Array.isArray(clinics) && clinics.length > 0;

  const handleDeleteRoom = async (roomId: string) => {
    setDeletingId(roomId);
    try {
      await deleteRoom(roomId);
      toast.success("Consultorio eliminado exitosamente");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al eliminar consultorio"
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Consultorios ({rooms?.length || 0})
          </CardTitle>
          {canManage && <RoomCreateDialog onSuccess={handleRoomUpdated} />}
        </div>
      </CardHeader>
      <CardContent>
        {/* Clinic filter for admin, status filter for everyone */}
        <div className="mb-4 flex items-center gap-4">
          {isAdminView && (
            <div className="flex items-center gap-2">
              <label htmlFor="clinic-select" className="text-sm">
                Filtrar por clínica:
              </label>
              <Select
                value={selectedClinicId}
                onValueChange={(v) => setSelectedClinicId(v)}
              >
                <SelectTrigger id="clinic-select">
                  <SelectValue placeholder="Todas las clínicas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las clínicas</SelectItem>
                  {(clinics || []).map((c: Clinic) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label htmlFor="status-select" className="text-sm">
              Estado:
            </label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as any)}
            >
              <SelectTrigger id="status-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
                <SelectItem value="all">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Helper to render a table for a given rooms array */}
        {(() => {
          const renderTable = (roomsToRender: RoomWithRelations[]) => (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Clinic</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && (
                    <TableHead className="text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {roomsToRender.map((room) => (
                  <TableRow key={room?.id}>
                    <TableCell className="font-medium">{room?.name}</TableCell>
                    <TableCell>{room?.clinic?.name || "—"}</TableCell>
                    <TableCell>{room?.location || "—"}</TableCell>
                    <TableCell>{room?.capacity}</TableCell>
                    <TableCell>
                      <Badge variant={room?.isActive ? "default" : "secondary"}>
                        {room?.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <RoomEditDialog
                            room={room}
                            onSuccess={handleRoomUpdated}
                            trigger={
                              <Button variant="ghost" size="sm">
                                <Edit className="h-4 w-4" />
                              </Button>
                            }
                          />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={
                                  deletingId === room?.id ||
                                  room?.isActive === false
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  ¿Eliminar consultorio?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción marcará el consultorio como
                                  inactivo. No se eliminará permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    handleDeleteRoom(room?.id || "")
                                  }
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          );

          const clinicsList: Clinic[] = clinics || [];

          // If admin and showing all clinics, render grouped tables per clinic
          if (clinicsList.length > 0 && selectedClinicId === "all") {
            // For each clinic, find its rooms
            return (
              <div className="space-y-6">
                {clinicsList.map((clinic) => {
                  // Rooms for this clinic, then apply status filter if needed
                  const roomsForClinicRaw = sortedRooms.filter(
                    (r) => r?.clinic?.id === clinic.id
                  );
                  let roomsForClinic = roomsForClinicRaw;
                  if (statusFilter !== "all") {
                    const wantActive = statusFilter === "active";
                    roomsForClinic = roomsForClinicRaw.filter(
                      (r) => Boolean(r?.isActive) === wantActive
                    );
                  }

                  return (
                    <div key={clinic.id}>
                      <h3 className="mb-2 font-semibold">
                        {clinic.name} ({roomsForClinic.length})
                      </h3>
                      {roomsForClinic.length > 0 ? (
                        renderTable(roomsForClinic)
                      ) : (
                        <div className="text-muted-foreground">
                          No rooms for this clinic.
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Rooms without clinic */}
                {(() => {
                  const roomsWithoutClinicRaw = sortedRooms.filter(
                    (r) => !r.clinic
                  );
                  let roomsWithoutClinic = roomsWithoutClinicRaw;
                  if (statusFilter !== "all") {
                    const wantActive = statusFilter === "active";
                    roomsWithoutClinic = roomsWithoutClinicRaw.filter(
                      (r) => Boolean(r?.isActive) === wantActive
                    );
                  }

                  return (
                    roomsWithoutClinic.length > 0 && (
                      <div>
                        <h3 className="mb-2 font-semibold">
                          Sin clínica ({roomsWithoutClinic.length})
                        </h3>
                        {renderTable(roomsWithoutClinic)}
                      </div>
                    )
                  );
                })()}
              </div>
            );
          }

          // Otherwise (non-admin or a specific clinic selected) render a single table filtered
          let filtered =
            selectedClinicId === "all"
              ? sortedRooms
              : sortedRooms.filter((r) => r.clinic?.id === selectedClinicId);

          // Apply status filter: default 'active'
          if (statusFilter !== "all") {
            const wantActive = statusFilter === "active";
            filtered = filtered.filter(
              (r) => Boolean(r?.isActive) === wantActive
            );
          }

          return filtered.length > 0 ? (
            renderTable(filtered)
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No rooms found. Add your first room to get started.
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
