"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Calendar,
  Users,
  Building2,
  Stethoscope,
  UserPlus,
  ClipboardList,
  Settings,
  LogOut,
  User,
  Home,
  FileText,
  Upload,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Permissions } from "@/lib/permissions";
import { cn } from "@/lib/utils";

interface NavigationProps {
  className?: string;
}

export function Navigation({ className }: NavigationProps) {
  const { data: session } = useSession() || {};
  const pathname = usePathname();

  if (!session?.user) {
    return null;
  }

  const user = session.user;

  const navigationItems = [
    {
      href: "/dashboard",
      icon: Home,
      label: "Dashboard",
      show: Permissions.canViewDashboard(user),
    },
    {
      href: "/appointments",
      icon: Calendar,
      label: "Appointments",
      show: Permissions.canViewAppointments(user),
    },
    {
      href: "/patients",
      icon: UserPlus,
      label: "Patients",
      show: Permissions.canViewPatients(user),
    },
    {
      href: "/doctors",
      icon: Stethoscope,
      label: "Doctors",
      show: Permissions.canViewDoctors(user),
    },
    {
      href: "/doctor-schedules",
      icon: Calendar,
      label: "Doctor Schedules",
      show: Permissions.canViewDoctors(user),
    },
    {
      href: "/rooms",
      icon: Building2,
      label: "Rooms",
      show: Permissions.canManageRooms(user),
    },
    {
      href: "/appointment-types",
      icon: ClipboardList,
      label: "Appointment Types",
      show: Permissions.canManageAppointmentTypes(user),
    },
    {
      href: "/users",
      icon: Users,
      label: "Users",
      show: Permissions.canManageUsers(user),
    },
    {
      href: "/clinics",
      icon: Settings,
      label: "Clinics",
      show: Permissions.canManageClinics(user),
    },
    {
      href: "/reports",
      icon: BarChart3,
      label: "Reports",
      show: Permissions.canViewReports(user),
    },
    {
      href: "/my-reports",
      icon: BarChart3,
      label: "My Reports",
      show: Permissions.canViewOwnReports(user),
    },
    {
      href: "/import",
      icon: Upload,
      label: "Import Data",
      show: user.role === "ADMIN" || user.role === "CLINIC_ADMIN",
    },
    {
      href: "/audit-logs",
      icon: FileText,
      label: "Audit Logs",
      show: user.role === "ADMIN" || user.role === "CLINIC_ADMIN",
    },
  ];

  return (
    <nav className={cn("flex flex-col space-y-2", className)}>
      {navigationItems
        .filter((item) => item.show)
        .map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}

      <hr className="my-4" />

      <Link
        href="/me"
        className={cn(
          "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
          pathname === "/me"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground"
        )}
      >
        <User className="h-4 w-4" />
        <span>Profile</span>
      </Link>

      <Button
        variant="ghost"
        className="justify-start px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        <LogOut className="mr-3 h-4 w-4" />
        Sign out
      </Button>
    </nav>
  );
}
