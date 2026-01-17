/**
 * Прайс-листы поставщиков.
 * Соответствие номенклатуры поставщиков общей номенклатуре.
 */
import * as React from 'react';
import { Box, Typography } from '@mui/material';

export default function SupplierPriceListsPage() {
    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
                Прайс-листы поставщиков
            </Typography>

            <Typography color="text.secondary">
                Раздел в разработке. Здесь будут прайс-листы поставщиков и соответствия номенклатуры.
            </Typography>
        </Box>
    );
}
