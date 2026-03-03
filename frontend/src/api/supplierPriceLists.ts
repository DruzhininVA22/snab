/**
 * src/api/supplierPriceLists.ts
 *
 * API функции и хуки для работы с прайс-листами поставщиков.
 * 
 * Содержит:
 * - TypeScript интерфейсы для типизации данных
 * - React Query хуки для получения и изменения прайс-листов
 * - Функции для работы с API endpoint'ами
 *
 * API Base URL: /api/procurement/supplier-price-lists/
 * API Documentation: Django REST Framework с pagination и фильтрацией
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from './_http';

/**
 * ================================================
 * TYPESCRIPT ИНТЕРФЕЙСЫ (ТИПЫ ДАННЫХ)
 * ================================================
 */

/**
 * Интерфейс для одной строки/позиции в прайс-листе
 * Соответствует модели SupplierPriceListLine в Django
 * 
 * Пример:
 * {
 *   id: 1,
 *   price_list: 5,
 *   supplier_sku: "ABC-123",
 *   description: "Болты метрические М10",
 *   unit: 1,        // ID единицы измерения (шт, м, кг, и т.д.)
 *   price: 15.50,   // Цена за единицу
 *   min_quantity: 100,
 *   lead_time_days: 7,
 *   notes: "При заказе >500шт скидка 5%"
 * }
 */
export interface SupplierPriceListLine {
  /** Уникальный ID строки прайс-листа */
  id: number;

  /** ID прайс-листа, к которому относится эта строка */
  price_list: number;

  /** SKU товара по классификации поставщика */
  supplier_sku: string;

  /** Описание товара/услуги */
  description: string;

  /** ID единицы измерения (FK на unit.id) */
  unit: number;

  /** Цена за одну единицу */
  price: number;

  /** Минимальное количество для заказа */
  min_quantity: number;

  /** Время доставки в днях */
  lead_time_days: number;

  /** Дополнительные заметки или условия */
  notes: string;
}

/**
 * Интерфейс для прайс-листа поставщика (главный объект)
 * Соответствует модели SupplierPriceList в Django
 * 
 * Пример:
 * {
 *   id: 5,
 *   supplier: 2,
 *   name: "Основной прайс-лист",
 *   version: "2.1",
 *   effective_date: "2026-01-15",
 *   expiry_date: "2026-12-31",
 *   currency: "RUB",
 *   is_active: true,
 *   lines: [...]
 * }
 */
export interface SupplierPriceList {
  /** Уникальный ID прайс-листа */
  id: number;

  /** ID поставщика (FK на supplier.id) - ОБЯЗАТЕЛЬНО указывается при создании */
  supplier: number;

  /** Имя поставщика (добавляется бэком при сериализации для удобства) */
  supplier_name?: string;

  /** Название/описание прайс-листа */
  name: string;

  /** Версия прайс-листа (например "1.0", "2.1", "202601") */
  version: string;

  /** Дата начала действия прайс-листа (ISO 8601 format: YYYY-MM-DD) */
  effective_date: string;

  /** Дата, когда прайс-лист перестанет действовать (опционально) */
  expiry_date?: string;

  /** Трёхбуквенный код валюты (USD, EUR, RUB, etc.) */
  currency: string;

  /** Флаг активности прайс-листа */
  is_active: boolean;

  /** Массив строк прайс-листа (товары и цены) */
  lines?: SupplierPriceListLine[];
}

/**
 * Интерфейс для создания/обновления прайс-листа (форма)
 * Используется при POST/PATCH запросах
 */
export interface CreateUpdateSupplierPriceListPayload {
  supplier: number;           // ОБЯЗАТЕЛЬНО
  name: string;               // ОБЯЗАТЕЛЬНО
  version: string;            // ОБЯЗАТЕЛЬНО
  effective_date: string;     // ОБЯЗАТЕЛЬНО
  expiry_date?: string;
  currency: string;           // ОБЯЗАТЕЛЬНО
  is_active?: boolean;        // Опционально, default=true
}

/**
 * ================================================
 * API ФУНКЦИИ (FETCH/HTTP МЕТОДЫ)
 * ================================================
 */

/**
 * Получить список всех прайс-листов (с опциональной фильтрацией)
 * 
 * @param supplierId - Опциональный ID поставщика для фильтрации
 * @returns Promise с массивом SupplierPriceList
 * 
 * Пример:
 * const lists = await fetchSupplierPriceLists();           // все
 * const lists = await fetchSupplierPriceLists(2);          // только от поставщика 2
 */
export async function fetchSupplierPriceLists(
  supplierId?: number,
): Promise<SupplierPriceList[]> {
  const params: any = { page_size: 1000 };
  
  if (supplierId) {
    params.supplier = supplierId;
  }

  const response = await http.get('/api/procurement/supplier-price-lists/', {
    params,
  });

  // Обработаем стандартный DRF ответ с pagination
  const data = Array.isArray(response.data?.results)
    ? response.data.results
    : response.data;

  return data || [];
}

/**
 * Получить одиночный прайс-лист по ID
 * 
 * @param id - ID прайс-листа
 * @returns Promise с одним SupplierPriceList (включая lines)
 * 
 * Пример:
 * const list = await fetchSupplierPriceListDetail(5);
 */
export async function fetchSupplierPriceListDetail(
  id: number,
): Promise<SupplierPriceList> {
  const response = await http.get(
    `/api/procurement/supplier-price-lists/${id}/`,
  );
  return response.data;
}

