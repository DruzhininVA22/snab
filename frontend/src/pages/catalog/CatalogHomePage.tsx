/**
 * Главная страница раздела "Справочники".
 *
 * Выступает как навигационный хаб к каталогам: номенклатура, категории и т.п.
 */
import * as React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Paper, Typography, Stack, Button } from '@mui/material';

export default function CatalogHomePage() {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Справочники</Typography>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={2}>
          <Button component={RouterLink} to="/catalog/categories" variant="contained">Категории</Button>
          <Button component={RouterLink} to="/catalog/suppliers" variant="outlined">Поставщики</Button>
        </Stack>
      </Paper>
    </Box>
  );
}
