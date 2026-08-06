export type NavItem = {
  label: string
  to: string
  permission?: string
}

export const primaryNavigation: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', permission: 'dashboard.view' },
  { label: 'Customers', to: '/customers', permission: 'customers.view' },
  { label: 'Products', to: '/products', permission: 'products.view' },
  { label: 'Quotations', to: '/quotations', permission: 'quotations.view' },
  { label: 'Proforma', to: '/proforma', permission: 'proformas.view' },
  { label: 'Invoices', to: '/invoices', permission: 'invoices.view' },
  { label: 'Delivery Notes', to: '/delivery-notes', permission: 'delivery_notes.view' },
  { label: 'Payments', to: '/payments', permission: 'payments.view' },
  { label: 'Reports', to: '/reports', permission: 'reports.view' },
  { label: 'Users', to: '/users', permission: 'users.view' },
  { label: 'Roles', to: '/roles', permission: 'roles.view' },
  { label: 'Settings', to: '/settings', permission: 'settings.view' },
  { label: 'Profile', to: '/profile' },
]
