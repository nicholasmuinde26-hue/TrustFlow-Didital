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

// Chama oversight + category-aware insights. Only enabled for chama-owned
// businesses (the endpoint 404s for personal ones).
export function useChamaBusinessDashboard(workspaceId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ["business", "chama-dashboard", workspaceId],
    queryFn: () => businessService.getChamaDashboard(workspaceId),
    enabled: Boolean(workspaceId) && enabled,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    retry: false,
  });
}

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
    isRefetching: salesQuery.isFetching,
    isError: salesQuery.isError,
    refetch: salesQuery.refetch,
    createSale: createSaleMutation.mutateAsync,
    isCreating: createSaleMutation.isPending,
  };
}

/**
 * ============================================================
 * KITCHEN — for category: "restaurant" businesses
 * ============================================================
 * Not a new data model: an order is a "sale" BusinessTransaction —
 * the same table SalesPage, POS and Reports already read from.
 *
 * Kitchen readiness (kitchen_status) is deliberately kept separate
 * from payment status (status). A cash order at POS is recorded
 * `status: "completed"` the instant it's rung up — that's a payment
 * fact, not a "food is ready" fact — so tickets are filtered on
 * `kitchen_status`, and "Mark Ready" only flips that field. It never
 * touches payment status, so it can't accidentally mark an unpaid
 * M-Pesa order as paid.
 */
export function useKitchenOrders(workspaceId) {
  const queryClient = useQueryClient();

  const salesQuery = useQuery({
    queryKey: ["business", "sales", workspaceId, {}],
    queryFn: () => businessService.getSales(workspaceId, {}),
    enabled: Boolean(workspaceId),
    // Poll so a new order placed at the till shows up on the kitchen screen
    refetchInterval: 10000,
  });

  const markReadyMutation = useMutation({
    mutationFn: (transactionId) => businessService.setKitchenStatus(workspaceId, transactionId, "ready"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", "sales", workspaceId] });
    },
  });

  const sales = Array.isArray(salesQuery.data) ? salesQuery.data : [];
  // Documents written before this field existed come back without it
  // (queries here use .lean() upstream, so mongoose defaults don't apply
  // on read) — treat a missing value the same as "queued".
  const kitchenStatus = (sale) => sale.kitchen_status || "queued";

  return {
    tickets: sales.filter((sale) => kitchenStatus(sale) === "queued"),
    readySales: sales.filter((sale) => kitchenStatus(sale) === "ready"),
    isLoading: salesQuery.isLoading,
    refetch: salesQuery.refetch,
    markReady: markReadyMutation.mutateAsync,
    isMarkingReady: markReadyMutation.isPending,
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
    isRefetching: expensesQuery.isFetching,
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
    },
  });

  const deleteInventoryMutation = useMutation({
    mutationFn: (itemId) => businessService.deleteInventoryItem(workspaceId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", "inventory", workspaceId] });
    },
  });

  const publishInventoryMutation = useMutation({
    mutationFn: (itemId) => businessService.publishInventoryItem(workspaceId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", "inventory", workspaceId] });
    },
  });

  const unpublishInventoryMutation = useMutation({
    mutationFn: (itemId) => businessService.unpublishInventoryItem(workspaceId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", "inventory", workspaceId] });
    },
  });

  const publishAllInventoryMutation = useMutation({
    mutationFn: (itemIds) => businessService.publishInventoryBulk(workspaceId, itemIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", "inventory", workspaceId] });
    },
  });

  const restockInventoryMutation = useMutation({
    mutationFn: ({ itemId, ...payload }) => businessService.restockInventoryItem(workspaceId, itemId, payload),
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
    restockInventoryItem: restockInventoryMutation.mutateAsync,
    isRestocking: restockInventoryMutation.isPending,
    publishInventoryItem: publishInventoryMutation.mutateAsync,
    isPublishing: publishInventoryMutation.isPending,
    unpublishInventoryItem: unpublishInventoryMutation.mutateAsync,
    isUnpublishing: unpublishInventoryMutation.isPending,
    publishAllInventory: publishAllInventoryMutation.mutateAsync,
    isPublishingAll: publishAllInventoryMutation.isPending,
  };
}

/**
 * ============================================================
 * RENTAL LISTINGS (rooms & plots) — for category: "rental" businesses
 * ============================================================
 */
export function useRentalListings(workspaceId) {
  const queryClient = useQueryClient();

  const listingsQuery = useQuery({
    queryKey: ["business", "rental-listings", workspaceId],
    queryFn: () => businessService.getRentalListings(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["business", "rental-listings", workspaceId] });

  const addListingMutation = useMutation({
    mutationFn: (payload) => businessService.addRentalListing(workspaceId, payload),
    onSuccess: invalidate,
  });

  const updateListingMutation = useMutation({
    mutationFn: ({ listingId, ...payload }) => businessService.updateRentalListing(workspaceId, listingId, payload),
    onSuccess: invalidate,
  });

  const setStatusMutation = useMutation({
    mutationFn: ({ listingId, status }) => businessService.setRentalListingStatus(workspaceId, listingId, status),
    onSuccess: invalidate,
  });

  const deleteListingMutation = useMutation({
    mutationFn: (listingId) => businessService.deleteRentalListing(workspaceId, listingId),
    onSuccess: invalidate,
  });

  return {
    listings: Array.isArray(listingsQuery.data) ? listingsQuery.data : [],
    isLoading: listingsQuery.isLoading,
    refetch: listingsQuery.refetch,
    addListing: addListingMutation.mutateAsync,
    isAdding: addListingMutation.isPending,
    updateListing: updateListingMutation.mutateAsync,
    isUpdating: updateListingMutation.isPending,
    setListingStatus: setStatusMutation.mutateAsync,
    isSettingStatus: setStatusMutation.isPending,
    deleteListing: deleteListingMutation.mutateAsync,
    isDeleting: deleteListingMutation.isPending,
  };
}

export function useRentalInquiries(workspaceId) {
  const queryClient = useQueryClient();

  const inquiriesQuery = useQuery({
    queryKey: ["business", "rental-inquiries", workspaceId],
    queryFn: () => businessService.getRentalInquiries(workspaceId),
    enabled: Boolean(workspaceId),
    refetchInterval: 20000,
  });

  const setStatusMutation = useMutation({
    mutationFn: ({ inquiryId, status }) => businessService.setRentalInquiryStatus(workspaceId, inquiryId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["business", "rental-inquiries", workspaceId] }),
  });

  return {
    inquiries: Array.isArray(inquiriesQuery.data) ? inquiriesQuery.data : [],
    isLoading: inquiriesQuery.isLoading,
    refetch: inquiriesQuery.refetch,
    updateInquiryStatus: setStatusMutation.mutateAsync,
    isUpdatingStatus: setStatusMutation.isPending,
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
    isRefetching: customersQuery.isFetching,
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
    isRefetching: accountsQuery.isFetching,
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
