// app/(main)/admin/(protected)/dashboard/page.tsx
import Link from "next/link";
import {
  Building2,
  Truck,
  GraduationCap,
  Image as ImageIcon,
  CalendarDays,
  Users,
  ShieldCheck,
} from "lucide-react";

// One entry per real folder under app/(main)/admin/. Add a new entry
// here whenever a new admin section folder is created — this list is
// intentionally explicit (not auto-generated from the filesystem) so a
// half-built folder doesn't show up on the dashboard before it's ready.
const SECTIONS = [
  {
    href: "/admin/cargo",
    label: "Cargo",
    description: "Bookings, statuses, invoices",
    icon: Truck,
  },
  {
    href: "/admin/businesses_verify",
    label: "Businesses Verify",
    description: "Review pending business listings",
    icon: Building2,
  },
  {
    href: "/admin/edufest",
    label: "Edufest",
    description: "Edufest event administration",
    icon: GraduationCap,
  },
  {
    href: "/admin/event_banners",
    label: "Event Banners",
    description: "Manage promotional banners",
    icon: ImageIcon,
  },
  {
    href: "/admin/events_list",
    label: "Events List",
    description: "All scheduled events",
    icon: CalendarDays,
  },
  {
    href: "/admin/team",
    label: "Team",
    description: "Approve and manage admin accounts",
    icon: Users,
  },
  {
    href: "/admin/staff",
    label: "Staff & Roles",
    description: "Manage staff accounts and role permissions",
    icon: ShieldCheck,
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-lg font-medium text-neutral-900">Dashboard</h1>
      <p className="mb-6 text-sm text-neutral-500">Jump to any admin section.</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-lg border border-neutral-200 bg-white p-5 transition hover:border-emerald-300 hover:shadow-sm"
          >
            <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100">
              <Icon className="h-4.5 w-4.5" />
            </div>
            <div className="text-sm font-medium text-neutral-900">{label}</div>
            <div className="mt-0.5 text-xs text-neutral-500">{description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}