/**
 * Создать новый прайс-лист
 * 
 * @param payload - Данные нового прайс-листа
 * @returns Promise с созданным SupplierPriceList
 * 
 * Пример:
 * const newList = await createSupplierPriceList({
 *   supplier: 2,
 *   name: "Q1 Прайс",
 *   version: "1.0",
 *   effective_date: "2026-01-01",
 *   currency: "RUB",
 *   is_active: true
 * });
 */
export async function createSupplierPriceList(
  payload: CreateUpdateSupplierPriceListPayload,
): Promise<SupplierPriceList> {
  const response = await http.post(
    '/api/procurement/supplier-price-lists/',
    payload,
  );
  return response.data;
}

/**
 * Обновить существующий прайс-лист
 * 
 * @param id - ID прайс-листа для обновления
 * @param payload - Новые данные (можно обновить только часть полей)
 * @returns Promise с обновленным SupplierPriceList
 * 
 * Пример:
 * const updated = await updateSupplierPriceList(5, {
 *   is_active: false,
 *   version: "2.0"
 * });
 */
export async function updateSupplierPriceList(
  id: number,
  payload: Partial<CreateUpdateSupplierPriceListPayload>,
): Promise<SupplierPriceList> {
  const response = await http.patch(
    `/api/procurement/supplier-price-lists/${id}/`,
    payload,
  );
  return response.data;
}

/**
 * Удалить прайс-лист
 * 
 * @param id - ID прайс-листа для удаления
 * @returns Promise<void>
 * 
 * Пример:
 * await deleteSupplierPriceList(5);
 */
export async function deleteSupplierPriceList(id: number): Promise<void> {
  await http.delete(`/api/procurement/supplier-price-lists/${id}/`);
}

/**
 * ================================================
 * REACT QUERY ХУКИ (УПРАВЛЕНИЕ СОСТОЯНИЕМ И КЕШЕМ)
 * ================================================
 */

/**
 * Хук для получения списка прайс-листов
 * 
 * Использует React Query для:
 * - Автоматического кеширования данных
 * - Отслеживания состояния (loading, error, data)
 * - Фонового обновления
 * - Отмены запросов при размонтировании
 * 
 * @param supplierId - Опциональный фильтр по поставщику
 * @returns useQuery результат с данными прайс-листов
 * 
 * Пример использования:
 * const { data, isLoading, isError, error } = useSupplierPriceLists();
 * const { data } = useSupplierPriceLists(2);  // только от поставщика 2
 */
export function useSupplierPriceLists(supplierId?: number) {
  return useQuery({
    // Уникальный ключ для кеша (зависит от фильтра)
    queryKey: ['supplierPriceLists', { supplierId }],

    // Функция для запроса данных
    queryFn: () => fetchSupplierPriceLists(supplierId),

    // Опции
    staleTime: 5 * 60 * 1000,      // Данные "свежие" 5 минут
    gcTime: 10 * 60 * 1000,        // Кеш удаляется через 10 минут неиспользования
  });
}

/**
 * Хук для получения одиночного прайс-листа
 * 
 * @param id - ID прайс-листа
 * @param enabled - Включить ли запрос (default: true если id определён)
 * @returns useQuery результат
 * 
 * Пример:
 * const { data: priceList } = useSupplierPriceListDetail(5);
 */
export function useSupplierPriceListDetail(
  id?: number,
  enabled: boolean = !!id,
) {
  return useQuery({
    queryKey: ['supplierPriceList', { id }],
    queryFn: () => (id ? fetchSupplierPriceListDetail(id) : Promise.reject()),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Хук для создания нового прайс-листа
 * 
 * Возвращает функцию mutate, которую можно вызвать с данными
 * Автоматически инвалидирует кеш после создания
 * 
 * @returns useMutation результат с mutate и др. методами
 * 
 * Пример:
 * const { mutate, isLoading } = useCreateSupplierPriceList();
 * 
 * mutate({
 *   supplier: 2,
 *   name: "Новый прайс",
 *   version: "1.0",
 *   effective_date: "2026-01-01",
 *   currency: "RUB"
 * });
 */
export function useCreateSupplierPriceList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSupplierPriceList,

    // При успехе инвалидируем кеш (заставляем перезагрузить данные)
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['supplierPriceLists'],
      });
    },
  });
}

/**
 * Хук для обновления прайс-листа
 * 
 * @returns useMutation результат
 * 
 * Пример:
 * const { mutate } = useUpdateSupplierPriceList();
 * 
 * mutate({ id: 5, payload: { is_active: false } });
 */
export function useUpdateSupplierPriceList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number;
      payload: Partial<CreateUpdateSupplierPriceListPayload>;
    }) => updateSupplierPriceList(id, payload),

    onSuccess: (data) => {
      // Обновляем кеш списка
      queryClient.invalidateQueries({
        queryKey: ['supplierPriceLists'],
      });

      // Обновляем кеш конкретного прайс-листа
      queryClient.invalidateQueries({
        queryKey: ['supplierPriceList', { id: data.id }],
      });
    },
  });
}

/**
 * Хук для удаления прайс-листа
 * 
 * @returns useMutation результат
 * 
 * Пример:
 * const { mutate } = useDeleteSupplierPriceList();
 * mutate(5);  // удалить прайс-лист с ID 5
 */
export function useDeleteSupplierPriceList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSupplierPriceList,

    onSuccess: () => {
      // Инвалидируем весь кеш прайс-листов
      queryClient.invalidateQueries({
        queryKey: ['supplierPriceLists'],
      });
    },
  });
}
