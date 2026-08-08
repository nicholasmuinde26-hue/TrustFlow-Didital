export const mockBusinessData = {
  profile: {
    id: "biz_101",
    name: "Kijiji Supplies & Enterprise",
    category: "Retail & Wholesale",
    currency: "KES",
    taxRate: 16,
    mPesaTill: "7829101",
  },
  dashboard: {
    totalRevenue: 1240500,
    totalExpenses: 680200,
    netProfit: 560300,
    cashOnHand: 185400,
    revenueGrowth: 14.8,
    expenseGrowth: -3.2,
  },
  // Alias for service aggregation compatibility
  get summary() {
    return {
      ...this.dashboard,
      profile: this.profile,
    };
  },
  accounts: [
    { id: "acc_1", name: "Main Till (M-Pesa)", type: "mobile_money", balance: 112400, accountNumber: "Till #7829101" },
    { id: "acc_2", name: "Co-op Bank Business", type: "bank", balance: 450000, accountNumber: "01129048102900" },
    { id: "acc_3", name: "Petty Cash Safe", type: "cash", balance: 18000, accountNumber: "Cash Safe A" },
    { id: "acc_4", name: "Equity Chama Reserve", type: "bank", balance: 100000, accountNumber: "047029104812" },
  ],
  sales: [
    { id: "sal_1", invoiceNo: "INV-2026-001", customer: "Amina Abdalla", amount: 45000, status: "paid", date: "2026-08-05", paymentMethod: "M-Pesa" },
    { id: "sal_2", invoiceNo: "INV-2026-002", customer: "Nairobi Hardware Ltd", amount: 128000, status: "pending", date: "2026-08-04", paymentMethod: "Invoice 14-day" },
    { id: "sal_3", invoiceNo: "INV-2026-003", customer: "John Kamau", amount: 12500, status: "paid", date: "2026-08-04", paymentMethod: "Cash" },
    { id: "sal_4", invoiceNo: "INV-2026-004", customer: "Grace Wanjiku", amount: 34000, status: "paid", date: "2026-08-03", paymentMethod: "M-Pesa" },
    { id: "sal_5", invoiceNo: "INV-2026-005", customer: "Ochieng Wholesalers", amount: 89000, status: "overdue", date: "2026-07-28", paymentMethod: "Bank Transfer" },
  ],
  // Alias for recent sales queries
  get recentSales() {
    return this.sales;
  },
  salesChart: [
    { month: "Jan", sales: 85000, expenses: 45000 },
    { month: "Feb", sales: 92000, expenses: 50000 },
    { month: "Mar", sales: 110000, expenses: 62000 },
    { month: "Apr", sales: 98000, expenses: 54000 },
    { month: "May", sales: 135000, expenses: 70000 },
    { month: "Jun", sales: 148000, expenses: 78000 },
    { month: "Jul", sales: 162000, expenses: 81000 },
  ],
  expenses: [
    { id: "exp_1", category: "Inventory Restock", supplier: "Kenya Wholesalers", amount: 145000, status: "paid", date: "2026-08-02" },
    { id: "exp_2", category: "Rent & Utilities", supplier: "City Plaza Management", amount: 45000, status: "paid", date: "2026-08-01" },
    { id: "exp_3", category: "Transport & Logistics", supplier: "Boda Delivery Co", amount: 8200, status: "paid", date: "2026-08-04" },
  ],
  customers: [
    { id: "cust_1", name: "Amina Abdalla", phone: "+254 712 345 678", totalSpent: 240000, orders: 12 },
    { id: "cust_2", name: "Nairobi Hardware Ltd", phone: "+254 722 987 654", totalSpent: 510000, orders: 8 },
    { id: "cust_3", name: "John Kamau", phone: "+254 733 112 233", totalSpent: 85000, orders: 5 },
  ],
  suppliers: [
    { id: "sup_1", name: "Kenya Wholesalers Ltd", contact: "Peter Omondi", phone: "+254 700 123 456", category: "Bulk Raw Materials" },
    { id: "sup_2", name: "City Plaza Management", contact: "Accounts Office", phone: "+254 711 222 333", category: "Real Estate" },
  ],
  inventory: [
    { id: "item_1", sku: "SKU-1001", name: "Cement Bags (50kg)", stock: 140, unitPrice: 850, reorderLevel: 30 },
    { id: "item_2", sku: "SKU-1002", name: "Iron Sheets (3 meters)", stock: 18, unitPrice: 1200, reorderLevel: 25 },
    { id: "item_3", sku: "SKU-1003", name: "Paint Buckets (20L White)", stock: 45, unitPrice: 4200, reorderLevel: 10 },
  ],
};

// Uppercase alias to prevent import mismatches across services
export const MOCK_BUSINESS_DATA = mockBusinessData;

export default mockBusinessData;