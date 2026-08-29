import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import businessService from "../services/business.service";
import storefrontPublicService from "../services/storefront.public.service";

// Dashboard Summary
export function useBusinessSummary(workspaceId) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["business", "summary", workspaceId],
    queryFn: () => businessService.getSummary(workspaceId),
    enabled: Boolean(workspaceId),
  });

  return {
    ...query,
    summary: query.data,
    refetchSummary: query.refetch,
  };
}

export const useBusiness = useBusinessSummary;

// Sales Hooks
export function useBusinessSales(workspaceId, params = {}) {
  const queryClient = useQueryClient();

  const salesQuery = useQuery({
    queryKey: ["business", "sales", workspaceId, params],
    queryFn: () => businessService.getSales(workspaceId, params),
    enabled: Boolean(workspaceId),
  });

  const createSaleMutation = useMutation({
    mutationFn: (payload) => businessService.createSale(workspaceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", "sales", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["business", "summary", workspaceId] });
    },
  });

  return {
    sales: Array.isArray(salesQuery.data) ? salesQuery.data : [],
    isLoading: salesQuery.isLoading,
    isError: salesQuery.isError,
    refetch: salesQuery.refetch,
    createSale: createSaleMutation.mutateAsync,
    isCreating: createSaleMutation.isPending,
  };
}

// Expenses Hooks
export function useBusinessExpenses(workspaceId, params = {}) {
  const queryClient = useQueryClient();

  const expensesQuery = useQuery({
    queryKey: ["business", "expenses", workspaceId, params],
    queryFn: () => businessService.getExpenses(workspaceId, params),
    enabled: Boolean(workspaceId),
  });

  const createExpenseMutation = useMutation({
    mutationFn: (payload) => businessService.createExpense(workspaceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", "expenses", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["business", "summary", workspaceId] });
    },
  });

  return {
    expenses: Array.isArray(expensesQuery.data) ? expensesQuery.data : [],
    isLoading: expensesQuery.isLoading,
    refetch: expensesQuery.refetch,
    createExpense: createExpenseMutation.mutateAsync,
    isCreating: createExpenseMutation.isPending,
  };
}

// Inventory Hooks
export function useBusinessInventory(workspaceId, params = {}) {
  const queryClient = useQueryClient();

  const inventoryQuery = useQuery({
    queryKey: ["business", "inventory", workspaceId, params],
    queryFn: () => businessService.getInventory(workspaceId, params),
    enabled: Boolean(workspaceId),
  });

  const addInventoryMutation = useMutation({
    mutationFn: (payload) => businessService.addInventoryItem(workspaceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", "inventory", workspaceId] });
    },
  });

  const updateInventoryMutation = useMutation({
    mutationFn: ({ itemId, ...payload }) => businessService.updateInventoryItem(workspaceId, itemId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", "inventory", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["business", "storefront", workspaceId] });
    },
  });

  const deleteInventoryMutation = useMutation({
    mutationFn: (itemId) => businessService.deleteInventoryItem(workspaceId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", "inventory", workspaceId] });
    },
  });

  return {
    inventory: Array.isArray(inventoryQuery.data) ? inventoryQuery.data : [],
    isLoading: inventoryQuery.isLoading,
    refetch: inventoryQuery.refetch,
    addInventoryItem: addInventoryMutation.mutateAsync,
    isAdding: addInventoryMutation.isPending,
    updateInventoryItem: updateInventoryMutation.mutateAsync,
    isUpdating: updateInventoryMutation.isPending,
    deleteInventoryItem: deleteInventoryMutation.mutateAsync,
    isDeleting: deleteInventoryMutation.isPending,
  };
}

/**
 * ============================================================
 * POINT OF SALE
 * ============================================================
 * Live inventory feed for the till grid + a checkout mutation that
 * writes to the SAME BusinessTransaction/BusinessItem tables Sales
 * & Invoicing and Inventory & Stock already read from.
 */
export function useBusinessPos(workspaceId) {
  const queryClient = useQueryClient();

  const inventoryQuery = useQuery({
    queryKey: ["business", "inventory", workspaceId, {}],
    queryFn: () => businessService.getInventory(workspaceId, {}),
    enabled: Boolean(workspaceId),
    // Poll lightly so a second till's sale is reflected here quickly
    refetchInterval: 15000,
  });

  const checkoutMutation = useMutation({
    mutationFn: (payload) => businessService.createPosSale(workspaceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", "inventory", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["business", "sales", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["business", "summary", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["business", "accounts", workspaceId] });
    },
  });

  return {
    items: Array.isArray(inventoryQuery.data) ? inventoryQuery.data : [],
    isLoading: inventoryQuery.isLoading,
    refetch: inventoryQuery.refetch,
    checkout: checkoutMutation.mutateAsync,
    isCheckingOut: checkoutMutation.isPending,
  };
}

