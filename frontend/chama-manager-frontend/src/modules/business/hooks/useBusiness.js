import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import businessService from "../services/business.service";

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
    sales: salesQuery.data || [],
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
    expenses: expensesQuery.data || [],
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

  return {
    inventory: inventoryQuery.data || [],
    isLoading: inventoryQuery.isLoading,
    refetch: inventoryQuery.refetch,
    addInventoryItem: addInventoryMutation.mutateAsync,
    isAdding: addInventoryMutation.isPending,
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
    customers: customersQuery.data || [],
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
    suppliers: suppliersQuery.data || [],
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
    accounts: accountsQuery.data || [],
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