/**
 * Корневой компонент приложения SNAB.
 *
 * Содержит:
 * - верхнюю навигацию (AppBar),
 * - маршрутизацию (react-router) по основным разделам системы,
 * - дефолтный редирект с "/" на "/dashboard".
 *
 * Важно: здесь подключается `csrf_interceptor`, чтобы все запросы axios
 * автоматически подхватывали CSRF-cookie и корректно повторялись при 403 CSRF.
 */
import React from 'react';
import './api/csrf_interceptor';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Container, Box } from '@mui/material';

import DebugApiPage from './pages/DebugApiPage';

import DashboardPage from './pages/DashboardPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import PurchaseRequestsPage from './pages/PurchaseRequestsPage';
import PurchaseRequestCreatePage from './pages/PurchaseRequestCreatePage';
import PurchaseRequestEditPage from './pages/PurchaseRequestEditPage';
import PriceImportPage from './pages/PriceImportPage';
import SuppliersPage from './pages/SuppliersPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectCardPage from './pages/ProjectCardPage';
import CatalogHomePage from './pages/catalog/CatalogHomePage';

import ItemsListPage from './pages/catalog/ItemsListPage';
import CategoriesTreePage from './pages/catalog/CategoriesTreePage';
import CategoriesManagePage from './pages/catalog/CategoriesManagePage';

// --- Точечные добавления для поставщиков ---
import SupplierCreatePage from './pages/SupplierCreatePage';
import SupplierEditPage from './pages/SupplierEditPage';

export default function App() {
  return (
    <BrowserRouter>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>ДруВлАн::СНАБ</Typography>
          <Button color="inherit" component={Link} to="/dashboard">Дашборд</Button>
          <Button color="inherit" component={Link} to="/pr">Заявки</Button>
          <Button color="inherit" component={Link} to="/po">Заказы</Button>
          <Button color="inherit" component={Link} to="/catalog/items">Номенклатура</Button>
          <Button color="inherit" component={Link} to="/suppliers">Поставщики</Button>
          <Button color="inherit" component={Link} to="/projects">Проекты</Button>
          <Button color="inherit" component={Link} to="/catalog">Справочники</Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
        <Routes>
          <Route path="/debug/api" element={<DebugApiPage />} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Заявки */}
          <Route path="/pr" element={<PurchaseRequestsPage />} />
          <Route path="/pr/new" element={<PurchaseRequestCreatePage />} />
          <Route path="/pr/:id/edit" element={<PurchaseRequestEditPage />} />
          <Route path="/prices/import" element={<PriceImportPage />} />

          {/* Заказы */}
          <Route path="/po" element={<PurchaseOrdersPage />} />

          {/* Справочники */}
          <Route path="/catalog" element={<CatalogHomePage />} />
          <Route path="/catalog/items" element={<ItemsListPage />} />
          <Route path="/catalog/categories" element={<CategoriesTreePage />} />
          <Route path="/catalog/categories/manage" element={<CategoriesManagePage />} />

          {/* Проекты */}
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectCardPage />} />

          {/* Поставщики */}
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/suppliers/new" element={<SupplierCreatePage />} />
          <Route path="/suppliers/:id/edit" element={<SupplierEditPage />} />

          <Route path="*" element={<Box>Страница не найдена</Box>} />
        </Routes>
      </Container>
    </BrowserRouter>
  );
}
