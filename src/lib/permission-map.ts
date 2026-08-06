const mapModule = (path: string): string | null => {
  const [module] = path.split('/')
  switch (module) {
    case 'dashboard':
      return 'dashboard'
    case 'customers':
      return 'customers'
    case 'products':
      return 'products'
    case 'quotations':
      return 'quotations'
    case 'proforma':
    case 'proformas':
      return 'proformas'
    case 'invoices':
      return 'invoices'
    case 'delivery-notes':
      return 'delivery_notes'
    case 'payments':
      return 'payments'
    case 'reports':
      return 'reports'
    case 'users':
      return 'users'
    case 'roles':
      return 'roles'
    case 'settings':
      return 'settings'
    case 'audit-logs':
      return 'audit_logs'
    default:
      return null
  }
}

export const getPermissionForApiAction = (path: string, method: string): string | null => {
  const cleanedPath = path.replace(/^\/+/, '').replace(/^api\/+/, '').toLowerCase()
  const httpMethod = method.toUpperCase()
  if (!cleanedPath || cleanedPath.startsWith('auth/')) return null

  if (cleanedPath.startsWith('payments/statement')) return 'payments.statement'
  if (cleanedPath.startsWith('payments/export')) return 'payments.export'
  if (cleanedPath.startsWith('reports/') && cleanedPath.includes('/export')) return 'reports.export'
  if (cleanedPath.startsWith('settings/')) return httpMethod === 'GET' ? 'settings.view' : 'settings.update'
  if (cleanedPath.includes('/resend-email') || cleanedPath.includes('/send-email')) return 'quotations.send'
  if (cleanedPath.includes('/convert-to-')) {
    if (cleanedPath.startsWith('quotations/')) return 'quotations.convert'
    if (cleanedPath.startsWith('proformas/')) return 'proformas.update'
  }
  if (cleanedPath.startsWith('invoices/') && cleanedPath.includes('/status')) return 'invoices.approve'
  if (cleanedPath.startsWith('proformas/') && cleanedPath.includes('/status')) return 'proformas.approve'
  if (cleanedPath.startsWith('invoices/') && cleanedPath.includes('/payments')) return 'payments.create'

  const moduleCode = mapModule(cleanedPath)
  if (!moduleCode) return null

  if (httpMethod === 'GET') return `${moduleCode}.view`
  if (httpMethod === 'POST') return `${moduleCode}.create`
  if (httpMethod === 'PATCH' || httpMethod === 'PUT') return `${moduleCode}.update`
  if (httpMethod === 'DELETE') return `${moduleCode}.delete`
  return null
}
