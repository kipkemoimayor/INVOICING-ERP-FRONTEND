import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ErpLayout from '@/layouts/ErpLayout.vue'
import DashboardPage from '@/views/DashboardPage.vue'
import ModulePage from '@/views/ModulePage.vue'
import CustomersPage from '@/views/CustomersPage.vue'
import ProductsPage from '@/views/ProductsPage.vue'
import QuotationsPage from '@/views/QuotationsPage.vue'
import ProformasPage from '@/views/ProformasPage.vue'
import InvoicesPage from '@/views/InvoicesPage.vue'
import DeliveryNotesPage from '@/views/DeliveryNotesPage.vue'
import PaymentsPage from '@/views/PaymentsPage.vue'
import ReportsPage from '@/views/ReportsPage.vue'
import SettingsPage from '@/views/SettingsPage.vue'
import UsersPage from '@/views/UsersPage.vue'
import RolesPage from '@/views/RolesPage.vue'
import LoginPage from '@/views/LoginPage.vue'
import ProfilePage from '@/views/ProfilePage.vue'
import NotFound from '@/views/NotFound.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: ErpLayout,
      children: [
        { path: '', redirect: '/dashboard' },
        { path: 'dashboard', name: 'dashboard', component: DashboardPage, meta: { title: 'Dashboard', permission: 'dashboard.view' } },
        { path: 'customers', name: 'customers', component: CustomersPage, meta: { title: 'Customers', permission: 'customers.view' } },
        { path: 'products', name: 'products', component: ProductsPage, meta: { title: 'Products', permission: 'products.view' } },
        { path: 'quotations', name: 'quotations', component: QuotationsPage, meta: { title: 'Quotations', permission: 'quotations.view' } },
        { path: 'quotation-details', name: 'quotation-details', component: ModulePage, meta: { title: 'Quotation Details' } },
        { path: 'create-quote', name: 'create-quote', component: ModulePage, meta: { title: 'Create Quote' } },
        { path: 'proforma', name: 'proforma', component: ProformasPage, meta: { title: 'Proforma', permission: 'proformas.view' } },
        { path: 'invoices', name: 'invoices', component: InvoicesPage, meta: { title: 'Invoices', permission: 'invoices.view' } },
        { path: 'invoice-details', name: 'invoice-details', component: ModulePage, meta: { title: 'Invoice Details' } },
        { path: 'delivery-notes', name: 'delivery-notes', component: DeliveryNotesPage, meta: { title: 'Delivery Notes', permission: 'delivery_notes.view' } },
        { path: 'payments', name: 'payments', component: PaymentsPage, meta: { title: 'Payments', permission: 'payments.view' } },
        { path: 'reports', name: 'reports', component: ReportsPage, meta: { title: 'Reports', permission: 'reports.view' } },
        { path: 'users', name: 'users', component: UsersPage, meta: { title: 'Users', permission: 'users.view' } },
        { path: 'roles', name: 'roles', component: RolesPage, meta: { title: 'Roles', permission: 'roles.view' } },
        { path: 'settings', name: 'settings', component: SettingsPage, meta: { title: 'Settings', permission: 'settings.view' } },
        { path: 'profile', name: 'profile', component: ProfilePage, meta: { title: 'Profile' } },
      ],
    },
    {
      path: '/login',
      name: 'login',
      component: LoginPage,
      meta: { title: 'Login', public: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFound,
    },
  ],
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  const isPublic = Boolean(to.meta.public)
  const requiredPermission = typeof to.meta.permission === 'string' ? to.meta.permission : ''

  if (isPublic) {
    if (to.path === '/login' && authStore.isAuthenticated) {
      return '/dashboard'
    }
    return true
  }

  if (!authStore.isAuthenticated) {
    return `/login?redirect=${encodeURIComponent(to.fullPath)}`
  }

  if (requiredPermission && !authStore.hasPermission(requiredPermission)) {
    return '/dashboard'
  }

  return true
})

export default router
