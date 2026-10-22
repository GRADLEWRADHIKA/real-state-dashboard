import { BadgeIndianRupee, BarChart3, IdCard, ReceiptIndianRupee, Building2, CalendarCheck2, FileText, Handshake, LayoutDashboard, ListChecks, PhoneCall, Receipt, Settings, SquareKanban, UserCog, UserRound, Users, Wallet, CalendarClock, Inbox, ScrollText, type LucideIcon } from 'lucide-react';
import type { Role } from '@/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  end?: boolean;
}

const ALL: Role[] = ['admin', 'manager', 'sales', 'accounts'];
const SALES: Role[] = ['admin', 'manager', 'sales'];
const FIN: Role[] = ['admin', 'accounts'];
const OFFICE: Role[] = ['admin', 'manager', 'accounts'];

export const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      {
        to: '/',
        label: 'Dashboard',
        icon: LayoutDashboard,
        roles: SALES,
        end: true,
      },
      {
        to: '/finance',
        label: 'Finance overview',
        icon: Wallet,
        roles: ['accounts'],
        end: true,
      },
    ],
  },
  {
    title: 'Sales',
    items: [
      { to: '/leads', label: 'Leads', icon: Users, roles: SALES },
      { to: '/pipeline', label: 'Pipeline', icon: SquareKanban, roles: SALES },
      {
        to: '/site-visits',
        label: 'Site visits',
        icon: CalendarCheck2,
        roles: SALES,
      },
      { to: '/followups', label: 'Follow-ups', icon: PhoneCall, roles: SALES },
      { to: '/customers', label: 'Customers', icon: UserRound, roles: ALL },
      { to: '/deals', label: 'Deals', icon: Handshake, roles: SALES },
      { to: '/brokers', label: 'Brokers', icon: BadgeIndianRupee, roles: OFFICE },
      { to: '/requests', label: 'Customer requests', icon: Inbox, roles: ALL },
    ],
  },
  {
    title: 'Inventory',
    items: [{ to: '/properties', label: 'Properties', icon: Building2, roles: ALL }],
  },
  {
    title: 'Finance',
    items: [
      {
        to: '/finance',
        label: 'Finance',
        icon: Wallet,
        roles: ['admin'],
        end: true,
      },
      {
        to: '/finance/transactions',
        label: 'Transactions',
        icon: Receipt,
        roles: FIN,
      },
      {
        to: '/finance/installments',
        label: 'Installments',
        icon: CalendarClock,
        roles: FIN,
      },
      { to: '/expenses', label: 'Expenses', icon: ReceiptIndianRupee, roles: FIN },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { to: '/tasks', label: 'Tasks', icon: ListChecks, roles: ALL },
      { to: '/documents', label: 'Documents', icon: FileText, roles: ALL },
      {
        to: '/reports',
        label: 'Reports',
        icon: BarChart3,
        roles: ['admin', 'manager', 'accounts'],
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/staff', label: 'Staff', icon: IdCard, roles: OFFICE },
      { to: '/users', label: 'Users & roles', icon: UserCog, roles: ['admin'] },
      {
        to: '/users?tab=resets',
        label: 'Password resets',
        icon: UserCog,
        roles: ['manager'],
      },
      { to: '/audit', label: 'Audit log', icon: ScrollText, roles: ['admin'] },
      { to: '/settings', label: 'Settings', icon: Settings, roles: ALL },
    ],
  },
];

export const navFor = (role: Role) =>
  NAV.map((s) => ({
    ...s,
    items: s.items.filter((i) => i.roles.includes(role)),
  })).filter((s) => s.items.length > 0);

/** Four primary destinations for the phone bottom bar (the fifth slot is “More”). */
export const BOTTOM_NAV: Record<Exclude<Role, 'customer'>, NavItem[]> = {
  admin: [
    { to: '/', label: 'Home', icon: LayoutDashboard, roles: ALL, end: true },
    { to: '/leads', label: 'Leads', icon: Users, roles: ALL },
    { to: '/pipeline', label: 'Pipeline', icon: SquareKanban, roles: ALL },
    { to: '/finance', label: 'Finance', icon: Wallet, roles: ALL },
  ],
  manager: [
    { to: '/', label: 'Home', icon: LayoutDashboard, roles: ALL, end: true },
    { to: '/leads', label: 'Leads', icon: Users, roles: ALL },
    { to: '/pipeline', label: 'Pipeline', icon: SquareKanban, roles: ALL },
    { to: '/site-visits', label: 'Visits', icon: CalendarCheck2, roles: ALL },
  ],
  sales: [
    { to: '/', label: 'Home', icon: LayoutDashboard, roles: ALL, end: true },
    { to: '/leads', label: 'Leads', icon: Users, roles: ALL },
    { to: '/followups', label: 'Follow-ups', icon: PhoneCall, roles: ALL },
    { to: '/site-visits', label: 'Visits', icon: CalendarCheck2, roles: ALL },
  ],
  accounts: [
    { to: '/finance', label: 'Finance', icon: Wallet, roles: ALL, end: true },
    {
      to: '/finance/installments',
      label: 'Dues',
      icon: CalendarClock,
      roles: ALL,
    },
    {
      to: '/finance/transactions',
      label: 'Payments',
      icon: Receipt,
      roles: ALL,
    },
    { to: '/customers', label: 'Customers', icon: UserRound, roles: ALL },
  ],
};