// Customers Hooks
export function useBusinessCustomers(workspaceId, params = {}) {
  const queryClient = useQueryClient();

  const customersQuery = useQuery({
    queryKey: ["business", "customers", workspaceId, params],
    queryFn: () => businessService.getCustomers(workspaceId, params),
    enabled: Boolean(workspaceId),
  });

  const createCustomerMutation = useMutation({
    mutationFn: (payload) => businessService.createCustomer(workspaceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", "customers", workspaceId] });
    },
  });

  return {
    customers: Array.isArray(customersQuery.data) ? customersQuery.data : [],
    isLoading: customersQuery.isLoading,
    refetch: customersQuery.refetch,
    createCustomer: createCustomerMutation.mutateAsync,
    isCreating: createCustomerMutation.isPending,
  };
}

// Suppliers Hooks
export function useBusinessSuppliers(workspaceId, params = {}) {
  const queryClient = useQueryClient();

  const suppliersQuery = useQuery({
    queryKey: ["business", "suppliers", workspaceId, params],
    queryFn: () => businessService.getSuppliers(workspaceId, params),
    enabled: Boolean(workspaceId),
  });

  const createSupplierMutation = useMutation({
    mutationFn: (payload) => businessService.createSupplier(workspaceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", "suppliers", workspaceId] });
    },
  });

  return {
    suppliers: Array.isArray(suppliersQuery.data) ? suppliersQuery.data : [],
    isLoading: suppliersQuery.isLoading,
    refetch: suppliersQuery.refetch,
    createSupplier: createSupplierMutation.mutateAsync,
    isCreating: createSupplierMutation.isPending,
  };
}

// Accounts Hooks
export function useBusinessAccounts(workspaceId) {
  const accountsQuery = useQuery({
    queryKey: ["business", "accounts", workspaceId],
    queryFn: () => businessService.getAccounts(workspaceId),
    enabled: Boolean(workspaceId),
  });

  return {
    accounts: Array.isArray(accountsQuery.data) ? accountsQuery.data : [],
    isLoading: accountsQuery.isLoading,
    refetch: accountsQuery.refetch,
  };
}


// Settings Hooks
export function useBusinessSettings(workspaceId) {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["business", "settings", workspaceId],
    queryFn: () => businessService.getSettings(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const updateMutation = useMutation({
    mutationFn: (payload) => businessService.updateSettings(workspaceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", "settings", workspaceId] });
    },
  });

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    updateSettings: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}

// Business M-Pesa STK Push Collection Hook
export function useInitiateBusinessStkPush() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId, ...payload }) => businessService.initiateMpesaStkPush(workspaceId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["business", "sales", variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["business", "summary", variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["business", "accounts", variables.workspaceId] });
    },
  });
}

/**
 * ============================================================
 * STOREFRONT — ADMIN SIDE (owner configures branding + fulfills orders)
 * ============================================================
 */
export function useStorefrontSettings(workspaceId) {
  const queryClient = useQueryClient();

  const storefrontQuery = useQuery({
    queryKey: ["business", "storefront", workspaceId],
    queryFn: () => businessService.getStorefront(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const updateMutation = useMutation({
    mutationFn: (payload) => businessService.updateStorefront(workspaceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", "storefront", workspaceId] });
    },
  });

  return {
    storefront: storefrontQuery.data,
    isLoading: storefrontQuery.isLoading,
    refetch: storefrontQuery.refetch,
    updateStorefront: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}

export function useStorefrontOrders(workspaceId) {
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ["business", "storefront-orders", workspaceId],
    queryFn: () => businessService.getStorefrontOrders(workspaceId),
    enabled: Boolean(workspaceId),
    refetchInterval: 20000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }) => businessService.updateStorefrontOrderStatus(workspaceId, orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", "storefront-orders", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["business", "inventory", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["business", "summary", workspaceId] });
    },
  });

  return {
    orders: Array.isArray(ordersQuery.data) ? ordersQuery.data : [],
    isLoading: ordersQuery.isLoading,
    refetch: ordersQuery.refetch,
    updateOrderStatus: updateStatusMutation.mutateAsync,
    isUpdatingStatus: updateStatusMutation.isPending,
  };
}

/**
 * ============================================================
 * STOREFRONT — PUBLIC SIDE (buyer, no auth, no workspace context)
 * ============================================================
 */
export function usePublicStorefront(slug) {
  const query = useQuery({
    queryKey: ["storefront", "public", slug],
    queryFn: () => storefrontPublicService.getStorefront(slug),
    enabled: Boolean(slug),
    // Live stock: keep this fresh without the buyer having to refresh
    refetchInterval: 20000,
    retry: 1,
  });

  return {
    data: query.data,
    storefront: query.data?.storefront,
    business: query.data?.business,
    items: Array.isArray(query.data?.items) ? query.data.items : [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function usePlaceStorefrontOrder(slug) {
  return useMutation({
    mutationFn: (payload) => storefrontPublicService.placeOrder(slug, payload),
  });
}

export function useTrackStorefrontOrder() {
  return useMutation({
    mutationFn: ({ orderCode, phone }) => storefrontPublicService.trackOrder(orderCode, phone),
  });
}
