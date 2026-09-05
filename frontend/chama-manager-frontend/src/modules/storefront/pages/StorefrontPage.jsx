import { useState, useEffect } from "react";
import { ShoppingCart } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productApi, cartApi } from "../api/storefront.api";
import ProductFilters from "../components/ProductFilters";
import ProductGrid from "../components/ProductGrid";
import ShoppingCartSidebar from "../components/ShoppingCartSidebar";
import toast from "react-hot-toast";

export default function StorefrontPage() {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState(() => localStorage.getItem("cart_session_id"));
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Initialize session ID for guest carts
  useEffect(() => {
    if (!sessionId) {
      const newSessionId = "session_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
      setSessionId(newSessionId);
      localStorage.setItem("cart_session_id", newSessionId);
    }
  }, [sessionId]);

  // Filters state
  const [filters, setFilters] = useState({
    search: "",
    category: null,
    min_price: null,
    max_price: null,
    in_stock: false,
    sort_by: "created_at",
    sort_order: "desc"
  });

  // Pagination state
  const [page, setPage] = useState(1);
  const [allProducts, setAllProducts] = useState([]);

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => productApi.getCategories(),
  });

  // Fetch products
  const { data: productsData, isLoading, refetch } = useQuery({
    queryKey: ["products", filters, page],
    queryFn: () => productApi.searchProducts(filters.search, filters, { page, limit: 20 }),
    enabled: !!sessionId,
  });

  // Fetch cart
  const { data: cartData, refetch: refetchCart } = useQuery({
    queryKey: ["cart", sessionId],
    queryFn: () => cartApi.getCart(sessionId),
    enabled: !!sessionId,
  });

  // Update products list when new data arrives
  useEffect(() => {
    if (productsData?.data?.products) {
      if (page === 1) {
        setAllProducts(productsData.data.products);
      } else {
        setAllProducts(prev => [...prev, ...productsData.data.products]);
      }
    }
  }, [productsData, page]);

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: (product) => cartApi.addToCart({
      product_id: product._id,
      quantity: 1,
      variant_sku: null
    }, sessionId),
    onSuccess: () => {
      refetchCart();
      toast.success("Added to cart!");
      setIsCartOpen(true);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to add to cart");
    }
  });

  // Update cart item mutation
  const updateCartMutation = useMutation({
    mutationFn: ({ itemId, quantity }) => cartApi.updateCartItem(itemId, quantity, sessionId),
    onSuccess: () => {
      refetchCart();
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to update cart");
    }
  });

  // Remove cart item mutation
  const removeCartMutation = useMutation({
    mutationFn: (itemId) => cartApi.removeFromCart(itemId, sessionId),
    onSuccess: () => {
      refetchCart();
      toast.success("Item removed from cart");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to remove item");
    }
  });

  // Clear cart mutation
  const clearCartMutation = useMutation({
    mutationFn: () => cartApi.clearCart(sessionId),
    onSuccess: () => {
      refetchCart();
      toast.success("Cart cleared");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to clear cart");
    }
  });

  const categories = categoriesData?.data || [];
  const products = allProducts;
  const hasMore = productsData?.data?.pagination?.has_more || false;
  const cart = cartData?.data || { items: [], subtotal: 0, total: 0 };

  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      setPage(prev => prev + 1);
    }
  };

  const handleAddToCart = (product) => {
    addToCartMutation.mutate(product);
  };

  const handleUpdateQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeCartMutation.mutate(itemId);
    } else {
      updateCartMutation.mutate({ itemId, quantity });
    }
  };

  const handleRemoveItem = (itemId) => {
    removeCartMutation.mutate(itemId);
  };

  const handleClearCart = () => {
    if (window.confirm("Are you sure you want to clear your cart?")) {
      clearCartMutation.mutate();
    }
  };

  const handleCheckout = () => {
    // TODO: Implement checkout flow
    toast.info("Checkout functionality coming soon!");
  };

  const handleViewDetails = (product) => {
    setSelectedProduct(product);
    // TODO: Open product detail modal
  };

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
    setAllProducts([]);
  }, [filters]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            🛍️ Storefront
          </h1>
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <ShoppingCart size={24} className="text-slate-600 dark:text-slate-400" />
            {cart.items.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {cart.items.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <ProductFilters
          filters={filters}
          onFilterChange={setFilters}
          categories={categories}
        />

        {/* Products Grid */}
        <ProductGrid
          products={products}
          loading={isLoading}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          onAddToCart={handleAddToCart}
          onViewDetails={handleViewDetails}
        />
      </main>

      {/* Shopping Cart Sidebar */}
      <ShoppingCartSidebar
        cart={cart}
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onCheckout={handleCheckout}
      />
    </div>
  );
}