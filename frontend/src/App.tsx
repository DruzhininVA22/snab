/**
 * SNAB - главное приложение.
 * 
 * Маршруты и навигация для полного цикла закупок:
 * PR (Заявки) → RFQ (Заявки поставщикам) → Quotes (КП) → PO (Заказы) → Shipments (Доставки)
 * 
 * + Справочники: Проекты, Шаблоны, Номенклатура, Категории, Поставщики, Прайс-листы
 */
import React, { useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
} from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import './api/csrf_interceptor';;

// Основные страницы
import DashboardPage from './pages/DashboardPage';
import PurchaseRequestsPage from './pages/PurchaseRequestsPage';
import PurchaseRequestCreatePage from './pages/PurchaseRequestCreatePage';
import PurchaseRequestEditPage from './pages/PurchaseRequestEditPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';

// КП и Доставки
import QuotationsPage from './pages/QuotationsPage';
import ShipmentsPage from './pages/ShipmentsPage';

// Справочники (Reference)
import ProjectsPage from './pages/reference/ProjectsPage';
import ProjectCardPage from './pages/reference/ProjectCardPage';
import StageTemplatesPage from './pages/reference/StageTemplatesPage';
import NomenclaturePage from './pages/reference/NomenclaturePage';
import CategoriesPage from './pages/reference/CategoriesPage';
import SuppliersPage from './pages/reference/SuppliersPage';
import SupplierCreatePage from './pages/reference/SupplierCreatePage';
import SupplierEditPage from './pages/reference/SupplierEditPage';
import PriceImportPage from './pages/reference/PriceImportPage';
import SupplierPriceListsPage from './pages/reference/SupplierPriceListsPage';

// Инициализация CSRF
// setupCsrfInterceptor();

/**
 * Меню "Справочники" с подпунктами
 */
function ReferenceMenu() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Button
        color="inherit"
        onClick={handleClick}
        endIcon={<ExpandMoreIcon />}
      >
        Справочники
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: { minWidth: 240 },
        }}
      >
        {/* Блок 1: Проекты и Шаблоны */}
        <MenuItem
          component={Link}
          to="/reference/projects"
          onClick={handleClose}
        >
          Проекты
        </MenuItem>
        <MenuItem
          component={Link}
          to="/reference/stage-templates"
          onClick={handleClose}
        >
          Шаблоны этапов
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        {/* Блок 2: Номенклатура и Категории */}
        <MenuItem
          component={Link}
          to="/reference/nomenclature"
          onClick={handleClose}
        >
          Номенклатура
        </MenuItem>
        <MenuItem
          component={Link}
          to="/reference/categories"
          onClick={handleClose}
        >
          Категории
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        {/* Блок 3: Поставщики и Прайс-листы */}
        <MenuItem
          component={Link}
          to="/reference/suppliers"
          onClick={handleClose}
        >
          Поставщики
        </MenuItem>
        <MenuItem
          component={Link}
          to="/reference/supplier-pricelists"
          onClick={handleClose}
        >
          Прайс-листы поставщиков
        </MenuItem>
      </Menu>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            SNAB
          </Typography>

          {/* Основное меню закупок */}
          <Button color="inherit" component={Link} to="/dashboard">
            Дашборд
          </Button>
          <Button color="inherit" component={Link} to="/pr">
            Заявки
          </Button>
          <Button color="inherit" component={Link} to="/quotes">
            КП
          </Button>
          <Button color="inherit" component={Link} to="/po">
            Заказы
          </Button>
          <Button color="inherit" component={Link} to="/shipments">
            Доставки
          </Button>

          {/* Справочники (выпадающее меню) */}
          <ReferenceMenu />
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
        <Routes>
          {/* Корневой путь */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* ===== ОСНОВНОЙ ЦИКЛ ЗАКУПОК ===== */}

          {/* 1. Дашборд */}
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* 2. Заявки (Purchase Requests) */}
          <Route path="/pr" element={<PurchaseRequestsPage />} />
          <Route path="/pr/new" element={<PurchaseRequestCreatePage />} />
          <Route path="/pr/:id/edit" element={<PurchaseRequestEditPage />} />

          {/* 3. КП (Quotations / RFQ ответы) */}
          <Route path="/quotes" element={<QuotationsPage />} />

          {/* 4. Заказы (Purchase Orders) */}
          <Route path="/po" element={<PurchaseOrdersPage />} />

          {/* 5. Доставки (Shipments) */}
          <Route path="/shipments" element={<ShipmentsPage />} />

          {/* ===== СПРАВОЧНИКИ ===== */}

          {/* Блок 1: Проекты и Шаблоны */}
          <Route path="/reference/projects" element={<ProjectsPage />} />
          <Route path="/reference/projects/:id" element={<ProjectCardPage />} />
          <Route path="/reference/stage-templates" element={<StageTemplatesPage />} />

          {/* Блок 2: Номенклатура и Категории */}
          <Route path="/reference/nomenclature" element={<NomenclaturePage />} />
          <Route path="/reference/categories" element={<CategoriesPage />} />

          {/* Блок 3: Поставщики и Прайс-листы */}
          <Route path="/reference/suppliers" element={<SuppliersPage />} />
          <Route path="/reference/suppliers/new" element={<SupplierCreatePage />} />
          <Route path="/reference/suppliers/:id/edit" element={<SupplierEditPage />} />
          <Route
            path="/reference/suppliers/price-import"
            element={<PriceImportPage />}
          />
          <Route
            path="/reference/supplier-pricelists"
            element={<SupplierPriceListsPage />}
          />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Container>
    </BrowserRouter>
  );
}
