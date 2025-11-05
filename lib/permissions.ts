import { Role } from "@prisma/client";

export interface PermissionCheck {
  role: Role;
  clinicId?: string | null;
}

export class Permissions {
  static canManageClinics(user: PermissionCheck): boolean {
    return user.role === Role.ADMIN;
  }

  static canManageUsers(user: PermissionCheck): boolean {
    return user.role === Role.ADMIN || user.role === Role.CLINIC_ADMIN;
  }

  static canCreateUser(user: PermissionCheck, targetRole: Role): boolean {
    if (user.role === Role.ADMIN) return true;
    if (user.role === Role.CLINIC_ADMIN && targetRole !== Role.ADMIN)
      return true;
    return false;
  }

  static canManageRooms(user: PermissionCheck): boolean {
    return (
      user.role === Role.ADMIN ||
      user.role === Role.CLINIC_ADMIN ||
      user.role === Role.RECEPTION
    );
  }

  static canViewRooms(user: PermissionCheck): boolean {
    return (
      user.role === Role.ADMIN ||
      user.role === Role.CLINIC_ADMIN ||
      user.role === Role.RECEPTION
    );
  }

  static canManageDoctors(user: PermissionCheck): boolean {
    return user.role === Role.ADMIN || user.role === Role.CLINIC_ADMIN;
  }

  static canViewDoctors(user: PermissionCheck): boolean {
    return (
      user.role === Role.ADMIN ||
      user.role === Role.CLINIC_ADMIN ||
      user.role === Role.DOCTOR ||
      user.role === Role.RECEPTION
    );
  }

  static canViewAppointmentTypes(user: PermissionCheck): boolean {
    return (
      user.role === Role.ADMIN ||
      user.role === Role.CLINIC_ADMIN ||
      user.role === Role.RECEPTION
    );
  }

  static canManagePatients(user: PermissionCheck): boolean {
    return (
      user.role === Role.ADMIN ||
      user.role === Role.CLINIC_ADMIN ||
      user.role === Role.RECEPTION ||
      user.role === Role.NURSE
    );
  }

  static canViewPatients(user: PermissionCheck): boolean {
    return (
      user.role === Role.ADMIN ||
      user.role === Role.CLINIC_ADMIN ||
      user.role === Role.RECEPTION ||
      user.role === Role.DOCTOR
    );
  }

  static canEditPatients(user: PermissionCheck): boolean {
    return (
      user.role === Role.ADMIN ||
      user.role === Role.CLINIC_ADMIN ||
      user.role === Role.RECEPTION ||
      user.role === Role.NURSE
    );
  }

  static canManageAppointments(user: PermissionCheck): boolean {
    return (
      user.role === Role.ADMIN ||
      user.role === Role.CLINIC_ADMIN ||
      user.role === Role.RECEPTION ||
      user.role === Role.DOCTOR
    );
  }

  static canCreateAppointments(user: PermissionCheck): boolean {
    return (
      user.role === Role.ADMIN ||
      user.role === Role.CLINIC_ADMIN ||
      user.role === Role.RECEPTION
    );
  }

  static canViewAppointments(user: PermissionCheck): boolean {
    return (
      user.role === Role.ADMIN ||
      user.role === Role.CLINIC_ADMIN ||
      user.role === Role.RECEPTION ||
      user.role === Role.NURSE ||
      user.role === Role.DOCTOR
    );
  }

  static canManageAppointmentTypes(user: PermissionCheck): boolean {
    return (
      user.role === Role.ADMIN ||
      user.role === Role.CLINIC_ADMIN ||
      user.role === Role.RECEPTION
    );
  }

  static canViewDashboard(user: PermissionCheck): boolean {
    return (
      user.role === Role.ADMIN ||
      user.role === Role.CLINIC_ADMIN ||
      user.role === Role.RECEPTION ||
      user.role === Role.DOCTOR
    );
  }

  static requiresClinicScope(role: Role): boolean {
    return role !== Role.ADMIN;
  }

  static canAccessClinic(
    user: PermissionCheck,
    targetClinicId: string
  ): boolean {
    if (user.role === Role.ADMIN) return true;
    return user.clinicId === targetClinicId;
  }
}
